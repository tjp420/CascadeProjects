# SimpleBeacon System Architecture

## Overview
SimpleBeacon is a multi-platform AI safety scanning and governance system with five interconnected components.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           S I M P L E B E A C O N                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   VS Code   │    │   Browser   │    │    CLI      │    │   Server    │  │
│  │  Extension  │◄──►│  Dashboard  │◄──►│  Scanner    │◄──►│    API      │  │
│  │             │    │             │    │             │    │             │  │
│  │ Real-time   │    │ Full UI     │    │ Batch jobs  │    │ Auth, scan, │  │
│  │ file watch  │    │ Reports     │    │ CI/CD       │    │ billing     │  │
│  │ In-editor   │    │ Roadmaps    │    │ Export      │    │ WebSocket   │  │
│  │ diagnostics │    │ Gate status │    │ Pipeline    │    │ Events      │  │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘  │
│         │                  │                  │                  │         │
│         └──────────────────┴──────────────────┴──────────────────┘         │
│                                Shared Scanners                              │
│                    ┌─────────────────────────────────┐                     │
│                    │  credential-pattern-scanner   │                     │
│                    │  fiction-kpi-guard              │                     │
│                    │  production-leak-intent         │                     │
│                    │  architecture-drift             │                     │
│                    │  eu-ai-act-patterns           │                     │
│                    │  token-bleed-patterns         │                     │
│                    │  llm-slop-patterns            │                     │
│                    │  ... 50+ analyzers            │                     │
│                    └─────────────────────────────────┘                     │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        coming-soon/ Pages                           │  │
│  │   (Pricing, Roadmap Generator, Audit Report, Upload/Dashboard)      │  │
│  │   Static HTML + JS, deployed alongside dashboard or standalone      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. VS Code Extension (`ai-platform/simplebeacon-vscode/`)

**Purpose**: In-editor scanning, diagnostics, and issue navigation.

### Files
| File | Role |
|------|------|
| `extension.ts` | Entry point — registers commands, tree view, auto-scan |
| `simplebeaconProvider.ts` | TreeDataProvider for Issues panel |
| `scanPanel.ts` | Webview panel for running scans via API |
| `uploadPanel.ts` | Webview panel for uploading/validating reports |
| `diagnostics.ts` | VS Code diagnostic collection (red squiggles) |

### Commands
- `simplebeacon.scanWorkspace` — Scan entire workspace folder
- `simplebeacon.scanFolder` — Right-click scan any folder
- `simplebeacon.uploadReport` — Upload & validate a report JSON
- `simplebeacon.refreshResults` — Refresh issues tree
- `simplebeacon.clearResults` — Clear all results
- `simplebeacon.openIssue` — Navigate to file:line in editor

### API Integration
The extension talks to the SimpleBeacon API server (default: `http://127.0.0.1:3000`).
Configuration via VS Code settings:
- `simplebeacon.apiUrl`
- `simplebeacon.apiKey`
- `simplebeacon.autoScanOnOpen`
- `simplebeacon.severityFilter`

---

## 2. Dashboard (`ai-platform/web/simplebeacon-dashboard/`)

**Purpose**: Full-featured web UI for scan results, roadmaps, compliance, and settings.

### Architecture
- **SPA** (Single Page Application) with hash-based routing (`#/dashboard`, `#/analyze`, etc.)
- **AuthService** handles tokens via localStorage + cookies
- **Router** loads views dynamically from `js/views/`
- **ScanService** polls for background scan updates

### Key Views
| View | File | Purpose |
|------|------|---------|
| Dashboard | `DashboardView.js` | Scorecards, stats, gate status |
| Analyze | `AnalyzeView.js` | Run scans, configure settings |
| Results | `ResultsView.js` | Issue list with filters |
| Remediation Roadmap | `RemediationRoadmapView.js` | Auto-generated fix phases |
| Sign In | `SignInView.js` | Token + email auth |
| Settings | `SettingsView.js` | User preferences |

### Cross-Tab Auth
- `storage` event listener detects sign-out in other tabs
- Custom `auth-signed-out` event triggers UI update + redirect

---

## 3. CLI (`packages/simplebeacon-cli/`)

**Purpose**: Headless scanning, CI/CD integration, batch processing.

### Entry Points
- `packages/simplebeacon-cli/bin/simplebeacon.js` — Main CLI binary

### Key Scanners
| Scanner | File | Detects |
|---------|------|---------|
| Environment Variable Analyzer | `environment-variable-analyzer.js` | Missing/unused env keys, secrets |
| Config Management Analyzer | `config-management-analyzer.js` | Config sprawl, duplicates |
| Dependency Health Analyzer | `dependency-health-analyzer.js` | Version drift, unused deps |
| Build Artifact Scanner | `build-artifact-scanner.js` | node_modules, dist, coverage |
| ... | ... | ... |

### Configuration
`.simplebeacon/config.json` controls:
- Which rules are enabled
- Severity thresholds
- Ignore patterns
- Gate criteria (failOn/warnOn)

---

## 4. Server (`ai-platform/server/`)

**Purpose**: REST API, WebSocket events, auth, billing, file upload.

### Key Routes
| Route | Purpose |
|-------|---------|
| `POST /api/scan` | Run a scan (delegates to CLI) |
| `POST /api/analyze` | Flexible analysis API |
| `GET /api/auth/me` | Current user/session |
| `POST /api/auth/login` | JWT login |
| `POST /api/auth/token` | License token validation |
| `POST /api/upload` | Report upload |
| `WS /ws` | Real-time scan progress |

### Middleware Stack
- Security headers (Helmet)
- Rate limiting
- CORS
- JWT authentication
- Audit logging
- Input validation

---

## 5. Coming-Soon Pages (`coming-soon/`)

**Purpose**: Marketing, audit reports, roadmap generator, pricing.

### Pages
| Page | Purpose |
|------|---------|
| `pricing.html` | Pricing tiers, checkout |
| `roadmap.html` | Standalone remediation roadmap viewer |
| `upload.html` | Report upload + certificate generation |
| `dashboard.html` | Teams dashboard (external) |

### Features
- Dynamic vault link (detects running server port)
- Cross-tab auth synchronization
- Certificate generation (client-side, zero data leaves browser)

---

## Data Flow

### Scan Flow
```
User (VS Code / Dashboard / CLI)
    │
    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  API Server │────►│ CLI Scanner │────►│  Report JSON│
│  (Express)  │     │ (Node.js)   │     │             │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                                │
                    ┌─────────────────────────────┘
                    ▼
          ┌─────────────────┐
          │ Dashboard /     │
          │ VS Code Ext     │
          │ Coming-Soon     │
          └─────────────────┘
```

### Auth Flow
```
Sign In (token or email)
    │
    ▼
┌─────────────┐
│ AuthService │──► localStorage: cascadeAuthToken
│ (main.js)   │    localStorage: cascadeAuthUser
└─────────────┘    Cookies (cross-port sync)
    │
    ▼
┌─────────────┐
│ Cross-tab   │──► storage event clears all tabs
│ sync        │    on sign-out
└─────────────┘
```

---

## Packaging the VS Code Extension

### Prerequisites
```bash
cd ai-platform/simplebeacon-vscode
npm install
npm install -g @vscode/vsce
```

### Compile
```bash
npm run compile
```

### Package
```bash
vsce package
```

Produces: `simplebeacon-1.0.0.vsix`

### Install (for testing)
```bash
code --install-extension simplebeacon-1.0.0.vsix
```

### Publish
```bash
vsce publish
```

---

## Development Workflow

1. **Make changes** in `src/*.ts`
2. **Compile**: `npm run compile`
3. **Test**: Press F5 in VS Code (launches Extension Development Host)
4. **Package**: `vsce package`
5. **Publish**: `vsce publish`

---

## Environment Files

| File | Environment | Purpose |
|------|-------------|---------|
| `.env` | Root dev | Main app config |
| `ai-platform/.env.v1-internal` | v1-internal dev | Server config (different port, auth) |
| `ai-platform/.env.production` | Production | Production settings |
| `.env.example` | Template | Documentation |

---

## Key Technologies

| Layer | Tech |
|-------|------|
| Frontend | Vanilla JS, CSS variables, Lucide icons |
| VS Code Ext | TypeScript, VS Code API |
| Server | Express, JWT, Helmet, Rate Limit |
| CLI | Node.js, AST parsing, pattern matching |
| DB (Phase 2) | PostgreSQL, Redis |
| AI | Ollama (local), OpenAI (optional) |
