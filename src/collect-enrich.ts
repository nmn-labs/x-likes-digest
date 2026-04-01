/**
 * collect-enrich.ts — Phase 1+2 only (no Claude needed)
 * Collects likes from X API, enriches with articles/links (no image analysis)
 * Run via VPS cron before OpenClaw cron picks up for summarization
 */
import { getDb } from './db.js';
import { collectLikes } from './collector.js';
import { enrichLikes } from './enricher.js';

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  console.log(`[collect-enrich] Starting for ${today}`);

  // Initialize DB
  getDb();
  console.log('[Phase 0] DB initialized');

  // Phase 1: Collect likes from X
  try {
    await collectLikes();
    console.log('[Phase 1] Collection complete');
  } catch (err) {
    console.error('[Phase 1] Collection failed:', err);
  }

  // Phase 2: Enrich (articles, links — image analysis skipped without ANTHROPIC_API_KEY)
  try {
    await enrichLikes();
    console.log('[Phase 2] Enrichment complete');
  } catch (err) {
    console.error('[Phase 2] Enrichment failed:', err);
  }

  console.log('[collect-enrich] Done');
}

main().catch(console.error);
