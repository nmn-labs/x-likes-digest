# X Likes Digest

An [OpenClaw](https://github.com/openclaw/openclaw) skill that delivers a daily AI-curated digest of your X (Twitter) liked posts — categorized, summarized, and with personalized recommendations.

## ✨ Features

- **Auto-categorization** — Crypto, AI/Tech, Art, Business, Fashion, NSFW, and more
- **Smart summaries** — AI-generated summaries for posts, articles, and external links
- **Image analysis** — Automatic SFW/NSFW classification via vision AI
- **Recommendations** — Interest-based post discovery with feedback learning loop
- **Multi-channel delivery** — Telegram, Discord, Slack, LINE
- **Volume handling** — Normal/split/light modes based on daily like count

## 📐 Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  X Official  │────▶│  Data Collector   │────▶│    SQLite DB      │
│     API      │     │  (VPS, Node.js)   │     │  (likes, recs)    │
└─────────────┘     └──────────────────┘     └────────┬─────────┘
                                                       │
                    ┌──────────────────┐               │
                    │  twitterapi.io   │◀──────────────┤
                    │  (articles,      │               │
                    │   search)        │     ┌─────────▼─────────┐
                    └──────────────────┘     │  OpenClaw Agent    │
                                             │  (this skill)      │
                                             │  - Categorize      │
                                             │  - Summarize       │
                                             │  - Recommend       │
                                             └─────────┬─────────┘
                                                       │
                                      ┌────────────────┼────────────────┐
                                      ▼                ▼                ▼
                                 Telegram          Discord           Slack
```

## 🚀 Quick Start

### 1. Install the skill

```bash
openclaw skill add nmn-labs/x-likes-digest
```

### 2. Deploy the data collector on your VPS

```bash
git clone https://github.com/nmn-labs/x-likes-digest-collector.git
cd x-likes-digest-collector
npm install
npx tsx src/init-db.ts
npx tsx src/auth-setup.ts  # OAuth flow in browser
```

### 3. Set up cron jobs

```bash
# Daily digest at 8:30 JST
openclaw cron add --name x-likes-digest \
  --schedule "30 8 * * *" --tz Asia/Tokyo \
  --message "Run x-likes-digest skill in digest mode. Config: ssh_host=myserver, vps_project_path=/home/user/x-likes-digest, telegram_channel_id=-100xxx" \
  --channel telegram --timeout 900

# Daily recommendations at 8:45 JST
openclaw cron add --name x-likes-digest-recommend \
  --schedule "45 8 * * *" --tz Asia/Tokyo \
  --message "Run x-likes-digest skill in recommend mode. Config: ssh_host=myserver, vps_project_path=/home/user/x-likes-digest, telegram_channel_id=-100xxx, recommend_count=12" \
  --channel telegram --timeout 600
```

## ⚙️ Configuration

| Parameter | Required | Description |
|-----------|----------|-------------|
| `ssh_host` | ✅ | SSH alias for VPS |
| `vps_project_path` | ✅ | Path to collector on VPS |
| `telegram_channel_id` | ✅ | Telegram channel for delivery |
| `twitterapi_key` | ✅ | twitterapi.io API key (env var) |
| `delivery_channels` | | `["telegram"]`, `["telegram", "discord"]`, etc. |
| `discord_channel_id` | | Discord channel ID |
| `slack_channel_id` | | Slack channel name |
| `line_user_id` | | LINE User ID |
| `recommend_count` | | Number of recommendations (default: 12) |

## 📊 Modes

### Digest Mode

Collects new likes → enriches with article/link content → categorizes → summarizes → delivers.

**Volume handling:**
| Likes | Mode | Behavior |
|-------|------|----------|
| 0 | — | "No new likes" message |
| 1–30 | Normal | Full processing (articles, links, images) |
| 31–60 | Split | Process oldest 30, remainder next day |
| 61+ | Light | Text-only summaries, skip web/image analysis |

### Recommend Mode

Updates feedback from previous recommendations → builds interest profile → searches for new posts → scores and filters → delivers personalized recommendations.

The recommendation engine learns from your behavior: posts you like after being recommended boost related keywords, while ignored recommendations reduce weight.

## 📂 Categories

| Emoji | Category | Criteria |
|-------|----------|----------|
| 💰 | Crypto / Web3 | Cryptocurrency, blockchain, DeFi |
| 🤖 | AI / Tech | AI, programming, tools |
| 📝 | X Articles | `x.com/i/article/` format |
| 🎨 | SFW Art | Illustrations, fan art |
| 💼 | Biz / Marketing | Business, startups |
| 👟 | Fashion | Fashion, coordination |
| 🈲 | NSFW | Sexy content |
| 📦 | Other | Everything else |

## 💰 Cost

Estimated monthly cost: **$2–4**

| Item | Volume | Cost |
|------|--------|------|
| X Official API (likes) | ~900/month | ~$1–3 |
| twitterapi.io (articles) | ~50/month | ~$0.75 |
| twitterapi.io (search) | ~30 queries/month | ~$0.10 |

## 📁 Structure

```
x-likes-digest/
├── SKILL.md                  # Skill definition (agent instructions)
├── README.md                 # This file
├── LICENSE                   # MIT License
└── references/
    ├── setup-guide.md        # VPS setup & DB schema
    └── spec.md               # Technical specification
```

## 🤝 Contributing

Issues and PRs welcome. This skill is designed for [OpenClaw](https://github.com/openclaw/openclaw) — an open-source AI agent platform.

## 📄 License

MIT
