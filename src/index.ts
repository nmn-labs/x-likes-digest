import { getDb } from './db.js';
import { collectLikes } from './collector.js';
import { enrichLikes } from './enricher.js';
import { summarizeLikes, getLikesByDate } from './summarizer.js';
import { runRecommender } from './recommender.js';
import { sendDigest } from './telegram.js';

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  console.log(`[x-likes-digest] Starting daily digest for ${today}`);

  // Initialize DB (triggers migrations)
  getDb();
  console.log('[Phase 0] DB initialized');

  // Phase 1: Collect likes from X
  try {
    await collectLikes();
    console.log('[Phase 1] Collection complete');
  } catch (err) {
    console.error('[Phase 1] Collection failed, continuing:', err);
  }

  // Phase 2: Enrich (articles, links, images)
  try {
    await enrichLikes();
    console.log('[Phase 2] Enrichment complete');
  } catch (err) {
    console.error('[Phase 2] Enrichment failed, continuing:', err);
  }

  // Phase 3: Summarize & categorize
  try {
    await summarizeLikes(today);
    console.log('[Phase 3] Summarization complete');
  } catch (err) {
    console.error('[Phase 3] Summarization failed, continuing:', err);
  }

  // Phase 4: Recommend
  let recs: Awaited<ReturnType<typeof runRecommender>> = [];
  try {
    recs = await runRecommender();
    console.log('[Phase 4] Recommendation complete');
  } catch (err) {
    console.error('[Phase 4] Recommendation failed, continuing:', err);
  }

  // Phase 5: Deliver via Telegram
  try {
    const likes = getLikesByDate(today);
    await sendDigest(likes, today, recs);
    console.log('[Phase 5] Delivery complete');
  } catch (err) {
    console.error('[Phase 5] Delivery failed:', err);
  }

  console.log('[x-likes-digest] Done');
}

main().catch(console.error);
