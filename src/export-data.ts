/**
 * export-data.ts — Export undigested likes data as JSON to stdout
 * Used by OpenClaw cron to read data for summarization
 * Usage: npx tsx src/export-data.ts [--mark-digested]
 */
import { getDb } from './db.js';
import type { Like } from './types.js';

function main() {
  const markDigested = process.argv.includes('--mark-digested');
  const db = getDb();

  // Get undigested likes only (new since last digest)
  const likes = db.prepare(`
    SELECT * FROM likes
    WHERE digested = 0
    ORDER BY liked_at DESC
  `).all() as (Like & { digested: number })[];

  // Get recommendation history for feedback loop
  const recentRecs = db.prepare(`
    SELECT * FROM recommendations
    WHERE recommended_date >= date('now', '-7 days')
    ORDER BY recommended_date DESC
  `).all() as Array<{ tweet_id: string; recommended_date: string; reason: string; was_liked: number | null }>;

  // Get interest profile
  const profile = db.prepare(`
    SELECT * FROM interest_profile
    ORDER BY weight DESC
    LIMIT 50
  `).all() as Array<{ category: string; keyword: string; weight: number }>;

  // Get total likes count (for recommendation threshold)
  const totalLikes = (db.prepare('SELECT COUNT(*) as count FROM likes').get() as { count: number }).count;

  // Get media URLs for image analysis
  const likesWithMedia = likes
    .filter(l => l.has_media && l.media_urls)
    .map(l => ({
      tweet_id: l.tweet_id,
      media_urls: (() => {
        try { return JSON.parse(l.media_urls || '[]'); }
        catch { return l.media_urls?.split(',').map(u => u.trim()).filter(Boolean) || []; }
      })(),
    }));

  const output = {
    date: new Date().toISOString().slice(0, 10),
    total_likes_in_db: totalLikes,
    new_likes_count: likes.length,
    today_likes: likes.map(l => ({
      tweet_id: l.tweet_id,
      account: l.account,
      author_username: l.author_username,
      author_name: l.author_name,
      text: l.text,
      created_at: l.created_at,
      liked_at: l.liked_at,
      category: l.category,
      summary: l.summary,
      has_media: l.has_media,
      has_link: l.has_link,
      has_article: l.has_article,
      media_urls: l.media_urls,
      link_urls: l.link_urls,
      article_content: l.article_content,
      link_summary: l.link_summary,
      image_description: l.image_description,
    })),
    media_for_analysis: likesWithMedia,
    recent_recommendations: recentRecs,
    interest_profile: profile,
  };

  // Output as JSON to stdout
  console.log(JSON.stringify(output));

  // Mark likes as digested if requested
  if (markDigested && likes.length > 0) {
    const ids = likes.map(l => l.tweet_id);
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`UPDATE likes SET digested = 1 WHERE tweet_id IN (${placeholders})`).run(...ids);
    console.error(`[export-data] Marked ${ids.length} likes as digested`);
  }
}

main();
