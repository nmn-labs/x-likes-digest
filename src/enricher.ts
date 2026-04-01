import Anthropic from '@anthropic-ai/sdk';
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import { getDb } from './db.js';
import { loadConfig } from './config.js';
import type { Like } from './types.js';

let config: ReturnType<typeof loadConfig> | null = null;

function getConfig() {
  if (!config) {
    try {
      config = loadConfig();
    } catch {
      // Config not fully set up — will skip APIs that need it
    }
  }
  return config;
}

export async function enrichLikes(): Promise<void> {
  const db = getDb();
  const likes = db.prepare('SELECT * FROM likes WHERE processed = 0').all() as Like[];

  if (likes.length === 0) {
    console.log('[enricher] No unprocessed likes.');
    return;
  }

  console.log(`[enricher] Processing ${likes.length} likes...`);

  for (const like of likes) {
    try {
      await enrichSingle(db, like);
    } catch (err) {
      console.error(`[enricher] Failed to enrich tweet ${like.tweet_id}:`, err);
    }
  }
}

async function enrichSingle(db: ReturnType<typeof getDb>, like: Like): Promise<void> {
  const updates: Record<string, string | number | null> = { processed: 1 };

  // Article enrichment
  if (like.has_article) {
    try {
      const content = await fetchArticleContent(like.tweet_id);
      if (content) {
        updates.article_content = content;
      }
    } catch (err) {
      console.warn(`[enricher] Article fetch failed for ${like.tweet_id}:`, err);
    }
  }

  // Link enrichment
  if (like.has_link && like.link_urls) {
    try {
      const urls = parseUrls(like.link_urls);
      if (urls.length > 0) {
        const summary = await fetchLinkSummary(urls[0]);
        if (summary) {
          updates.link_summary = summary;
        }
      }
    } catch (err) {
      console.warn(`[enricher] Link fetch failed for ${like.tweet_id}:`, err);
    }
  }

  // Image enrichment
  if (like.has_media && like.media_urls) {
    try {
      const urls = parseUrls(like.media_urls);
      const imageUrls = urls.filter(u => /\.(jpg|jpeg|png|gif|webp)/i.test(u) || u.includes('pbs.twimg.com'));
      if (imageUrls.length > 0) {
        const description = await describeImages(imageUrls);
        if (description) {
          updates.image_description = description;
        }
      }
    } catch (err) {
      console.warn(`[enricher] Image analysis failed for ${like.tweet_id}:`, err);
    }
  }

  // Update DB
  const setClauses = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE likes SET ${setClauses} WHERE tweet_id = @tweet_id`).run({
    ...updates,
    tweet_id: like.tweet_id,
  });

  console.log(`[enricher] Processed ${like.tweet_id}`);
}

async function fetchArticleContent(tweetId: string): Promise<string | null> {
  const cfg = getConfig();
  if (!cfg?.twitterapi_io_key) {
    console.warn('[enricher] TWITTERAPI_IO_KEY not set, skipping article fetch');
    return null;
  }

  const res = await fetch(`https://api.twitterapi.io/api/twitter/article?tweetId=${tweetId}`, {
    headers: { 'x-api-key': cfg.twitterapi_io_key },
  });

  if (!res.ok) {
    throw new Error(`twitterapi.io article fetch failed: ${res.status}`);
  }

  const data = await res.json() as { content?: string; text?: string };
  return data.content ?? data.text ?? null;
}

async function fetchLinkSummary(url: string): Promise<string | null> {
  // Skip twitter/x URLs
  if (/twitter\.com|x\.com/i.test(url)) return null;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; x-likes-digest/1.0)' },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`Link fetch failed: ${res.status}`);

  const html = await res.text();
  const { document } = parseHTML(html);
  const reader = new Readability(document as unknown as Document);
  const article = reader.parse();

  if (!article?.textContent) return null;
  return article.textContent.trim().slice(0, 2000);
}

async function describeImages(imageUrls: string[]): Promise<string | null> {
  const cfg = getConfig();
  if (!cfg?.anthropic_api_key) {
    console.warn('[enricher] ANTHROPIC_API_KEY not set, skipping image analysis');
    return null;
  }

  const client = new Anthropic({ apiKey: cfg.anthropic_api_key });

  const imageContents: Anthropic.ImageBlockParam[] = [];

  for (const url of imageUrls.slice(0, 4)) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;

      const buffer = await res.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const contentType = res.headers.get('content-type') ?? 'image/jpeg';
      const mediaType = contentType.split(';')[0].trim() as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

      imageContents.push({
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: base64 },
      });
    } catch (err) {
      console.warn(`[enricher] Image download failed for ${url}:`, err);
    }
  }

  if (imageContents.length === 0) return null;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: [
          ...imageContents,
          { type: 'text', text: 'Briefly describe what is shown in these images in 1-2 sentences.' },
        ],
      },
    ],
  });

  const textBlock = message.content.find(b => b.type === 'text');
  return textBlock?.type === 'text' ? textBlock.text : null;
}

function parseUrls(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(u => typeof u === 'string');
  } catch {
    // fall through
  }
  return raw.split(',').map(u => u.trim()).filter(Boolean);
}
