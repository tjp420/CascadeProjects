# Simplebeacon

**Release hygiene for AI-assisted code** — local MCP + CLI gate. No repo upload required.

[![npm version](https://img.shields.io/npm/v/simplebeacon.svg)](https://www.npmjs.com/package/simplebeacon)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-Extension-007ACC?logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=simplebeacon.ai-slop-cop)

Catch AI-generated slop, mock metrics, and placeholder credentials before they ship.

- **Free:** MCP snippet scans + full-repo `--gate` + GitHub Actions + zero extra MCP deps + `--offline` by default
- **Pro ($9/mo):** 38 analyzer engines, batch CLI scanning, CI/CD integration, exportable reports
- **Enterprise:** Team management, custom rules, dedicated support, EU AI Act compliance

## Quick Start

```bash
npx --yes simplebeacon init --starter
npx simplebeacon scan --gate --offline
npx simplebeacon gate status
```

## What it catches

| Artifact | Example | Risk |
|----------|---------|------|
| Fiction KPIs | `completion_rate: 98.5%` | Dashboards show fake metrics |
| Dummy URLs | `https://api.example.com/v1` | Production hits placeholders |
| Mock paths in prod | `web/data/status-sample.json` | App loads demo data at runtime |
| Demo credentials | `sk-...`, `AKIA...` in source | Security incidents, failed audits |

## Install

```bash
npm install -D simplebeacon
# or zero-install
npx simplebeacon init
npx simplebeacon hook install
```

## VS Code Extension

Install from the [marketplace](https://marketplace.visualstudio.com/items?itemName=simplebeacon.ai-slop-cop) for real-time scanning in your editor.

## Documentation

- [Getting Started](packages/simplebeacon-cli/docs/GETTING-STARTED.md)
- [MCP Setup](packages/simplebeacon-cli/docs/MCP-USER-SETUP.md)
- [Gate Calibration](packages/simplebeacon-cli/docs/GATE-CALIBRATION.md)
- [CI Integration](packages/simplebeacon-cli/docs/CI.md)

## License

MIT — see [LICENSE](LICENSE) for details.
