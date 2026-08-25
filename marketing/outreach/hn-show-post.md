# Show HN: SimpleBeacon — a 100% offline, local CLI/VS Code scanner that audits codebases for AI slop and compliance risk

**TL;DR:** I built a code scanner that runs entirely on your machine. No source code leaves your machine. No SaaS dashboard phoning home. Just `npx simplebeacon scan --gate --offline` or install the VS Code extension.

## Why I built it

After reviewing a codebase that had been heavily touched by Cursor/Copilot, I found:

- Hardcoded `sk-...` API keys in 3 "finished" files
- A `TODO: replace with real data` comment in production
- Fake KPIs that looked real enough to ship
- A hallucinated npm package that `npm install` would have tried to pull from the registry

The worst part: the existing "enterprise" scanning tools wanted me to upload the entire repo to their cloud before they would tell me what was wrong. For a code audit, that defeats the entire point.

## What it does

- **Credential leak detection** — scans for hardcoded API keys, tokens, and env values that made it past review
- **AI slop detection** — catches hallucinated imports, placeholder KPIs, and LLM filler comments
- **EU AI Act / SOC 2 readiness** — maps findings to regulatory documentation gaps and generates a technical attestation certificate (not a legal certification)
- **VS Code extension** — sidebar dashboard with remediation roadmap
- **GitHub Action** — blocks PRs with blocking findings

## How it's different

|                       | SimpleBeacon                                 | SonarQube                   | Snyk           |
| --------------------- | -------------------------------------------- | --------------------------- | -------------- |
| **Uploads source?**   | Never (default)                              | Optional (cloud or on-prem) | Yes (cloud)    |
| **AI slop detection** | Yes                                          | No                          | No             |
| **EU AI Act mapping** | Yes                                          | No                          | No             |
| **Price**             | Free / $49 Developer / $399 Compliance Suite | Enterprise $$$              | Enterprise $$$ |
| **Local LLM support** | Yes (Ollama)                                 | No                          | No             |

## Pricing

- **Free:** unlimited local scans (50 files/scan, 5 findings shown), CLI + VS Code extension
- **Developer:** $49/month or $490/year — unlimited scans, 48 analyzers, CI gate, exportable reports
- **Legacy Pro:** $9/month — backward compat for existing customers, same features as Developer
- **Compliance Suite:** $399/month — unlimited scans, 48 analyzers, EU AI Act + SOC 2 artifacts, 5 seats, certificate ZIP
- **Audit Certificate:** $149 one-time — single cryptographic certificate for investors/auditors, valid 12 months
- **Enterprise:** Custom — air-gapped deployment, SSO/SAML (roadmap), dedicated analyst

## Technical details

- Node.js 18+, runs via `npx` or `npm install -g`
- Deterministic regex + AST scanning (no LLM in the default path)
- Offline HMAC-SHA256 license verification (JWT, no network needed after activation)
- MCP server for Cursor/Claude Desktop integration
- JSON/CSV/PDF export for compliance auditors
- Optional local LLM remediation via Ollama (not in the default scan path)

## Try it

```bash
npx simplebeacon scan --gate --offline
```

Repo: https://github.com/tjp420/CascadeProjects
Docs: https://simplebeacon.ai
VS Code: search "SimpleBeacon" in the marketplace

Happy to answer questions. Especially curious if engineering managers are actually seeing this stuff in production now, or if my repo was just a bad case.
