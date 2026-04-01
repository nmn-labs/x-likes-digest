import Anthropic from '@anthropic-ai/sdk';
import { getDb } from './db.js';
import { loadConfig } from './config.js';
import type { Like, InterestProfile, Recommendation } from './types.js';

const MIN_LIKES_FOR_RECOMMEND = 15;

interface SearchTweet {
  tweet_id: string;
  text: string;
  author_username?: string;
  created_at?: string;
}

interface ProfileEntry {
  category: string;
  keyword: string;
  weight: number;
}

async function extractKeywordsFromLikes(
  likes: Like[],
  anthropic: Anthropic
): Promise<ProfileEntry[]> {
  const texts = likes
    .map(l => `[${l.category ?? 'unknown'}] ${l.text ?? ''}`)
    .filter(t => t.length > 10)
    .slice(0, 50)
    .join('\n---\n');

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `以下のいいねしたツイートを分析して、カテゴリとキーワードの組み合わせをJSON配列で返してください。
形式: [{"category":"カテゴリ名","keyword":"キーワード","weight":1.0}, ...]
重みは1.0を基準に、より多く出現するほど高く設定。最大20エントリ。

ツイート:
${texts}

JSONのみ返してください。`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== 'text') return [];

  try {
    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    return JSON.parse(jsonMatch[0]) as ProfileEntry[];
  } catch {
    return [];
  }
}

async function searchTweets(
  query: string,
  apiKey: string
): Promise<SearchTweet[]> {
  const url = `https://api.twitterapi.io/twitter/tweet/advanced_search?query=${encodeURIComponent(query)}&queryType=Latest`;
  const response = await fetch(url, {
    headers: { 'x-api-key': apiKey },
  });

  if (!response.ok) {
    console.error(`Twitter search failed: ${response.status}`);
    return [];
  }

  const data = await response.json() as { tweets?: Array<{ tweet_id?: string; id?: string; text?: string; author?: { username?: string }; created_at?: string }> };
  if (!data.tweets) return [];

  return data.tweets.map(t => ({
    tweet_id: t.tweet_id ?? t.id ?? '',
    text: t.text ?? '',
    author_username: t.author?.username,
    created_at: t.created_at,
  })).filter(t => t.tweet_id);
}

async function selectTopTweets(
  candidates: SearchTweet[],
  profile: ProfileEntry[],
  excludedIds: Set<string>,
  anthropic: Anthropic
): Promise<Array<{ tweet: SearchTweet; reason: string }>> {
  const filtered = candidates.filter(t => !excludedIds.has(t.tweet_id));
  if (filtered.length === 0) return [];

  const profileSummary = profile
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 10)
    .map(p => `${p.category}/${p.keyword}(${p.weight.toFixed(1)})`)
    .join(', ');

  const tweetList = filtered
    .slice(0, 20)
    .map((t, i) => `[${i}] @${t.author_username ?? 'unknown'}: ${t.text}`)
    .join('\n');

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `ユーザーの興味プロファイル: ${profileSummary}

以下のツイート候補から最大5件を選び、JSON配列で返してください。
形式: [{"index":0,"reason":"推薦理由（日本語50文字以内）"}, ...]

ツイート候補:
${tweetList}

JSONのみ返してください。`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== 'text') return [];

  try {
    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const selections = JSON.parse(jsonMatch[0]) as Array<{ index: number; reason: string }>;
    return selections
      .filter(s => s.index >= 0 && s.index < filtered.slice(0, 20).length)
      .slice(0, 5)
      .map(s => ({ tweet: filtered[s.index], reason: s.reason }));
  } catch {
    return [];
  }
}

function updateFeedback(): void {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  // Find unchecked recommendations
  const unchecked = db.prepare(`
    SELECT * FROM recommendations WHERE was_liked IS NULL AND checked_at IS NULL
  `).all() as Recommendation[];

  for (const rec of unchecked) {
    const liked = db.prepare(
      `SELECT 1 FROM likes WHERE tweet_id = ? LIMIT 1`
    ).get(rec.tweet_id);

    const wasLiked = liked ? 1 : 0;
    db.prepare(`
      UPDATE recommendations SET was_liked = ?, checked_at = ? WHERE id = ?
    `).run(wasLiked, today, rec.id);

    if (liked) {
      // Update interest profile weights from the recommendation's associated category
      // Boost weight for all entries by a small amount when feedback is positive
      db.prepare(`
        UPDATE interest_profile SET weight = MIN(weight + 0.3, 10.0), last_updated = ?
        WHERE weight = (SELECT MAX(weight) FROM interest_profile)
      `).run(today);
    } else {
      // Small penalty for unliked recommendations
      db.prepare(`
        UPDATE interest_profile SET weight = MAX(weight - 0.1, 0.1), last_updated = ?
        WHERE weight = (SELECT MAX(weight) FROM interest_profile)
      `).run(today);
    }
  }
}

export async function runRecommender(): Promise<Array<{tweet_id: string; reason: string; author_username?: string; text?: string}>> {
  const db = getDb();

  // Check minimum likes
  const count = (db.prepare('SELECT COUNT(*) as cnt FROM likes').get() as { cnt: number }).cnt;
  if (count < MIN_LIKES_FOR_RECOMMEND) {
    console.log(`[recommender] likesが${count}件。${MIN_LIKES_FOR_RECOMMEND}件以上必要なためスキップ。`);
    return [];
  }

  // Load config with graceful skip
  let config;
  try {
    config = loadConfig();
  } catch (e) {
    console.log(`[recommender] 設定未完了のためスキップ: ${(e as Error).message}`);
    return [];
  }

  if (!config.twitterapi_io_key || !config.anthropic_api_key) {
    console.log('[recommender] API未設定のためスキップ。');
    return [];
  }

  const anthropic = new Anthropic({ apiKey: config.anthropic_api_key });

  // Process feedback first
  updateFeedback();

  // Load recent likes for profiling
  const likes = db.prepare(`
    SELECT * FROM likes ORDER BY liked_at DESC LIMIT 100
  `).all() as Like[];

  // Extract keywords and build/update interest profile
  console.log('[recommender] プロファイル生成中...');
  const entries = await extractKeywordsFromLikes(likes, anthropic);
  const today = new Date().toISOString().split('T')[0];

  for (const entry of entries) {
    db.prepare(`
      INSERT INTO interest_profile (category, keyword, weight, last_updated)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(category, keyword) DO UPDATE SET
        weight = (interest_profile.weight + excluded.weight) / 2,
        last_updated = excluded.last_updated
    `).run(entry.category, entry.keyword, entry.weight, today);
  }

  // Get top profile entries for search
  const topProfile = db.prepare(`
    SELECT * FROM interest_profile ORDER BY weight DESC LIMIT 5
  `).all() as InterestProfile[];

  if (topProfile.length === 0) {
    console.log('[recommender] プロファイルが空のためスキップ。');
    return [];
  }

  // Build search query from top keywords
  const searchTerms = topProfile
    .map(p => p.keyword)
    .slice(0, 3)
    .join(' OR ');
  const query = `(${searchTerms}) -is:retweet lang:ja`;

  // Search for candidate tweets
  console.log(`[recommender] 検索クエリ: ${query}`);
  const candidates = await searchTweets(query, config.twitterapi_io_key);

  if (candidates.length === 0) {
    console.log('[recommender] 候補ツイートなし。');
    return [];
  }

  // Get already liked and already recommended tweet IDs
  const likedIds = new Set(
    (db.prepare('SELECT tweet_id FROM likes').all() as { tweet_id: string }[]).map(r => r.tweet_id)
  );
  const recommendedIds = new Set(
    (db.prepare('SELECT tweet_id FROM recommendations').all() as { tweet_id: string }[]).map(r => r.tweet_id)
  );
  const excludedIds = new Set([...likedIds, ...recommendedIds]);

  // Select top 5 via Claude
  console.log('[recommender] Claude で候補を厳選中...');
  const selections = await selectTopTweets(candidates, topProfile, excludedIds, anthropic);

  // Save recommendations
  const stmt = db.prepare(`
    INSERT INTO recommendations (tweet_id, recommended_date, reason)
    VALUES (?, ?, ?)
  `);

  for (const { tweet, reason } of selections) {
    try {
      stmt.run(tweet.tweet_id, today, reason);
      console.log(`[recommender] 推薦: ${tweet.tweet_id} — ${reason}`);
    } catch (e) {
      console.error(`[recommender] 保存エラー: ${(e as Error).message}`);
    }
  }

  console.log(`[recommender] 完了。${selections.length}件推薦。`);
  return selections.map(({ tweet, reason }) => ({ tweet_id: tweet.tweet_id, reason, author_username: tweet.author_username, text: tweet.text }));
}
