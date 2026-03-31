# Contributing to X Likes Digest

Thanks for your interest in contributing! This project is an [OpenClaw](https://github.com/openclaw/openclaw) skill for automated X (Twitter) likes digests.

## Getting Started

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Test locally (see below)
5. Submit a Pull Request

## Project Structure

```
x-likes-digest/
├── SKILL.md              # Agent skill definition (main logic)
├── README.md             # Documentation
├── references/
│   ├── setup-guide.md    # VPS setup instructions
│   └── spec.md           # Technical specification
└── .github/
    ├── ISSUE_TEMPLATE/
    │   ├── bug_report.md
    │   └── feature_request.md
    ├── pull_request_template.md
    └── workflows/
        └── ci.yml
```

## How to Test

This is an OpenClaw skill — it runs inside an OpenClaw agent session. To test changes:

1. Install [OpenClaw](https://github.com/openclaw/openclaw)
2. Install this skill: `openclaw skill add <your-fork>/x-likes-digest`
3. Set up the [data collector](https://github.com/nmn-labs/x-likes-digest-collector) on a VPS
4. Run the skill manually: `openclaw cron run x-likes-digest`

## Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR
- Update README.md if adding new configuration options
- Update CHANGELOG.md with your changes
- Don't modify SKILL.md formatting (step numbers, headers) without discussion

## Reporting Issues

- Use the bug report template for bugs
- Use the feature request template for new ideas
- Include your OpenClaw version and relevant configuration

## Code of Conduct

Be respectful and constructive. We're all here to build cool stuff.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
