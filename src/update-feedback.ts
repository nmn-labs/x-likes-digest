/**
 * update-feedback.ts — Check if recommended posts were liked/replied/RT'd
 * Run before each digest to update interest_profile weights
 */
import { getDb } from './db.js';
import { loadConfig } from './config.js';

interface Recommendation {
  id: number;
  tweet_id: string;
  recommended_date: string;
  reason: string;
  was_liked: number | null;
  category?: string;
  keyword?: string;
}

export async function updateFeedback(): Promise<{ liked: number; notLiked: number; replied: number; retweeted: number }> {
  const db = getDb();
  const stats = { liked: 0, notLiked: 0, replied: 0, retweeted: 0 };

  // Get unchecked recommendations
  const unchecked = db.prepare(`
    SELECT * FROM recommendations WHERE was_liked IS NULL
  `).all() as Recommendation[];

  if (unchecked.length === 0) {
    console.log('[feedback] No unchecked recommendations.');
    return stats;
  }

  // Get all liked tweet IDs
  const likedIds = new Set(
    (db.prepare('SELECT tweet_id FROM likes').all() as { tweet_id: string }[])
      .map(r => r.tweet_id)
  );

  // Check each recommendation
  for (const rec of unchecked) {
    const wasLiked = likedIds.has(rec.tweet_id) ? 1 : 0;

    // Update recommendation record
    db.prepare('UPDATE recommendations SET was_liked = ?, checked_at = ? WHERE id = ?')
      .run(wasLiked, new Date().toISOString(), rec.id);

    if (wasLiked) {
      stats.liked++;
      // Boost related weights
      updateWeights(db, rec.reason, 0.3);
    } else {
      stats.notLiked++;
      // Gentle decay with category-specific normalization
      updateWeightsDecay(db, rec.reason, -0.1);
    }
  }

  // Update author weights
  updateAuthorWeights(db);

  console.log(`[feedback] Results: ${stats.liked} liked, ${stats.notLiked} not liked`);
  return stats;
}

function updateWeights(db: ReturnType<typeof getDb>, reason: string, delta: number): void {
  // Extract category/keyword from reason text
  const categories = extractCategories(reason);
  for (const cat of categories) {
    db.prepare(`
      INSERT INTO interest_profile (category, keyword, weight, last_updated)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(category, keyword) DO UPDATE SET
        weight = MIN(weight + ?, 10.0),
        last_updated = ?
    `).run(cat.category, cat.keyword, Math.max(delta, 1.0), new Date().toISOString(), delta, new Date().toISOString());
  }
}

function updateWeightsDecay(db: ReturnType<typeof getDb>, reason: string, delta: number): void {
  const categories = extractCategories(reason);
  for (const cat of categories) {
    // Get max weight for this category for normalization
    const maxWeight = (db.prepare(
      'SELECT MAX(weight) as mw FROM interest_profile WHERE category = ?'
    ).get(cat.category) as { mw: number | null })?.mw || 1.0;

    // Normalize decay: smaller categories decay less
    const normalizedDelta = delta * (maxWeight > 0 ? 1.0 / maxWeight : 1.0);

    db.prepare(`
      UPDATE interest_profile
      SET weight = MAX(weight + ?, 0.1), last_updated = ?
      WHERE category = ? AND keyword = ?
    `).run(normalizedDelta, new Date().toISOString(), cat.category, cat.keyword);
  }
}

function updateAuthorWeights(db: ReturnType<typeof getDb>): void {
  // Authors with 3+ likes get weight based on like count
  const authors = db.prepare(`
    SELECT author_username, COUNT(*) as cnt
    FROM likes
    GROUP BY author_username
    HAVING COUNT(*) >= 3
  `).all() as { author_username: string; cnt: number }[];

  for (const { author_username, cnt } of authors) {
    const weight = Math.min(cnt * 0.5, 10.0);
    db.prepare(`
      INSERT INTO interest_profile (category, keyword, weight, last_updated)
      VALUES ('author', ?, ?, ?)
      ON CONFLICT(category, keyword) DO UPDATE SET
        weight = ?, last_updated = ?
    `).run(author_username, weight, new Date().toISOString(), weight, new Date().toISOString());
  }
}

function extractCategories(reason: string): Array<{ category: string; keyword: string }> {
  const results: Array<{ category: string; keyword: string }> = [];
  const lower = reason.toLowerCase();

  const mappings: Record<string, string[]> = {
    'ai_image': ['grok', 'flux', 'nano banana', '画像生成', 'プロンプト', 'midjourney', 'comfyui'],
    'ai_llm': ['claude', 'gpt', 'llm', '自動化', 'code', 'automation'],
    'ai_video': ['kling', 'suno', '動画生成', 'video'],
    'crypto': ['crypto', 'btc', 'eth', 'defi', '仮想通貨', 'token', 'blockchain'],
    'illustration': ['sfw', 'nsfw', 'イラスト', 'illustration'],
    'business': ['youtube', '収益', 'マーケティング', 'ビジネス'],
    'fashion': ['adidas', 'nike', 'ファッション'],
  };

  for (const [category, keywords] of Object.entries(mappings)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        results.push({ category, keyword: kw });
      }
    }
  }

  return results.length > 0 ? results : [{ category: 'general', keyword: 'general' }];
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  updateFeedback().then(stats => {
    console.log('[feedback] Done:', JSON.stringify(stats));
  }).catch(console.error);
}
