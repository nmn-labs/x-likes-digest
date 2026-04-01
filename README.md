# X Likes Digest

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node 20+](https://img.shields.io/badge/Node-20%2B-brightgreen.svg)](https://nodejs.org/)
[![OpenClaw Skill](https://img.shields.io/badge/OpenClaw-skill-blue.svg)](https://github.com/openclaw/openclaw)

**AI-powered daily digest and personalized recommendations for your X (Twitter) likes.**

Automatically collects your liked tweets, categorizes and summarizes them with an LLM, and delivers a curated digest plus smart recommendations to Telegram, Discord, or Slack — every day.

---

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                        Architecture                         │
│                                                             │
│   X Official API                                            │
│        │                                                    │
│        ▼                                                    │
│   Collector (VPS/local, cron)                               │
│        │  npm run collect                                   │
│        ▼                                                    │
│   SQLite DB  ←──────────── npm run export                  │
│        │                                                    │
│        ▼                                                    │
│   OpenClaw Agent  (SKILL.md)                                │
│        │  categorize · summarize · score · recommend        │
│        ▼                                                    │
│   Telegram / Discord / Slack                                │
└─────────────────────────────────────────────────────────────┘
```

**Two components:**

| Component | What it does | Where it runs |
|-----------|-------------|---------------|
| **Collector** (`src/`) | Fetches liked tweets from X API, stores in SQLite | VPS or local server (always-on) |
| **OpenClaw Skill** (`SKILL.md`) | LLM categorization, summarization, recommendations, delivery | OpenClaw agent |

---

## Key Features

- **🗂 Auto-categorization** — LLM groups posts into natural topic clusters (AI, Crypto, Dev Tools, etc.). Custom categories supported.
- **📝 Smart summarization** — Full article extraction for X Articles and external links. Detailed summaries, not just titles.
- **🧠 LLM interest profiling** — Builds a natural-language profile of your interests from like history. Refreshed weekly.
- **🎯 Scored recommendations** — Candidates scored 0–10 against your profile. Filters out anti-patterns learned from feedback.
- **🌀 Serendipity picks** — At least 2 recommendations from adjacent topics for unexpected discovery.
- **🔁 Feedback loop** — Checks which recommended posts you actually liked. Accumulates negative signals to improve future scoring.
- **📡 Multi-platform delivery** — Telegram, Discord, Slack via OpenClaw's channel system. Identical content, format-adapted per platform.

---

## Two Modes

### Digest Mode
Collects all new likes since the last run → categorizes → summarizes → delivers a structured digest.

```
📊 X Likes Digest — 2025/4/1
━━━━━━━━━━━━━━━━━━
📌 新規いいね: 24件

📂 カテゴリ内訳:
  🤖 AI / Dev: 9件
  💰 Crypto: 7件
  📝 Articles: 5件
  ...
```

### Recommend Mode
Analyzes your interest profile → searches twitterapi.io → scores candidates → delivers top picks with reasoning.

```
💡 おすすめポスト（12件）
━━━━━━━━━━━━━━━━━━

🤖 AI / Dev
1. @author — Post title
   100–200 char summary of what's interesting
   📌 Why: matches "AI agent infra" interest pattern
   🎯 スコア: 8.5/10
```

---

## Setup

### 1. VPS Collector

The collector runs on an always-on machine (VPS recommended) and fetches your likes daily.

```bash
# Clone and install
git clone https://github.com/nmn-labs/x-likes-digest.git
cd x-likes-digest
npm install

# Set up OAuth (one-time, requires browser)
npm run oauth:setup
# Follow the flow, then:
npm run oauth:exchange

# Test data collection
npm run collect

# Test export (what the OpenClaw agent reads)
npm run export
```

Copy `.env.example` to `.env`:

```env
# X OAuth 2.0 (from X Developer Portal)
TWITTER_CLIENT_ID=your_client_id
TWITTER_CLIENT_SECRET=your_client_secret
TWITTER_USERNAME=your_x_username

# twitterapi.io (for recommend mode and article fetch)
TWITTERAPI_KEY=your_twitterapiio_key
```

> See [`references/setup-guide.md`](./references/setup-guide.md) for full database init and OAuth details.

### 2. OpenClaw Skill

Install the skill into your OpenClaw instance:

```bash
openclaw skill add nmn-labs/x-likes-digest
```

Or clone locally and add by path:

```bash
openclaw skill add /path/to/x-likes-digest
```

### 3. Configure Cron

Add two cron jobs — one for digest, one for recommendations:

```bash
# Digest — daily at 8:30 JST
openclaw cron add --name x-likes-digest \
  --schedule "30 8 * * *" --tz Asia/Tokyo \
  --message "Run x-likes-digest skill in digest mode. Config: ssh_host=your-server, vps_project_path=/home/user/x-likes-digest, telegram_channel_id=-100xxx, delivery_channels=[telegram]" \
  --channel telegram --timeout 900

# Recommend — daily at 8:45 JST
openclaw cron add --name x-likes-digest-recommend \
  --schedule "45 8 * * *" --tz Asia/Tokyo \
  --message "Run x-likes-digest skill in recommend mode. Config: ssh_host=your-server, vps_project_path=/home/user/x-likes-digest, telegram_channel_id=-100xxx, recommend_count=12, delivery_channels=[telegram]" \
  --channel telegram --timeout 600
```

For **local mode** (collector on same machine as OpenClaw), use `local_db_path=/absolute/path/to/x-likes-digest` instead of `ssh_host`.

---

## Configuration Reference

Pass these in the cron `--message` or as context to the skill:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `ssh_host` | SSH alias for VPS (remote mode) | `my-vps` |
| `vps_project_path` | Collector path on VPS | `/home/user/x-likes-digest` |
| `local_db_path` | Collector path (local mode, no SSH) | `/Users/you/x-likes-digest` |
| `telegram_channel_id` | Telegram channel for delivery | `-100xxxxxxxxxx` |
| `delivery_channels` | Target platforms | `["telegram"]` or `["telegram","discord"]` |
| `discord_channel_id` | Discord channel ID | `1234567890` |
| `slack_channel_id` | Slack channel | `#digest` |
| `recommend_count` | Number of recommendations | `12` |
| `categories` | Fixed category list (optional) | `[{"emoji":"💰","name":"Crypto","criteria":"..."}]` |

**Multi-platform delivery** is powered by OpenClaw's channel system. Each enabled channel receives identical content formatted for its platform (Markdown for Telegram/Discord, mrkdwn for Slack).

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run collect` | Fetch and enrich new likes from X API |
| `npm run export` | Export undigested likes for the OpenClaw agent |
| `npm run recommend` | Run standalone recommender (debug) |
| `npm run oauth:setup` | Start OAuth 2.0 authorization flow |
| `npm run oauth:exchange` | Complete OAuth token exchange |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm run dev` | Run collector in dev mode (tsx, no build) |
| `npm start` | Run compiled collector |

---

## ⚠️ API Cost Safety

twitterapi.io is a **paid API** (~$0.015/request). The skill enforces guards:

- Max 7 search queries per recommend run, 1 page each
- Deduplication check before paginating
- Stops immediately on repeated cursors (loop detection)

> Always test with a single page before running full collection.

---

## Contributing

Contributions welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

Quick start:
1. Fork and create a feature branch: `git checkout -b feature/your-feature`
2. Test by installing your fork: `openclaw skill add <your-fork>/x-likes-digest`
3. Submit a PR with a CHANGELOG entry

---

## License

[MIT](./LICENSE) — © nmn-labs

---

---

# X Likes Digest（日本語）

**AIによるX（Twitter）いいね日次ダイジェスト & パーソナライズされたおすすめポスト配信ツール。**

いいねしたツイートを自動収集し、LLMでカテゴリ分類・要約したうえで、毎日Telegram/Discord/Slackへ配信。さらにあなたの興味プロフィールを学習して、関連ポストをスコアリング・推薦します。

---

## どう動くか

```
┌──────────────────────────────────────────────────────────┐
│                       アーキテクチャ                      │
│                                                          │
│   X公式API                                               │
│       │                                                  │
│       ▼                                                  │
│   コレクター（VPS/ローカル、cron）                        │
│       │  npm run collect                                 │
│       ▼                                                  │
│   SQLite DB  ←──────── npm run export                   │
│       │                                                  │
│       ▼                                                  │
│   OpenClaw Agent（SKILL.md）                             │
│       │  分類・要約・スコアリング・推薦                    │
│       ▼                                                  │
│   Telegram / Discord / Slack                             │
└──────────────────────────────────────────────────────────┘
```

**2つのコンポーネント：**

| コンポーネント | 役割 | 実行場所 |
|---|---|---|
| **コレクター**（`src/`） | X APIからいいねを取得してSQLiteに保存 | VPSまたはローカルサーバー（常時稼働） |
| **OpenClaw Skill**（`SKILL.md`） | LLMによる分類・要約・推薦・配信 | OpenClaw エージェント |

---

## 主な機能

- **🗂 自動カテゴリ分類** — LLMがコンテンツを分析し、自然なトピッククラスターに分類。カスタムカテゴリも設定可能。
- **📝 スマートな要約** — X記事・外部リンクの本文を取得して詳細に要約。タイトルだけの一行まとめは禁止。
- **🧠 LLM興味プロファイリング** — いいね履歴から自然言語の興味プロフィールを生成。毎週自動更新。
- **🎯 スコア付き推薦** — 候補ポストをプロフィールに対して0〜10でスコアリング。学習した「嫌いなパターン」を除外。
- **🌀 セレンディピティ枠** — 推薦の最低2件は隣接トピックから。思わぬ発見を促進。
- **🔁 フィードバックループ** — 推薦したポストを実際にいいねしたか判定し、ネガティブシグナルを蓄積。
- **📡 マルチプラットフォーム配信** — OpenClaw チャンネルシステム経由でTelegram・Discord・Slackへ配信。

---

## 2つのモード

### ダイジェストモード
未ダイジェストのいいねを収集 → カテゴリ分類 → 要約 → 構造化されたダイジェストを配信。

### レコメンドモード
興味プロファイルを分析 → twitterapi.io で検索 → スコアリング → 上位ポストを推薦理由付きで配信。

---

## セットアップ

### 1. VPS コレクター

```bash
git clone https://github.com/nmn-labs/x-likes-digest.git
cd x-likes-digest
npm install

# OAuth認証（初回のみ、ブラウザ必要）
npm run oauth:setup
npm run oauth:exchange

# 動作確認
npm run collect
npm run export
```

`.env.example` を `.env` にコピーして設定：

```env
TWITTER_CLIENT_ID=your_client_id
TWITTER_CLIENT_SECRET=your_client_secret
TWITTER_USERNAME=your_x_username
TWITTERAPI_KEY=your_twitterapiio_key
```

詳細なセットアップ手順は [`references/setup-guide.md`](./references/setup-guide.md) を参照。

### 2. OpenClaw Skill インストール

```bash
openclaw skill add nmn-labs/x-likes-digest
```

### 3. Cron 設定

```bash
# ダイジェスト — 毎日 8:30 JST
openclaw cron add --name x-likes-digest \
  --schedule "30 8 * * *" --tz Asia/Tokyo \
  --message "Run x-likes-digest skill in digest mode. Config: ssh_host=your-server, vps_project_path=/home/user/x-likes-digest, telegram_channel_id=-100xxx, delivery_channels=[telegram]" \
  --channel telegram --timeout 900

# レコメンド — 毎日 8:45 JST
openclaw cron add --name x-likes-digest-recommend \
  --schedule "45 8 * * *" --tz Asia/Tokyo \
  --message "Run x-likes-digest skill in recommend mode. Config: ssh_host=your-server, vps_project_path=/home/user/x-likes-digest, telegram_channel_id=-100xxx, recommend_count=12, delivery_channels=[telegram]" \
  --channel telegram --timeout 600
```

ローカルモード（OpenClaw と同一マシンで稼働）の場合は `ssh_host` の代わりに `local_db_path=/絶対パス/x-likes-digest` を指定。

---

## 設定パラメータ

| パラメータ | 説明 | 例 |
|---|---|---|
| `ssh_host` | VPSへのSSHエイリアス（リモートモード） | `my-vps` |
| `vps_project_path` | VPS上のコレクターパス | `/home/user/x-likes-digest` |
| `local_db_path` | ローカルのコレクターパス（ローカルモード） | `/Users/you/x-likes-digest` |
| `telegram_channel_id` | 配信先TelegramチャンネルID | `-100xxxxxxxxxx` |
| `delivery_channels` | 配信プラットフォーム | `["telegram","discord","slack"]` |
| `discord_channel_id` | DiscordチャンネルID | `1234567890` |
| `slack_channel_id` | Slackチャンネル | `#digest` |
| `recommend_count` | 推薦件数 | `12` |
| `categories` | 固定カテゴリ一覧（省略可） | `[{"emoji":"💰","name":"Crypto","criteria":"..."}]` |

---

## ライセンス

[MIT](./LICENSE) — © nmn-labs
