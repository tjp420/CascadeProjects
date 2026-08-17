# SimpleBeacon

**Release hygiene for AI-assisted code** — local MCP + CLI gate. No repo upload required.

[![npm version](https://img.shields.io/npm/v/simplebeacon.svg)](https://www.npmjs.com/package/simplebeacon)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![VS Code:](https://img.shields.io/badge/VS%20Code-Extension-007ACC?logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=simplebeacon.ai-slop-cop)

Catch AI-generated slop, mock metrics, and placeholder credentials before they ship.

- **Free:** MCP snippet scans + 5 core engines (credentials, leaks, slop, dead-code, security) + plaintext output + unlimited for open source
- **Developer ($49/mo or $490/yr):** All 38 analyzer engines, batch/multi-project CLI, JSON/SARIF/CSV export, VS Code: dashboard, GitHub Actions with exportable reports
- **Team Pro ($149/mo or $1,490/yr):** Everything in Developer + shared team configs, 5 seats, EU AI Act compliance, SOC 2 board-ready certs, priority support
- **Enterprise (custom):** SSO/SAML, custom rules, air-gapped deployment, dedicated analyst, Book Demo
- **Legacy Pro ($9/mo):** Backward compatible tier for existing customers

---

## Project Structure

```
CascadeProjects/
├── packages/simplebeacon-cli/     # CLI package (scan, init, report, etc.)
├── simplebeacon-vscode-merged/    # VS Code: extension + dashboard SPA
│   ├── src/                       # Extension TypeScript source
│   ├── dashboard-web/             # Dashboard SPA (vanilla JS)
│   │   ├── js/                    # ES5-compatible build
│   │   └── js-es2018/             # Modern JS build
│   └── coming-soon/               # Marketing website
├── ai-platform/                    # Backend services
├── test-init/                      # Test workspace (generated)
├── .simplebeacon/                  # Scan output & config
│   ├── codemap.html               # Interactive dependency graph
│   └── report.json                # Latest scan results
├── FEATURE_CHECKLIST.md            # Full feature map & test log
└── README.md                       # This file
```

---

## Quick Start

```bash
# 1. Initialize a project
npx --yes simplebeacon init --starter

# 2. Run a gate scan
npx simplebeacon scan --gate --offline

# 3. Check gate status
npx simplebeacon gate-status

# 4. Try it in a PR with no token required (Sandbox mode)
#    Add .github/workflows/simplebeacon.yml with the action from the repo.
#    Free runs show up to 5 findings and an upgrade banner.
```

---

## Gamedev / GZDoom scans

For **GZDoom / ZScript mod trees** (e.g. R3DLighting + R3DOptions), use the **`gamedev`** profile and mod-side config — not the default web-hygiene gate on the monorepo root.

**Setup (on the mod):** copy [`.simplebeacon/templates/gamedev/`](.simplebeacon/templates/gamedev/) → `{mod}/.simplebeacon/config.json` (see `config.r3d-lighting.json` / `config.r3d-options.json`) and `simplebeaconignore` → `{mod}/.simplebeaconignore`.

**Run (from this monorepo):**

```bash
npm run gzdoom:export-summary -- --path "E:/Ai/Games/Doom/TEst/results/R3DLighting"
npm run gzdoom:export-summary -- --path "E:/Ai/Games/Doom/TEst/results/R3DOptions"
npm run gzdoom:norun-gate -- --path "E:/Ai/Games/Doom/TEst/results/R3DLighting" --timeout 600000
```

**Read results:** `{mod}/Docs/gzdoom-gate-summary.json` and `{mod}/Docs/gzdoom-norun-gate.json` (mod `.gitignore` often excludes `.simplebeacon/`).

Full mod-author setup: [docs/gzdoom-mod-author-setup.md](docs/gzdoom-mod-author-setup.md) · Agent/monorepo details: [AGENTS.md](AGENTS.md#monorepo-vs-vsix-do-not-treat-this-as-consumer-only)

---

## CLI Commands

All commands are available via `npx simplebeacon <command>` or `node packages/simplebeacon-cli/bin/simplebeacon.js <command>`.

| Command | Description | Key Flags |
|---------|-------------|-----------|
| `scan` | Run a full project scan | `--gate`, `--format json`, `--output`, `--path`, `--config`, `--verbose` |
| `init` | Create `.simplebeacon/` config | `--dry-run`, `--starter` |
| `gate-status` | Read latest gate from report | (none) |
| `doctor` | System integrity audit | `--path` |
| `ai-plan` | Generate AI remediation plan | `--output`, `--path` |
| `reduce` | File reduction / cleanup scan | `--format text`, `--path` |
| `report` | Generate human-readable audit report | `--report`, `--output`, `--company`, `--assessor` |
| `compliance` | Compliance checklist from report | `--report`, `--format`, `--output` |
| `assess` | Risk assessment from report | `--report`, `--output`, `--company`, `--assessor` |
| `baseline sync` | Sync Jest test baselines | `--path` |
| `hook install` | Install pre-commit hooks | `--dry-run`, `--path` |
| `pdf` | Export certificate PDF (Pro) | `--report`, `--output` |
| `mcp` | MCP server stdio mode | `--help` |

### CLI Examples

```bash
# Scan with gate and JSON output
npx simplebeacon scan --path ./src --gate --format json --output report.json

# Generate audit report
npx simplebeacon report --path . --report .simplebeacon/report.json --output AUDIT_REPORT.md --company "Acme Corp" --assessor "Alice"

# AI remediation plan
npx simplebeacon ai-plan --path . --output .simplebeacon/ai-plan.md

# System health check
npx simplebeacon doctor --path .
```

---

## VS Code: Extension

The VS Code: extension (`simplebeacon-vscode-merged/`) provides real-time scanning, a dashboard webview, and interactive code maps.

### Extension Commands

| Command | Action |
|---------|--------|
| `SimpleBeacon: Scan Workspace` | Run full workspace scan |
| `SimpleBeacon: Open Dashboard` | Open the web dashboard |
| `SimpleBeacon: Generate Code Map` | Build interactive dependency graph |
| `SimpleBeacon: Open Code Map HTML` | Open codemap.html in browser |
| `SimpleBeacon: Real-time Monitoring` | Toggle live file watching |
| `SimpleBeacon: Toggle Sidebar` | Show/hide the activity-bar panel |
| `SimpleBeacon: Open Settings` | Configure scanners & thresholds |

### Dashboard Web SPA

The dashboard is served from `dashboard-web/` at `http://127.0.0.1:54358/dashboard/`.

**Routes** (all serve `index.html` as SPA fallback):
- `/dashboard/signin` — Authentication entry
- `/dashboard` — Main dashboard
- `/dashboard/audit` — Audit view
- `/dashboard/analyze` — Code analysis
- `/dashboard/results` — Scan results
- `/dashboard/remediation` — Fix tracker
- `/dashboard/security` — Security findings
- `/dashboard/settings` — Configuration
- `/dashboard/pricing` — Plans & upgrade
- `/dashboard/eu-ai-act` — Compliance checklist

---

## Code Map (`codemap.html`)

An interactive Canvas 2D/3D dependency graph generated after each scan.

**Controls:**
- **Left-click drag** — Pan (2D) / Orbit (3D)
- **Right-click drag** — Pan
- **Middle-click drag** — Zoom
- **Scroll wheel** — Zoom in/out
- **Double-click** — Zoom to node
- **`W/A/S/D`** — Move camera (with pointer lock)
- **`3`** — Toggle 3D mode
- **`Space`** — Pause physics
- **`L`** — Lock mouse pointer

**3D Mode Features:**
- Architectural layers by file path (entry, ui, business, data, utils, tests)
- Depth-sorted rendering (back-to-front)
- Depth fog on edges
- Grid planes per layer
- Drop shadows and glow halos on nodes
- Semi-transparent label backgrounds

---

## Coming-Soon Website

Static marketing site at `coming-soon/`.

| Page | Path | Description |
|------|------|-------------|
| Home | `index.html` | Landing page |
| Pricing | `pricing.html` | Plans (Free/Pro/Team/Enterprise) with monthly toggle |
| Audit | `audit.html` | Standalone audit SPA with token auth |
| Roadmap | `roadmap.html` | Feature roadmap |
| Contact | `contact.html` | Contact form |
| Refund | `refund.html` | Refund policy |
| Privacy | `privacy.html` | Privacy policy |
| Terms | `terms.html` | Terms of service |
| Community | `community.html` | Discord/community links |
| FAQ | `faq.html` | Frequently asked questions |
| Security | `security.html` | Security policy |
| Unlock | `unlock.html` | License activation |

---

## Authentication

SimpleBeacon supports multiple auth flows:

| Method | Endpoint | Description |
|--------|----------|-------------|
| License Token | `POST /api/auth/login` | RSA-validated license key |
| JWT Session | `GET /api/auth/me` | Check current session |
| Sandbox Token | `POST /api/tokens/sandbox` | Dev/test token (gated in prod) |
| Email/Password | `POST /api/auth/login` | Standard credential login |

**Token Validation:**
- License tokens use 2-part `payload.signature` format
- JWT tokens use standard 3-part format with expiry
- Server-side validation via `/api/auth/login`
- Client-side `_isValidLicenseFormat()` rejects arbitrary strings
- `strict` mode prevents local-dev fallback on explicit signin

---

## Testing

### Feature Checklist

See [`FEATURE_CHECKLIST.md`](./FEATURE_CHECKLIST.md) for a comprehensive map of all features with test results.

**Test Coverage Summary:**
- **112 features tested** across CLI, dashboard, coming-soon, API, and VS Code: extension
- **109 PASS (97.3%)**, **3 expected failures**
- All 23 dashboard routes verified (HTTP 200)
- All 12 coming-soon pages verified
- All 28 API endpoints verified
- VS Code: extension compiles cleanly

### Known Issues

| Issue | Status | Notes |
|-------|--------|-------|
| `baseline sync` fails without Jest | Expected | Works when `package.json` has Jest configured |
| `pdf` requires license token | Expected | Gated Pro feature; set `SIMPLEBEACON_LICENSE_TOKEN` |
| `POST /api/certificate/download` 404 | Fixed in source | Added endpoint to `dataServer.ts`; requires server restart |

---

## What It Catches

| Artifact | Example | Risk |
|----------|---------|------|
| Fiction KPIs | `completion_rate: 98.5%` | Dashboards show fake metrics |
| Dummy URLs | `https://api.example.com/v1` | Production hits placeholders |
| Mock paths in prod | `web/data/status-sample.json` | App loads demo data at runtime |
| Demo credentials | `sk-...`, `AKIA...` in source | Security incidents, failed audits |
| Dead code | Unused imports, unreachable branches | Bundle bloat, maintenance burden |
| Console logs | `console.log` in production | Performance leaks, info disclosure |

---

## Install

```bash
# Local dev dependency
npm install -D simplebeacon

# Or run without installing
npx simplebeacon init
npx simplebeacon hook install
```

---

## Pre-push secret scanning (onboarding)

This repository includes a Husky `pre-push` hook that runs a changed-file secret scanner before allowing a push. It prefers the `gitleaks` binary for detection and falls back to a conservative regex scanner when `gitleaks` is not installed.

To bootstrap `gitleaks` on your machine, run:

```bash
npm run install-gitleaks
```

What the helper does:
- On macOS: attempts `brew install gitleaks`.
- On Windows: attempts `winget install` and falls back to a PowerShell downloader that places the binary under `%USERPROFILE%\bin`.
- On Linux: prints manual download instructions.

If you prefer not to install the binary, the repo still enforces local checks via the regex fallback, but installing `gitleaks` improves detection quality and reduces false positives.


### VS Code: Extension

Install from the [marketplace](https://marketplace.visualstudio.com/items?itemName=simplebeacon.ai-slop-cop) or build locally:

```bash
cd simplebeacon-vscode-merged
npm install
npm run compile
```

---

## Development

### Build the Extension

```bash
cd simplebeacon-vscode-merged
npm run compile        # TypeScript compile + copy assets
```

### Build the CLI

```bash
cd packages/simplebeacon-cli
npm install
npm test               # Run test suite
```

### Start the Data Server (for dashboard)

The VS Code: extension automatically starts an HTTP server on port `54358`.

```bash
# Dashboard URL
http://127.0.0.1:54358/dashboard/signin

# Coming-soon site
http://127.0.0.1:54358/coming-soon/
```

---

## Documentation

- [Getting Started](packages/simplebeacon-cli/docs/GETTING-STARTED.md)
- [MCP Setup](packages/simplebeacon-cli/docs/MCP-USER-SETUP.md)
- [Gate Calibration](packages/simplebeacon-cli/docs/GATE-CALIBRATION.md)
- [CI Integration](packages/simplebeacon-cli/docs/CI.md)
- [EU AI Act Compliance](packages/simplebeacon-cli/docs/EU-AI-ACT.md)

---

## API Endpoints

The data server exposes these REST endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Server health |
| `/api/status` | GET | Scan status |
| `/api/config` | GET | Extension config |
| `/api/workspace` | GET | Workspace info |
| `/api/data` | GET | Full server state |
| `/api/findings` | GET | All findings |
| `/api/simplebeacon/report` | GET | Scan report JSON |
| `/api/simplebeacon/scan/progress` | GET | Scan progress |
| `/api/simplebeacon/config` | GET | Scanner config |
| `/api/simplebeacon/config/presets` | GET | Config presets |
| `/api/simplebeacon/baseline` | GET | Baseline status |
| `/api/simplebeacon/history` | GET | Scan history |
| `/api/analyze/flexible` | POST | Flexible analysis |
| `/api/analyze/compliance-checklist` | POST | Compliance checklist |
| `/api/analyze/inventory` | GET | File inventory |
| `/api/analyze/list-directories` | GET | Directory listing |
| `/api/analyze/resolve-folder-name` | GET | Resolve folder path |
| `/api/file-content` | GET | Read file contents |
| `/api/certificate/download` | POST | Generate certificate HTML |
| `/api/auth/login` | POST | Authenticate |
| `/api/auth/me` | GET | Current user |
| `/api/auth/register` | POST | Register (extension: returns local dev token) |
| `/api/tokens/sandbox` | POST | Generate sandbox token |

---

## License

MIT — see [LICENSE](LICENSE) for details.
