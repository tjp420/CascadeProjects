# Product Hunt Launch Post — SimpleBeacon

## Tagline

Zero-upload code scanner that catches AI slop, credential leaks, and EU AI Act gaps before they ship.

## Description

SimpleBeacon is a developer-first code hygiene tool that runs entirely on your machine. No source code leaves your laptop. No SaaS dashboard tracking your repos. Just fast, deterministic scanning for the things that matter.

### What it catches

- **Credential leaks** — API keys, tokens, and env vars in source code
- **AI-generated slop** — hallucinated imports, fake KPIs, placeholder comments
- **Production leaks** — mock data paths and sample configs in production code
- **EU AI Act gaps** — documentation and risk-assessment artifacts for August 2026 compliance

### How it works

Install via npm, scan in seconds:

```bash
npm install -g simplebeacon-cli
simplebeacon scan --gate --offline
```

Results appear in your terminal, as a JSON report, or inside the VS Code extension sidebar. The GitHub Action blocks PRs with blocking findings.

### Why developers choose it

- **Privacy-first** — zero-upload by default; network activity is monitored and reported
- **Fast** — scans ~67 files/sec locally
- **Deterministic** — regex + AST analysis, not black-box LLM scoring
- **Affordable** — free for individual developers; $49/mo for teams

### Integrations

- VS Code extension with live dashboard
- GitHub Action for PR gating
- MCP server for Cursor / Claude Desktop
- Local Ollama support for LLM-enhanced remediation

---

## Maker Comment

We built SimpleBeacon after finding hardcoded OpenAI keys and fake revenue numbers in a "production-ready" repo that had been heavily edited with AI assistants. Existing tools either uploaded our code to the cloud or cost thousands for on-premise licenses.

SimpleBeacon is different: it runs entirely locally, uses deterministic rule engines (not opaque ML models), and maps findings to real regulations like the EU AI Act. The VS Code extension gives you a dashboard without ever phoning home.

Try it: `npm install -g simplebeacon-cli` and run `simplebeacon scan --gate` in any repo.

Happy to answer questions — especially about the EU AI Act mapping or the local-only architecture.

---

## Topics

Developer Tools, Security, AI, Code Quality, Compliance, EU AI Act

## Media

- [ ] Screenshot 1: Terminal scan output (1280×800)
- [ ] Screenshot 2: VS Code extension dashboard (1280×800)
- [ ] Screenshot 3: GitHub Action PR comment (1280×800)
- [ ] GIF: 10-second scan demo
- [ ] Thumbnail: 240×240 SimpleBeacon logo
