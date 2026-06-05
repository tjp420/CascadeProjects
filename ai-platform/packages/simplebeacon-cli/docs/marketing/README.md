# Simplebeacon Marketing Content Generator

Turn scan results into publishable marketing assets. No spam — just content you own and distribute through your channels.

## What it does

Reads a Simplebeacon scan report (JSON) and generates:

| Channel | Output | Best for |
|---------|--------|----------|
| `blog` | Markdown post | Company blog, dev.to, Medium |
| `twitter` / `x` | 5-tweet thread | Product announcements, scan highlights |
| `linkedin` | LinkedIn post | Professional audience, case study teasers |
| `newsletter` | Email draft | Monthly/weekly subscriber updates |
| `case-study` | Markdown doc | Sales collateral, website downloads |
| `press-kit` | Markdown doc | Journalists, PR outreach |
| `one-pager` | Markdown doc | Sales calls, investor decks |
| `landing-page` | HTML template | Product website, GitHub Pages |

All content uses **approved claims only** — no unsupported marketing fiction. See `../MARKETING.md` for the verified claim mapping.

## Quick start

### Generate all channels at once

```bash
node bin/generate-marketing-content.js \
  --report .simplebeacon/report.json \
  --all \
  --output ./marketing-output
```

### Generate a single channel

```bash
node bin/generate-marketing-content.js \
  --report .simplebeacon/report.json \
  --channel blog \
  --output ./marketing-output
```

### From a complete scan bundle

```bash
node bin/generate-marketing-content.js \
  --complete-scan .simplebeacon/latest-scan.json \
  --all
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `--report <path>` | Simplebeacon report JSON | (required) |
| `--complete-scan <path>` | Complete scan bundle JSON | (alternative) |
| `--channel <name>` | Single channel to generate | (required unless `--all`) |
| `--all` | Generate all 7 channels | `false` |
| `--output <dir>` | Output directory | `./marketing-content` |
| `--tone <tone>` | `professional`, `conversational`, `friendly`, `formal`, `concise` | channel-specific default |
| `--industry <name>` | Industry for case-study | `software` |
| `--help` | Show help | |

## Template files

The `content-templates/` directory contains Mustache-style templates for each channel. You can customize these without touching the generator code:

- `blog-template.md`
- `twitter-thread-template.txt`
- `linkedin-template.md`
- `newsletter-template.md`
- `case-study-template.md`
- `press-kit-template.md`
- `one-pager-template.md`
- `landing-page-template.html`

## Programmatic usage

```javascript
const { generateMarketingContent, generateAllChannels } = require(
  './src/lib/marketing/marketing-content-generator'
);

// Single channel
const blog = generateMarketingContent(report, { channel: 'blog', tone: 'professional' });

// All channels
const files = generateAllChannels(report, { outputDir: './content' });
```

## How project names are resolved

The generator tries these fields in order:

1. `report.projectName`
2. `report.projectLabel`
3. `basename(report.projectPath)`
4. `basename(report.platformRoot)`
5. Fallback: `your project`

## Content policy

This generator creates **content for your own channels** — blog posts, social media, newsletters, sales collateral. It does **not**:

- Scrape contact lists
- Send unsolicited emails
- Auto-post to external accounts
- Generate spam or misleading claims

All claims map to `../MARKETING.md` — the approved, verified claim registry.
