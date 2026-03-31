# Changelog

## [1.2.0] - 2026-03-31

### Added
- `local_db_path` config parameter for local deployment (no SSH required)
- Local mode instructions for all steps (data export, image proxy, mark-digested, recommend)
- Deployment options table (Remote vs Local) in Prerequisites

### Changed
- Category mode: default is now **auto-categorize** (AI analyzes content and creates categories dynamically)
- Custom fixed categories available via `categories` config parameter
- Removed hardcoded category table from Step 5
- Updated Architecture description: "VPS" → "always-on machine (VPS, home server, or local)"

## [1.1.0] - 2026-03-31

### Added
- CONTRIBUTING.md with development guidelines
- GitHub Issue templates (bug report, feature request)
- Pull Request template
- GitHub Actions CI workflow (file validation, secret detection, link check)

## [1.0.0] — 2026-03-31

### Added
- Initial release
- Digest mode: collect → enrich → categorize → summarize → deliver
- Recommend mode: feedback → profile → search → score → deliver
- Multi-channel delivery: Telegram, Discord, Slack
- Volume handling: normal / split / light modes
- Image proxy for X media URLs
- Interest-based recommendation engine with feedback loop
- 8 content categories with emoji indicators
- VPS setup guide and database schema
- API Cost Safety section with pagination safeguards
- Sample output examples in README (digest + recommend)

### Changed
- Generalized SSH host examples (`misato` → `your-server`)
- LINE delivery marked as unstable (⚠️ not yet stable)

### Removed
- Empty `scripts/` directory
