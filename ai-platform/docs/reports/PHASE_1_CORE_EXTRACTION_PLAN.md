# Phase 1 Core Extraction (Non-destructive)

## Scope completed

- Established a standalone `core/` module boundary using adapter/re-export files.
- Preserved backward compatibility for existing app imports and routes.
- Added independent tests for:
  - core export boundary,
  - fixture-based scan + fix + rollback flow without dashboard server startup,
  - essential issue API route surface.

## Core mapping table (old path -> new/adapter path)

| Core concern | Existing implementation path(s) | Phase 1 adapter / boundary path |
|---|---|---|
| Issue analyzer engine | `src/core/GGUFIssueAnalyzer.js` | `core/engines/issue-analyzer.js` |
| Fix engine (apply + rollback) | `src/core/GGUFFixEngine.js` | `core/engines/fix-engine.js` |
| Issue API endpoints (scan/detect/fix/rollback) | `src/api/gguf-issues-api.js` | `core/api/issues-api.js` |
| Severity scoring integration (local/cloud hooks) | `server/services/model-inference-service.js`, `server/services/cloud-inference-service.js`, `server/services/local-model-service.js` | `core/severity/scoring-integration.js` |
| File monitor / chokidar integration | `src/core/GGUFIssueAnalyzer.js` (watcher), `src/core/GlobalContextManager.js` (watcher infra) | `core/monitor/file-monitor.js` |
| Core package entrypoint | N/A | `core/index.js` |

## Essential API endpoint set kept stable

- `GET /api/gguf/issues/scan`
- `POST /api/gguf/issues/detect`
- `POST /api/gguf/issues/fix/preview`
- `POST /api/gguf/issues/fix/apply`
- `POST /api/gguf/issues/fix/batch`
- `POST /api/gguf/issues/fix/rollback/:fixId`
- `GET /api/gguf/issues/fix/history`
- `GET /api/gguf/issues/fix/stats`

## Phase 2 archive candidates (plan only, no deletion)

| Candidate | Keep/archive recommendation | Why (direct bug detection/fixing value) | Risk note |
|---|---|---|---|
| `dashboard-server.js` | Archive candidate after cutover | Mostly dashboard/static/legacy routes; not required for core issue engine | Medium: unknown local tooling may still launch it |
| `fix-server-export.js` | Archive candidate | One-off mutation script, not runtime core | Low |
| `web/scripts/issue-resolution-page.js` | Keep until API contract freeze | UI consumer of core endpoints but not core engine | Medium: frontend breakage if removed early |
| `src/web/issue-resolution.html` | Keep until dashboard split complete | Dashboard surface only; not required for engine execution | Medium |
| `docs/reports/*dashboard*` historical artifacts | Archive candidate batch | Documentation-heavy and operationally decoupled from runtime core | Low |
| `docs/reports/*SPRINT*_SUMMARY*.md` (legacy dashboard streams) | Archive candidate batch | Historical reporting; no runtime detection/fix behavior | Low |
| `web/data/*sample*.json` dashboard display samples | Keep in short term, then archive by usage | Useful for UI demos, but not needed for core engine runtime | Medium: tests/pages may still consume sample payloads |

## Phase 2 readiness notes

- Core boundary now exists and can be imported independently via `core/index.js`.
- Existing API module now imports engines through core adapters, reducing direct coupling.
- Next safe tranche: route-level extraction into dedicated core HTTP module + optional dashboard decoupling.
