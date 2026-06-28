# Show HN: SimpleBeacon — A zero-upload scanner that catches AI slop and credential leaks

**TL;DR:** I built a code scanner that runs entirely on your machine. No source code leaves your machine. No SaaS dashboard phoning home. Just `npm i -g simplebeacon` and `simplebeacon scan`.

## Why I built it

After reviewing a codebase that had been heavily touched by Cursor/Copilot, I found:
- Hardcoded `sk-...` API keys in 3 "finished" files
- A `TODO: replace with real data` comment in production
- Fake KPIs that looked real enough to ship

Existing tools either upload your code to the cloud or charge enterprise prices for local scanning. I wanted something that respects the "zero-upload" principle without being a security theater prop.

## What it does

- **Credential leak detection** — scans 669 files/sec for API keys, tokens, and env leaks
- **AI slop detection** — catches hallucinated imports, placeholder KPIs, and LLM filler comments
- **EU AI Act readiness** — maps findings to regulatory documentation gaps (August 2026 deadline)
- **VS Code extension** — sidebar dashboard with remediation roadmap
- **GitHub Action** — blocks PRs with blocking findings

## How it's different

| | SimpleBeacon | SonarQube | Snyk |
|---|---|---|---|
| **Uploads source?** | Never (default) | Yes (cloud) | Yes (cloud) |
| **AI slop detection** | Yes | No | No |
| **EU AI Act mapping** | Yes | No | No |
| **Price** | Free / $49 team | Enterprise $$$ | Enterprise $$$ |
| **Local LLM support** | Yes (Ollama) | No | No |

## Technical details

- Node.js 22+, single binary via `npm`
- Deterministic regex + AST scanning (no LLM in the default path)
- MCP server for Cursor/Claude Desktop integration
- JSON/CSV/PDF export for compliance auditors

## Try it

```bash
npm install -g simplebeacon-cli
simplebeacon scan --gate --offline
```

Repo: https://github.com/tjp420/simplebeacon
Docs: https://simplebeacon.ai/docs
VS Code: search "SimpleBeacon" in the marketplace

Happy to answer questions. Also looking for feedback on the EU AI Act mapping — that's the feature I'm least sure about.
