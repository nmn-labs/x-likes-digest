# X Likes Digest

An [OpenClaw](https://github.com/openclaw/openclaw) skill that delivers a daily AI-curated digest of your X (Twitter) liked posts — categorized, summarized, and with personalized recommendations.

## ✨ Features

- **Auto-categorization** — Crypto, AI/Tech, Art, Business, Fashion, NSFW, and more
- **Smart summaries** — AI-generated summaries for posts, articles, and external links
- **Image analysis** — Automatic SFW/NSFW classification via vision AI
- **Recommendations** — Interest-based post discovery with feedback learning loop
- **Multi-channel delivery** — Telegram, Discord, Slack
- **Volume handling** — Normal/split/light modes based on daily like count

## 📐 Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  X Official  │────▶│  Data Collector   │────▶│    SQLite DB      │
│     API      │     │  (Node.js)        │     │  (likes, recs)    │
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

### 2. Deploy the data collector

The collector runs on any always-on machine — **VPS** (recommended), home server, or even your local Mac/PC if it stays powered on.

> ⚠️ The collector must run daily via system cron. If the machine sleeps or shuts down, likes won't be collected that day.

```bash
git clone https://github.com/nmn-labs/x-likes-digest-collector.git
cd x-likes-digest-collector
npm install
npx tsx src/init-db.ts
npx tsx src/auth-setup.ts  # OAuth flow in browser
```

### 3. Set up cron jobs

**Remote setup** (collector on VPS/server):
```bash
openclaw cron add --name x-likes-digest \
  --schedule "30 8 * * *" --tz Asia/Tokyo \
  --message "Run x-likes-digest skill in digest mode. Config: ssh_host=myserver, vps_project_path=/home/user/x-likes-digest, telegram_channel_id=-100xxx" \
  --channel telegram --timeout 900

openclaw cron add --name x-likes-digest-recommend \
  --schedule "45 8 * * *" --tz Asia/Tokyo \
  --message "Run x-likes-digest skill in recommend mode. Config: ssh_host=myserver, vps_project_path=/home/user/x-likes-digest, telegram_channel_id=-100xxx, recommend_count=12" \
  --channel telegram --timeout 600
```

**Local setup** (collector on the same machine):
```bash
openclaw cron add --name x-likes-digest \
  --schedule "30 8 * * *" --tz Asia/Tokyo \
  --message "Run x-likes-digest skill in digest mode. Config: local_db_path=/Users/you/x-likes-digest-collector, telegram_channel_id=-100xxx" \
  --channel telegram --timeout 900
```

## ⚙️ Configuration

| Parameter | Required | Description |
|-----------|----------|-------------|
| `ssh_host` | ✅* | SSH alias for remote server (remote mode) |
| `vps_project_path` | ✅* | Path to collector on remote server (remote mode) |
| `local_db_path` | ✅* | Absolute path to collector directory (local mode) |

> *Either `ssh_host` + `vps_project_path` (remote) **or** `local_db_path` (local) is required.
| `telegram_channel_id` | ✅ | Telegram channel for delivery |
| `twitterapi_key` | ✅ | twitterapi.io API key (env var) |
| `delivery_channels` | | `["telegram"]`, `["telegram", "discord"]`, etc. |
| `discord_channel_id` | | Discord channel ID |
| `slack_channel_id` | | Slack channel name |
| `line_user_id` | | LINE User ID (⚠️ not yet stable) |
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

## 📋 Sample Output

### Digest

```
📊 X Likes Digest — 2026/3/30
━━━━━━━━━━━━━━━━━━
📌 新規いいね: 37件

📂 カテゴリ内訳:
  💰 Crypto / Web3: 12件
  🤖 AI / Tech: 8件
  🎨 SFW Art: 5件
  📦 Other: 12件

🔥 注目トレンド:
1. Bitcoin ETF inflows hit record $1.2B — institutional momentum accelerating
2. Claude 4 benchmarks show 40% improvement in coding tasks
3. New DeFi protocol launches with novel ve-tokenomics model
```

```
📋 カテゴリ別 詳細
━━━━━━━━━━━━━━━━━━

💰 Crypto / Web3（12件）

1. @crypto_analyst — Bitcoin ETF Weekly Flows
   BlackRockのiSharesが$800M超の純流入を記録。累計AUMは$50Bに到達。
   機関投資家の参入ペースが加速しており、2026年Q2の展望に注目。
   📎 https://x.com/crypto_analyst/status/123456789

🤖 AI / Tech（8件）

1. @ai_researcher — 📝記事「Claude 4 Benchmark Analysis」
   コーディング・数学・推論の3領域で前世代比40%改善。特にmulti-step
   reasoningでの精度向上が顕著。ベンチマーク詳細と実用面での考察。
   📎 https://x.com/ai_researcher/status/987654321
```

### Recommend

```
💡 おすすめポスト（12件）
━━━━━━━━━━━━━━━━━━

💰 Crypto / Web3
1. Solana DEX volume surpasses Ethereum for third consecutive week
   📌 あなたのDeFi・DEX関連のいいね傾向にマッチ
   📎 https://x.com/defi_watcher/status/111222333

🤖 AI / Tech
1. Open-source alternative to Cursor IDE gains 10K GitHub stars in 48h
   📌 AI×開発ツール系の記事を頻繁にいいね
   📎 https://x.com/oss_news/status/444555666
```

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
