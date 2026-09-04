# SimpleBeacon AI Slop Cop

[![Version](https://img.shields.io/badge/version-3.0.579-blue.svg)](https://marketplace.visualstudio.com/items?itemName=simplebeacon.simplebeacon-vscode)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.84.0+-green.svg)](https://code.visualstudio.com/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Security: Zero Upload](https://img.shields.io/badge/security-zero%20upload-brightgreen.svg)](#-zero-upload-security)

**Offline AI code audit — 48 analyzers + 25 scan engines, zero source-code upload, board-ready compliance reports for AI slop, credential leaks, and EU AI Act / SOC 2 gaps.**

## Why SimpleBeacon

AI coding assistants ship fast — but they also ship hallucinated imports, fictional KPIs, placeholder TODOs, leaked secrets, and mock data in production routes. SimpleBeacon catches all of it **locally**, without uploading your source code to any server.

- **Zero Upload**: All scanning runs in your browser or local CLI. Your source code never leaves your machine.
- **48 Analyzers**: Credential leaks, AI fiction patterns, mock data in production routes, EU AI Act gaps, SOC 2 controls, OWASP LLM Top 10, and more.
- **Board-Ready Reports**: Export signed audit certificates and compliance PDFs directly from scan results.
- **CI Gate**: Block PRs with blocking findings before merge — works with GitHub Actions, GitLab CI, and pre-commit hooks.

## Prerequisites

### 1. Install the SimpleBeacon CLI

The extension requires the `simplebeacon` CLI to run scans. Install it globally:

```bash
npm install -g simplebeacon
```

Verify installation:

```bash
simplebeacon --version
```

### 2. Install the Extension

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for **"SimpleBeacon AI Slop Cop"**
4. Click Install

## Quick Start

### Scan Your Workspace

1. Open the SimpleBeacon sidebar (shield icon in the activity bar)
2. Click the scan button (`Ctrl+Shift+P` → `SimpleBeacon: Scan Workspace`)
3. Review findings in the sidebar dashboard
4. Export reports or certificates from the dashboard view

### CI Gate

Add SimpleBeacon to your GitHub Actions workflow:

```yaml
- name: SimpleBeacon Gate
  run: npx simplebeacon scan --gate --offline --format json --output .simplebeacon/report.json
```

Or GitLab CI:

```yaml
simplebeacon-scan:
  image: node:22-alpine
  before_script:
    - npm install -g simplebeacon
  script:
    - simplebeacon scan --gate --format json --output .simplebeacon/report.json
  artifacts:
    when: always
    paths:
      - .simplebeacon/report.json
```

### Pre-commit Hook

```bash
#!/bin/sh
# .git/hooks/pre-commit
npx simplebeacon scan --gate --fail-on-blocking
```

## Features

### Scanning Engines

- **AI Fiction Detection**: Hallucinated imports, fictional KPIs, placeholder TODOs, LLM preambles
- **Credential Leak Detection**: Stripe keys, AWS keys, GitHub PATs, GitLab tokens, OAuth tokens
- **Production Leak Prevention**: Mock data in production routes, sample JSON in prod paths, debug artifacts
- **Security Patterns**: Hardcoded secrets, weak crypto, missing security headers, Docker misconfigurations
- **EU AI Act Compliance**: Risk classification gaps, transparency requirements, documentation holes
- **SOC 2 Controls**: Access control, audit logging, change management, data handling
- **OWASP LLM Top 10**: Prompt injection, training data poisoning, model supply chain risks
- **Unregistered Domain Detection**: DNS-resolves URL/domain references in source and config to flag unregistered or hijackable domains (NXDOMAIN) — catches stale webhook URLs, dead API endpoints, and abandoned infrastructure references before they're exploited
- **Code Quality**: Dead code, dependency graph issues, naming conventions, type safety

### Dashboard

- Real-time quality score and gate status
- Findings by category and severity (critical / high / medium / low)
- Historical scan trends
- One-click export to JSON, Markdown, PDF, and signed certificates
- Board-ready compliance reports with client/project metadata

### AI Agent Guardrails

- Detects AI-edited code via file diff analysis on save
- Surfaces findings as VS Code diagnostics in the Problems panel
- Copies coupling summary to clipboard when AI sessions end
- Status bar shows blocking issue count with file and line details

## Configuration

```json
{
  "simplebeacon.analysisProfile": "balanced",
  "simplebeacon.offlineMode": false,
  "simplebeacon.autoScanOnOpen": false,
  "simplebeacon.maxFiles": 5000,
  "simplebeacon.confidenceThreshold": "medium",
  "simplebeacon.excludePatterns": [
    "node_modules", ".git", "dist", "build",
    ".vscode", ".simplebeacon", "ai-agent", "scripts"
  ]
}
```

### Analysis Profiles

| Profile | Speed | Depth | Use Case |
|---------|-------|-------|----------|
| Quick | Fast | Light | Rapid feedback during development |
| Balanced | Medium | Full | General purpose scanning |
| Comprehensive | Slow | Deep | Code reviews and audits |

### Confidence Thresholds

| Level | Description |
|-------|-------------|
| Low | All patterns (0.0+) |
| Medium | Standard patterns (0.6+) |
| High | Explicit signatures only (0.8+) |

## Pricing

| Tier | Price | Scans | Features |
|------|-------|-------|----------|
| Free | $0 | 3/month | Core analyzers, basic reports |
| Developer | $49/mo | Unlimited | All analyzers, CI gate, certificates |
| Team Pro | $149/mo | Unlimited | EU AI Act mapping, SOC 2, board PDFs, 5 seats |
| Enterprise | $499/mo | Unlimited | SSO/SAML, dedicated analyst, air-gapped |
| Audit Certificate | $149 one-time | 1 | Board-ready audit certificate |
| Executive Risk Certificate | $499 one-time | 1 | Executive risk report + board PDF |
| EU AI Act Sprint | $2,499 one-time | 20 | EU AI Act gap analysis + remediation plan |

Visit [simplebeacon.ai/pricing](https://simplebeacon.ai/pricing) for details.

## Troubleshooting

### CLI Not Found

If you see "SimpleBeacon CLI not found":

```bash
npm install -g simplebeacon
```

Then restart VS Code.

### Scan Timeout

For large repositories, increase `simplebeacon.maxFiles` or add more patterns to `simplebeacon.excludePatterns`.

### Debug Mode

```json
{
  "simplebeacon.debug": true
}
```

Check output: `View > Output > SimpleBeacon`

## Documentation

- [Website](https://simplebeacon.ai)
- [Pricing](https://simplebeacon.ai/pricing)
- [Dashboard](https://simplebeacon.ai/dashboard)
- [CLI on npm](https://www.npmjs.com/package/simplebeacon)

## Support

- **Issues**: [GitHub Issues](https://github.com/tjp420/CascadeProjects/issues)
- **Email**: support@simplebeacon.ai

## License

MIT License — see [LICENSE](LICENSE) file for details.

---

**Not legal advice**: SimpleBeacon provides technical tooling and pattern detection. It does not constitute legal advice. Consult qualified legal counsel for regulatory compliance interpretations.
