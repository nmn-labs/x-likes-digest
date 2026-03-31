---
name: x-likes-digest
description: >-
  Daily digest of X (Twitter) liked posts with AI-powered categorization, summarization, and personalized recommendations.
  Use when: (1) setting up automated daily X likes digests, (2) generating categorized summaries of liked tweets,
  (3) building interest-based tweet recommendations from like history, (4) delivering curated content digests to Telegram/Discord/Slack channels.
  Supports two modes: digest (collect→categorize→summarize→deliver) and recommend (feedback→search→score→deliver).
  Requires: twitterapi.io API key, a VPS/server running the x-likes-digest data collector, SSH access, and a Telegram bot.
---

# X Likes Digest

Automated daily digest of X (Twitter) liked posts with AI categorization and personalized recommendations.

## Architecture

```
X Official API → Collector (VPS, cron) → SQLite DB
                                            ↓
twitterapi.io (article/search) ←→ OpenClaw Agent (this skill)
                                            ↓
                                   Telegram / LINE delivery
```

- **Data collector**: Node.js app on an always-on machine (VPS, home server, or local), exports new likes via `export-data.ts`
- **This skill**: Agent-side processing — categorization, summarization, image handling, recommendation, delivery

## Prerequisites

1. **Always-on machine with x-likes-digest collector deployed** — VPS (recommended), home server, or a Mac/PC that stays powered on. See `references/setup-guide.md`
2. **twitterapi.io API key** — stored in env var `$TWITTERAPI_KEY` on the collector machine
3. **Telegram bot** — with access to target channel
4. **Access to collector DB** — either via SSH (remote) or direct file path (local)

### Deployment Options

| Setup | Collector runs on | Agent accesses DB via | `ssh_host` | `local_db_path` |
|-------|-------------------|----------------------|------------|-----------------|
| **Remote (VPS)** | VPS / cloud server | SSH | Required | — |
| **Local** | Same machine as OpenClaw | Direct file path | — | Required |

- **Remote (recommended)**: Collector runs 24/7 on a VPS. Agent uses SSH to read the DB and run export scripts. Set `ssh_host` and `vps_project_path`.
- **Local**: Collector runs on the same machine as OpenClaw. No SSH needed. Set `local_db_path` to the absolute path of your collector directory instead of `ssh_host`/`vps_project_path`.

> ⚠️ The collector needs to run daily (via system cron or similar). If your machine sleeps or shuts down, likes won't be collected for that day.

## Configuration

Set these in your cron job or pass as context:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `ssh_host` | SSH alias for remote server (remote mode) | `your-server` |
| `vps_project_path` | Path to collector on remote server (remote mode) | `/home/user/projects/x-likes-digest` |
| `local_db_path` | Absolute path to collector directory (local mode) | `/Users/you/x-likes-digest-collector` |
| `telegram_channel_id` | Telegram channel for delivery | `-100xxxxxxxxxx` |
| `twitterapi_key` | twitterapi.io API key (use env var) | `$TWITTERAPI_KEY` |
| `delivery_channels` | Target channels (optional) | `["telegram"]` or `["telegram", "discord", "slack"]` |
| `discord_channel_id` | Discord channel ID (if Discord enabled) | `1234567890` |
| `slack_channel_id` | Slack channel (if Slack enabled) | `#digest` |
| `line_user_id` | LINE User ID (⚠️ LINE delivery not yet stable) | `Uxxxx` |
| `recommend_count` | Number of recommendations | `12` |
| `categories` | Custom category list (optional, see below) | `[{emoji, name, criteria}]` |

### Category Modes

**Default: Auto-categorize (no `categories` set)**

The agent analyzes post content and automatically assigns categories based on the actual topics found.
Rules for auto-categorization:
- Analyze all posts first, then identify 5–10 natural groupings
- Each category gets an appropriate emoji and short label
- X Articles (`x.com/i/article/` format) are always a separate 📝 category
- NSFW detection (from Step 4) always creates a 🈲 category if applicable
- Avoid "Other" — every post should fit a meaningful category
- Keep category names concise (2–3 words max)

**Custom: Fixed categories (`categories` set)**

When `categories` is provided in config, use the specified categories instead of auto-detection.

Format:
```json
[
  {"emoji": "💰", "name": "Crypto / Web3", "criteria": "Cryptocurrency, blockchain, DeFi, trading"},
  {"emoji": "🤖", "name": "AI / Tech", "criteria": "AI, programming, tools, automation"},
  {"emoji": "📦", "name": "Other", "criteria": "Everything else"}
]
```

Posts that don't match any custom category go to the last entry (typically "Other").

## ⚠️ API Cost Safety

twitterapi.io is a **paid API** (~$0.015/request). To avoid accidental overspending:

1. **Always check unique count first** — After fetching page 1, verify the number of unique tweet IDs. If duplicates exceed 50%, stop pagination immediately.
2. **Set max pages** — Never paginate beyond 5 pages in a single run. If more data is needed, process across multiple days.
3. **Prefer `last_tweets` over `advanced_search`** — `last_tweets` is cheaper and sufficient for like collection.
4. **Monitor cursor values** — If the same `next_cursor` is returned twice, stop immediately (infinite loop).
5. **Test with small batches** — When modifying search queries, always test with 1 page first and verify results before running full collection.

Lesson learned: A pagination bug once consumed $9 in API credits by fetching the same data 6,500+ times. Always validate before scaling.

## Cron Setup

Two cron jobs, one skill. Example OpenClaw cron commands:

```bash
# Digest — daily at 8:30 JST
openclaw cron add --name x-likes-digest \
  --schedule "30 8 * * *" --tz Asia/Tokyo \
  --message "Run x-likes-digest skill in digest mode. Config: ssh_host=your-server, vps_project_path=/home/user/projects/x-likes-digest, telegram_channel_id=-100xxx, delivery_channels=[telegram]" \
  --channel telegram --timeout 900

# Recommend — daily at 8:45 JST
openclaw cron add --name x-likes-digest-recommend \
  --schedule "45 8 * * *" --tz Asia/Tokyo \
  --message "Run x-likes-digest skill in recommend mode. Config: ssh_host=your-server, vps_project_path=/home/user/projects/x-likes-digest, telegram_channel_id=-100xxx, recommend_count=12, delivery_channels=[telegram]" \
  --channel telegram --timeout 600
```

---

## Mode: Digest

Execute steps 1–6 in order. No skipping.

### Step 1: Data Export

**Remote mode** (when `ssh_host` is set):
```bash
ssh {ssh_host} "cd {vps_project_path} && npx tsx src/export-data.ts 2>/dev/null"
```

**Local mode** (when `local_db_path` is set):
```bash
cd {local_db_path} && npx tsx src/export-data.ts 2>/dev/null
```

Check `new_likes_count`:
- **0**: Send "本日の新しいいいねはありません" and stop
- **1–30**: Normal mode (full processing)
- **31–60**: Split mode (oldest 30 only, remainder tomorrow)
- **61+**: Light mode (skip web_fetch/image analysis, text-only summaries)

### Step 2: Article Retrieval (skip in light mode)

For posts where text is only `https://t.co/...` or under 50 chars with URL only:

```bash
curl -s "https://api.twitterapi.io/twitter/article?tweet_id={original_tweet_id}" \
  -H "x-api-key: {twitterapi_key}"
```

Extract `article.title`, `article.preview_text`, `article.contents[].text`.

### Step 3: External Link Retrieval (skip in light mode)

For posts with `link_urls`: use `web_fetch` to read link targets. Extract title + summary.

### Step 4: Image Analysis (skip in light mode)

For posts with `has_media=1`: analyze `media_urls` with `image` tool.
- Bikini/sexy/high exposure → 🈲 NSFW
- Otherwise → SFW

### Step 5: Categorize & Summarize

**If `categories` is set in config:** use those fixed categories (see Configuration → Category Modes).

**If `categories` is NOT set (default):** auto-categorize based on post content:
1. Read all posts from Step 1–4
2. Identify 5–10 natural topic groupings from the actual content
3. Assign each post to the most fitting category
4. 📝 X Articles (`x.com/i/article/`) and 🈲 NSFW (from Step 4) are always separate categories
5. Avoid "Other" — find a meaningful label for every post
6. Choose an appropriate emoji for each category

Summary rules:
- **X articles**: Article title + 200–400 char summary with key points/numbers/conclusions
- **External links**: Article title + 200–400 char summary
- **Normal posts**: 100–200 char detailed summary explaining what's interesting/new
- **Image-only**: Image analysis + author context (50+ chars)
- **High engagement**: Note if >10K views or >100 likes
- **Never guess** — write from source data only

### Step 6: Deliver

Send to all configured `delivery_channels`. Each channel gets identical content.

⚠️ **Message length limits vary by channel.** Split by category boundary if exceeded, add `(1/2)` etc.

| Channel | Char limit | Format |
|---------|-----------|--------|
| Telegram | 4096 | Markdown |
| Discord | 2000 | Markdown |
| Slack | 4000 | mrkdwn |
| LINE | 5000 | Plain text |

⚠️ **X image URLs (pbs.twimg.com) must be proxied** — direct send fails due to referer check:

**Remote mode:**
1. `ssh {ssh_host} 'curl -sL -o /tmp/ximg_{i}.jpg "{media_url}"'`
2. `scp {ssh_host}:/tmp/ximg_{i}.jpg /tmp/ximg_{i}.jpg`
3. Send via `message` tool with `filePath=/tmp/ximg_{i}.jpg`
4. Clean up tmp files on both sides

**Local mode:**
1. `curl -sL -o /tmp/ximg_{i}.jpg "{media_url}"`
2. Send via `message` tool with `filePath=/tmp/ximg_{i}.jpg`
3. Clean up tmp file

#### Message 1: Summary

```
📊 X Likes Digest — {YYYY/M/D}
━━━━━━━━━━━━━━━━━━
📌 新規いいね: {N}件

📂 カテゴリ内訳:
  {emoji} {category}: {count}件

🔥 注目トレンド:
1. {trend summary}
2. {trend summary}
3. {trend summary}
```

#### Message 2: Category Details

```
📋 カテゴリ別 詳細
━━━━━━━━━━━━━━━━━━

{emoji} {category}（{count}件）

1. @{author} — {one-line title}
   {detailed summary 100-200 chars}
   📎 https://x.com/{author}/status/{tweet_id}
   🔗 {external link if any}
```

For X articles: `@{author} — 📝記事「{article.title}」`

#### Message 3: Images

Send all `media_urls` images grouped by category (max 10/group for Telegram). Include NSFW.
If image download fails, send URL as text fallback.

### Step 7: Mark Digested (immediately after Step 6)

**Remote mode:**
```bash
ssh {ssh_host} "cd {vps_project_path} && npx tsx src/export-data.ts --mark-digested 2>/dev/null"
```

**Local mode:**
```bash
cd {local_db_path} && npx tsx src/export-data.ts --mark-digested 2>/dev/null
```

### Completion

Reply `NO_REPLY`. Do not send execution summaries anywhere.

---

## Mode: Recommend

Execute steps 1–5 in order.

### Step 1: Feedback Update

Evaluate previous day's recommendations against today's new likes:

**Remote mode:**
```bash
ssh {ssh_host} "cd {vps_project_path} && sqlite3 data/likes.db \"
SELECT tweet_id FROM recommendations WHERE recommended_date = date('now', '-1 day') AND was_liked IS NULL;\""
```

**Local mode:**
```bash
sqlite3 {local_db_path}/data/likes.db "
SELECT tweet_id FROM recommendations WHERE recommended_date = date('now', '-1 day') AND was_liked IS NULL;"
```

- Liked → `was_liked = 1`, keyword weight **+0.3**
- Not liked → `was_liked = 0`, keyword weight **-0.1**

Update author weights:
```sql
INSERT OR REPLACE INTO interest_profile (category, keyword, weight)
SELECT 'author', author_username, COUNT(*) * 0.5
FROM likes GROUP BY author_username HAVING COUNT(*) >= 3;
```

### Step 2: Interest Profile

**Remote mode:**
```bash
ssh {ssh_host} "cd {vps_project_path} && sqlite3 data/likes.db 'SELECT * FROM interest_profile ORDER BY weight DESC LIMIT 50'"
```

**Local mode:**
```bash
sqlite3 {local_db_path}/data/likes.db 'SELECT * FROM interest_profile ORDER BY weight DESC LIMIT 50'
```

If empty, build from all likes data (keyword frequency, author weights, category distribution).

### Step 3: Search

Generate 5–7 queries from top keywords × categories. Add `min_faves:50` for quality.

```bash
curl -s "https://api.twitterapi.io/twitter/tweet/advanced_search?query={query}&queryType=Latest" \
  -H "x-api-key: {twitterapi_key}"
```

### Step 4: Score & Filter

Score by: engagement (likes/RTs), relevance (keyword match), author weight (bonus for liked authors).
- **Max 3 per category** for diversity
- Exclude already-liked posts
- Select exactly `{recommend_count}` items (default: 12)

### Step 5: Deliver & Record

Send to all configured `delivery_channels`:

```
💡 おすすめポスト（{recommend_count}件）
━━━━━━━━━━━━━━━━━━

{emoji} {category}
1. {post summary}
   📌 {why recommended — which interest pattern matched}
   📎 {URL}
```

Record recommendations:
```sql
INSERT INTO recommendations (tweet_id, recommended_date, reason) VALUES ('{tweet_id}', date('now'), '{reason}');
```

### Completion

Reply `NO_REPLY`. Do not send execution summaries anywhere.

---

## Prohibitions

1. Never fabricate summaries — always use source data (except in light mode)
2. Never skip steps
3. Never alter the delivery format
4. Never output all accumulated data — only `digested=0` items
5. Never send cron execution summaries to any channel
6. Full web_fetch is OK — cron sessions have token headroom
