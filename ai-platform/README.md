# Simplebeacon Platform

AI safety scanning, pre-launch audits, and the Simplebeacon operator dashboard.

## Overview

This package is the Simplebeacon product surface: CLI gate scans, assessment APIs, the internal dashboard (`simplebeacon-server.js`), and the public storefront server (`server/index.js`).

Cascade-era GGUF dashboards, legacy multi-dashboard HTML, and bulk analysis tooling have been removed. **Simplebeacon CLI** lives in `packages/simplebeacon-cli/`; the dashboard SPA is in `web/simplebeacon-dashboard/`.

## Quick start

### Prerequisites

- Node.js >= 16
- npm >= 8

### Install and scan

```bash
cd ai-platform
npm install
cp .env.example .env   # set JWT_SECRET for server; see .env.v1-internal for internal dashboard

npm run simplebeacon:report
npm test
```

### Run servers

```bash
# Public storefront + APIs (default port 3000)
npm start

# Internal operator dashboard (port 54355)
npm run dashboard
```

## Key scripts

| Script | Purpose |
|--------|---------|
| `npm run simplebeacon:report` | Gate scan → `.simplebeacon/report.json` |
| `npm run simplebeacon:assess` | Assessment from latest report |
| `npm run simplebeacon:baseline-sync` | Sync Jest/page-sample baseline after green tests |
| `npm run dashboard` | `simplebeacon-server.js` (internal dashboard) |
| `npm start` | `server/index.js` (landing + APIs) |

## Layout

```
ai-platform/
├── packages/simplebeacon-cli/   # CLI (npm package `simplebeacon`)
├── web/simplebeacon-dashboard/  # Operator SPA
├── web/data/                    # Gate scan samples (*-sample.json)
├── server/                      # Express APIs, auth, assessment
├── simplebeacon-server.js       # Internal dashboard entry (54355)
├── coming-soon/                 # Public landing (also served by server/)
└── .simplebeacon/               # Scan reports and baseline
```

## Documentation

- CLI: `packages/simplebeacon-cli/README.md`
- Path configuration: `docs/simplebeacon-path-configuration.md`
- Ship checklist: `docs/ship-readiness-checklist.md`
