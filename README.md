# X Likes Digest

X Likes Digest — OpenClaw skill + VPS collector for personalized X/Twitter digest and recommendations.

Collects your liked tweets from X, enriches and summarizes them with AI, then delivers a daily digest and smart recommendations via Telegram.

---

## OpenClaw Skill

The `SKILL.md` in this repo is an [OpenClaw](https://github.com/openclaw) skill that drives the digest and recommend workflows from the AI assistant.

See [`SKILL.md`](./SKILL.md) and [`references/`](./references/) for full usage instructions.

---

## VPS Collector Setup

The `src/` directory contains a TypeScript collector that runs on your VPS to fetch and enrich liked tweets.

### Requirements

- Node.js 18+
- A VPS (or any server) with cron support
- X (Twitter) API credentials
- Telegram bot token + chat ID

### Install

```bash
npm install
npm run build
```

### Configure

Copy `.env.example` to `.env` and fill in:

```bash
# X / TwitterAPI.io
TWITTER_API_KEY=your_twitterapiio_key
TWITTER_USERNAME=your_x_username

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# OpenClaw (for recommend mode)
OPENCLAW_API_KEY=your_openclaw_key
```

### Run manually

```bash
node dist/index.js
```

### Cron (daily at 8am JST)

```cron
0 8 * * * cd /path/to/x-likes-digest && node dist/index.js >> data/digest.log 2>&1
```

---

## Data

Collected data is stored in `data/` (SQLite). This directory is gitignored.
