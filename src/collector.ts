import { TwitterApi } from 'twitter-api-v2';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import path from 'path';
import { getDb } from './db.js';
import { loadConfig } from './config.js';
import type { Config } from './types.js';

const ARTICLE_DOMAINS = [
  'medium.com', 'substack.com', 'note.com', 'zenn.dev', 'qiita.com',
  'dev.to', 'techcrunch.com', 'wired.com', 'theverge.com', 'arstechnica.com',
  'nytimes.com', 'washingtonpost.com', 'bloomberg.com', 'reuters.com',
  'github.com', 'arxiv.org', 'papers.ssrn.com',
];

function isArticleUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return ARTICLE_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

function isTwitterUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return hostname === 'twitter.com' || hostname === 'x.com' || hostname === 't.co';
  } catch {
    return true; // skip unknown
  }
}

async function refreshTokens(config: Config): Promise<{ accessToken: string; refreshToken: string; client: TwitterApi }> {
  const appClient = new TwitterApi({ clientId: config.x_client_id, clientSecret: config.x_client_secret });
  const result = await appClient.refreshOAuth2Token(config.x_refresh_token);
  const newAccessToken = result.accessToken;
  const newRefreshToken = result.refreshToken ?? config.x_refresh_token;

  // Write tokens back to .env
  const envPath = path.resolve(process.cwd(), '.env');
  if (existsSync(envPath)) {
    let envContent = readFileSync(envPath, 'utf-8');
    envContent = envContent.replace(/^X_ACCESS_TOKEN=.*$/m, `X_ACCESS_TOKEN=${newAccessToken}`);
    if (newRefreshToken !== config.x_refresh_token) {
      envContent = envContent.replace(/^X_REFRESH_TOKEN=.*$/m, `X_REFRESH_TOKEN=${newRefreshToken}`);
    }
    writeFileSync(envPath, envContent, 'utf-8');
  }

  return { accessToken: newAccessToken, refreshToken: newRefreshToken, client: result.client };
}

export async function collectLikes(): Promise<void> {
  let config: Config;
  try {
    config = loadConfig();
  } catch (err) {
    console.log('[collector] API not configured, skipping:', (err as Error).message);
    return;
  }

  const db = getDb();
  let userClient: TwitterApi;

  // Try to refresh tokens first for a fresh access token
  try {
    const refreshed = await refreshTokens(config);
    userClient = refreshed.client;
    console.log('[collector] Tokens refreshed successfully');
  } catch (err) {
    console.warn('[collector] Token refresh failed, using existing access token:', (err as Error).message);
    userClient = new TwitterApi(config.x_access_token);
  }

  const getSyncState = db.prepare<[string], { last_tweet_id: string | null }>(
    'SELECT last_tweet_id FROM sync_state WHERE account = ?'
  );
  const upsertSyncState = db.prepare(
    `INSERT INTO sync_state (account, last_tweet_id, last_sync_at)
     VALUES (?, ?, ?)
     ON CONFLICT(account) DO UPDATE SET last_tweet_id = excluded.last_tweet_id, last_sync_at = excluded.last_sync_at`
  );
  const insertLike = db.prepare(
    `INSERT OR IGNORE INTO likes
     (tweet_id, account, author_username, author_name, text, created_at, liked_at,
      has_media, has_link, has_article, media_urls, link_urls, raw_json)
     VALUES
     (@tweet_id, @account, @author_username, @author_name, @text, @created_at, @liked_at,
      @has_media, @has_link, @has_article, @media_urls, @link_urls, @raw_json)`
  );

  for (const userId of config.x_user_ids) {
    console.log(`[collector] Collecting likes for user ${userId}`);
    try {
      // Note: X API v2 userLikedTweets does NOT support since_id parameter
      // We fetch recent likes and rely on INSERT OR IGNORE for dedup
      // Stop early once we hit tweets we already have (consecutive dupes)
      const paginator = await userClient.v2.userLikedTweets(userId, {
        max_results: 100,
        'tweet.fields': ['created_at', 'author_id', 'attachments', 'entities', 'text'],
        'media.fields': ['url', 'preview_image_url', 'type'],
        'user.fields': ['username', 'name'],
        expansions: ['attachments.media_keys', 'author_id'],
      });

      let newestId: string | null = null;
      let totalInserted = 0;
      let consecutiveDupes = 0;
      const MAX_CONSECUTIVE_DUPES = 10; // Stop after 10 consecutive existing tweets

      for await (const tweet of paginator) {
        const includes = paginator.includes;
        const mediaKeys = tweet.attachments?.media_keys ?? [];
        const mediaItems = mediaKeys
          .map(key => includes?.media?.find(m => m.media_key === key))
          .filter(Boolean);

        const mediaUrls: string[] = mediaItems
          .map(m => m!.url ?? m!.preview_image_url ?? '')
          .filter(Boolean);

        const expandedUrls: string[] = (tweet.entities?.urls ?? [])
          .map(u => u.expanded_url)
          .filter(u => !isTwitterUrl(u));

        const hasMedia = mediaUrls.length > 0;
        const hasLink = expandedUrls.length > 0;
        const hasArticle = expandedUrls.some(isArticleUrl);

        const authorUser = includes?.users?.find(u => u.id === tweet.author_id);

        const row = {
          tweet_id: tweet.id,
          account: userId,
          author_username: authorUser?.username ?? null,
          author_name: authorUser?.name ?? null,
          text: tweet.text ?? null,
          created_at: tweet.created_at ?? null,
          liked_at: new Date().toISOString(),
          has_media: hasMedia ? 1 : 0,
          has_link: hasLink ? 1 : 0,
          has_article: hasArticle ? 1 : 0,
          media_urls: mediaUrls.length ? JSON.stringify(mediaUrls) : null,
          link_urls: expandedUrls.length ? JSON.stringify(expandedUrls) : null,
          raw_json: JSON.stringify(tweet),
        };

        const result = insertLike.run(row);
        if (result.changes > 0) {
          totalInserted++;
          consecutiveDupes = 0; // Reset on new insert
        } else {
          consecutiveDupes++;
          if (consecutiveDupes >= MAX_CONSECUTIVE_DUPES) {
            console.log(`[collector] Hit ${MAX_CONSECUTIVE_DUPES} consecutive existing tweets, stopping pagination`);
            break;
          }
        }

        // Track the newest tweet id (first tweet in timeline = newest)
        if (!newestId) newestId = tweet.id;
      }

      if (newestId) {
        upsertSyncState.run(userId, newestId, new Date().toISOString());
      }

      console.log(`[collector] User ${userId}: inserted ${totalInserted} new likes`);
    } catch (err) {
      const errMsg = (err as Error).message;
      console.error(`[collector] Error collecting likes for user ${userId}:`, errMsg);

      // Alert on credit depletion (402) or auth issues (401/403)
      if (errMsg.includes('402') || errMsg.includes('CreditsDepleted')) {
        await sendAlert(`⚠️ X API クレジット枯渇\n\nユーザー ${userId} のいいね取得で402エラー。\nX Developer Portalでクレジットを追加してください。\n\nhttps://developer.x.com/`);
      } else if (errMsg.includes('401') || errMsg.includes('403')) {
        await sendAlert(`🔴 X API 認証エラー\n\nユーザー ${userId} のトークンが無効です。\nOAuth再認証が必要かもしれません。`);
      }
    }
  }

  console.log('[collector] Done');
}

async function sendAlert(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.ALERT_CHAT_ID || '293996812'; // しんごさんのDM

  if (!token) {
    console.error('[collector] TELEGRAM_BOT_TOKEN not set, cannot send alert');
    return;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });
    if (res.ok) {
      console.log('[collector] Alert sent to Telegram');
    } else {
      console.error('[collector] Failed to send alert:', await res.text());
    }
  } catch (err) {
    console.error('[collector] Alert send error:', err);
  }
}
