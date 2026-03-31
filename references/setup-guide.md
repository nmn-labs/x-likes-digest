# X Likes Digest — VPS Setup Guide

## Prerequisites

- Node.js 18+ on VPS
- X (Twitter) OAuth 2.0 credentials (Developer Portal)
- SQLite3
- SSH access from OpenClaw host

## Quick Setup

```bash
# Clone the data collector
git clone https://github.com/nmn-labs/x-likes-digest.git
cd x-likes-digest
npm install

# Initialize database
npx tsx src/init-db.ts

# Set up OAuth (one-time, requires browser)
npx tsx src/auth-setup.ts
# Follow the OAuth flow in browser to authorize X account access

# Test data export
npx tsx src/export-data.ts
```

## Database Schema

```sql
CREATE TABLE likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tweet_id TEXT UNIQUE NOT NULL,
  account TEXT NOT NULL,
  author_username TEXT,
  author_name TEXT,
  text TEXT,
  created_at TEXT,
  liked_at TEXT,
  has_media BOOLEAN DEFAULT FALSE,
  has_link BOOLEAN DEFAULT FALSE,
  has_article BOOLEAN DEFAULT FALSE,
  media_urls TEXT,        -- JSON array
  link_urls TEXT,          -- JSON array
  category TEXT,
  summary TEXT,
  image_description TEXT,
  link_summary TEXT,
  article_content TEXT,
  raw_json TEXT,
  digested BOOLEAN DEFAULT FALSE,
  processed BOOLEAN DEFAULT FALSE,
  created DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tweet_id TEXT NOT NULL,
  recommended_date TEXT NOT NULL,
  reason TEXT,
  was_liked BOOLEAN DEFAULT NULL,
  checked_at TEXT,
  created DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE interest_profile (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  keyword TEXT NOT NULL,
  weight REAL DEFAULT 1.0,
  last_updated TEXT,
  UNIQUE(category, keyword)
);
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TWITTERAPI_KEY` | twitterapi.io API key |
| `X_CLIENT_ID` | X OAuth 2.0 Client ID |
| `X_CLIENT_SECRET` | X OAuth 2.0 Client Secret |

## Data Collection

The collector runs via `export-data.ts`:
- Fetches new likes via X Official API (OAuth 2.0)
- Stores in SQLite with `digested=0`
- `--mark-digested` flag sets `digested=1` for processed likes

Set up a system cron to collect data before the OpenClaw digest cron runs:
```cron
# Collect likes at 8:00 JST (before 8:30 digest)
0 8 * * * cd /path/to/x-likes-digest && npx tsx src/export-data.ts >> /var/log/x-likes-digest.log 2>&1
```
