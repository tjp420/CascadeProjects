# Product Hunt Launch: SimpleBeacon

**Tagline:** The AI Slop Cop — catch machine-generated debris before it ships

**Maker:** SimpleBeacon Team

---

## What is SimpleBeacon?

SimpleBeacon is a privacy-first code scanner that detects AI-generated artifacts, hardcoded credentials, and copy-paste bloat in your codebase. It runs entirely offline — your source code never leaves your machine.

## Key Features

- **Offline-first scanning** — deterministic rule engines, zero network calls
- **AI artifact detection** — catches markdown fences, filler stubs, hallucinated npm packages
- **Credential pattern scanning** — with smart allowlists for test fixtures
- **Gate mode** — fails CI if slop is detected, just like a security gate
- **VS Code: extension** — real-time scan on save, quality score in status bar
- **Executive certificates** — board-ready PDF compliance reports with SHA-256 seal

## Why developers care

By mid-2026, 51% of GitHub commits are AI-assisted. That velocity is great. The slop is not.

SimpleBeacon is the first tool built specifically to detect _machine-generated debris_ — not replace your linter, but add a release-hygiene layer upstream of code review.

## Pricing

- **Free** — 50 files/scan, all rule engines, quality score
- **Instant ($19)** — unlimited files, 7-day access
- **Executive ($499)** — PDF certificates, 90-day access
- **EU Sprint ($2,499)** — EU AI Act compliance pack, 30-day access

## Tech stack

- Node.js CLI with zero dependencies for core scanning
- VS Code: extension (TypeScript)
- GitHub Action (Dockerless, runs in seconds)
- MCP server for Cursor/Claude Desktop integration

## Try it

```bash
npm install -g simplebeacon
simplebeacon scan --gate --offline
```

---

_Ask us anything in the comments. We're online for the next 48 hours._
