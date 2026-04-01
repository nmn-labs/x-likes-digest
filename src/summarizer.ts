import Anthropic from '@anthropic-ai/sdk';
import { getDb } from './db.js';
import type { Like } from './types.js';

interface ClassifiedPost {
  tweet_id: string;
  category: string;
  summary: string;
}

interface ClaudeResponse {
  posts: ClassifiedPost[];
}

export function getLikesByDate(date: string): Like[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM likes
    WHERE DATE(liked_at) = ? OR DATE(created_at) = ?
    ORDER BY liked_at DESC
  `).all(date, date) as Like[];
  return rows;
}

export async function summarizeLikes(date: string): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('[summarizer] ANTHROPIC_API_KEY not set, skipping summarization.');
    return;
  }

  const likes = getLikesByDate(date);
  if (likes.length === 0) {
    console.log(`[summarizer] No likes found for ${date}.`);
    return;
  }

  console.log(`[summarizer] Summarizing ${likes.length} likes for ${date}...`);

  const client = new Anthropic({ apiKey });
  const db = getDb();
  const updateStmt = db.prepare(`
    UPDATE likes SET category = ?, summary = ? WHERE tweet_id = ?
  `);

  // Process in batches of 50 to avoid token limits
  const batchSize = 50;
  for (let i = 0; i < likes.length; i += batchSize) {
    const batch = likes.slice(i, i + batchSize);
    const postsJson = JSON.stringify(
      batch.map(l => ({ tweet_id: l.tweet_id, text: l.text || '' }))
    );

    const prompt = `以下は${date}にXでいいねされたポスト一覧です。
各ポストを以下のカテゴリに分類し、1-2行で要約してください。
カテゴリ: 🤖 AI, 💰 Crypto, 📰 ニュース, 🎨 アート/イラスト, 💻 テック, 📈 投資/マーケット, 🈲 NSFW, 🔗 その他
※内容に応じてカテゴリは追加可。
出力はJSON形式で:
{ "posts": [{ "tweet_id": "...", "category": "🤖 AI", "summary": "..." }] }

ポスト一覧:
${postsJson}`;

    try {
      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = message.content[0];
      if (content.type !== 'text') continue;

      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[summarizer] Could not parse JSON from response.');
        continue;
      }

      const result: ClaudeResponse = JSON.parse(jsonMatch[0]);
      const updateMany = db.transaction((posts: ClassifiedPost[]) => {
        for (const post of posts) {
          updateStmt.run(post.category, post.summary, post.tweet_id);
        }
      });
      updateMany(result.posts);
      console.log(`[summarizer] Updated ${result.posts.length} posts (batch ${Math.floor(i / batchSize) + 1}).`);
    } catch (err) {
      console.error('[summarizer] Error calling Claude API:', err);
    }
  }
}
