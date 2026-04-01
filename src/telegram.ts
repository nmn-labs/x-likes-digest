import fetch from 'node-fetch';
import type { Like } from './types.js';

interface RecItem {
  tweet_id: string;
  reason: string;
  author_username?: string;
  text?: string;
}

const MAX_MESSAGE_LENGTH = 4096;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatDigest(likes: Like[], date: string, recs: RecItem[] = []): string {
  // Group by category
  const groups = new Map<string, Like[]>();
  for (const like of likes) {
    const cat = like.category || '🔗 その他';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(like);
  }

  const lines: string[] = [`<b>📅 ${date} いいねダイジェスト</b>\n`];

  for (const [category, posts] of groups) {
    lines.push(`\n<b>${escapeHtml(category)}</b>`);
    for (const post of posts) {
      const author = post.author_username ? `@${escapeHtml(post.author_username)}` : '(unknown)';
      const summary = post.summary ? escapeHtml(post.summary) : escapeHtml(post.text?.slice(0, 100) || '');
      const url = `https://twitter.com/${post.author_username || 'i'}/status/${post.tweet_id}`;
      lines.push(`• <a href="${url}">${author}</a>: ${summary}`);
    }
  }

  // Recommendations
  if (recs.length > 0) {
    lines.push(`\n\n<b>💡 おすすめ</b>`);
    for (const rec of recs) {
      const author = rec.author_username ? '@' + escapeHtml(rec.author_username) : '(unknown)';
      const url = 'https://twitter.com/' + (rec.author_username || 'i') + '/status/' + rec.tweet_id;
      lines.push('\u2022 <a href="' + url + '">' + author + '</a>: ' + escapeHtml(rec.reason || ''));
    }
  }

  return lines.join('\n');
}

function splitMessage(text: string): string[] {
  if (text.length <= MAX_MESSAGE_LENGTH) return [text];

  const parts: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= MAX_MESSAGE_LENGTH) {
      parts.push(remaining);
      break;
    }
    // Split at last newline before limit
    let splitAt = remaining.lastIndexOf('\n', MAX_MESSAGE_LENGTH);
    if (splitAt <= 0) splitAt = MAX_MESSAGE_LENGTH;
    parts.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  return parts;
}

async function sendMessage(botToken: string, chatId: string, text: string): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram API error ${response.status}: ${body}`);
  }
}

export async function sendDigest(likes: Like[], date: string, recs: RecItem[] = []): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const channelId = process.env.TELEGRAM_CHANNEL_ID;

  if (!botToken || !channelId) {
    console.log('[telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL_ID not set, skipping.');
    return;
  }

  if (likes.length === 0) {
    console.log(`[telegram] No likes to send for ${date}.`);
    return;
  }

  const fullText = formatDigest(likes, date, recs);
  const parts = splitMessage(fullText);

  console.log(`[telegram] Sending ${parts.length} message(s) to ${channelId}...`);
  for (const part of parts) {
    await sendMessage(botToken, channelId, part);
  }
  console.log('[telegram] Done.');
}
