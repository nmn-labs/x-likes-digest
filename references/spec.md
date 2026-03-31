# X Likes Digest — Specification v1

## Overview

Automated daily collection and summarization of X (Twitter) liked posts, delivered as a categorized digest with personalized recommendations.

## Data Flow

### Phase 1: Collection (VPS cron, before digest)
- X Official API `GET /2/users/:id/liked_tweets` (OAuth 2.0 PKCE)
- Store in SQLite with `digested=0`

### Phase 2: Enrichment (OpenClaw agent, digest mode)
- X articles → twitterapi.io article API
- External links → web_fetch
- Images → Vision AI analysis (NSFW detection)

### Phase 3: Categorization & Summarization (OpenClaw agent)
- AI-powered category assignment
- Per-post detailed summaries
- Trend identification

### Phase 4: Recommendation (OpenClaw agent, recommend mode)
- Interest profile from like history
- twitterapi.io advanced search
- Engagement + relevance scoring
- Feedback loop (liked recommendations boost weights)

### Phase 5: Delivery
- Telegram channel (primary)
- LINE DM (optional)
- 4-message structure: Summary → Details → Images → Recommendations

## Cost Estimate (Monthly)

| Item | Volume | Cost |
|------|--------|------|
| X Official API (likes) | ~900/month | ~$1-3 |
| twitterapi.io (articles) | ~50/month | ~$0.75 |
| twitterapi.io (search) | ~30 queries/month | ~$0.10 |
| Claude API (summarization) | ~30 runs/month | Included |
| **Total** | | **~$2-4/month** |
