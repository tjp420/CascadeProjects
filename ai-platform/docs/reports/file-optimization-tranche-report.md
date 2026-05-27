# File Optimization Tranche Report

Date: 2026-05-25  
Scope: staged optimization for dashboard/mock stack and audit-scoped paths

## Baseline

### Target file sizes (before)

- `web/dashboard.html`: 662,394 bytes
- `web/dashboard-new.html`: 590,731 bytes
- `web/scripts/dashboard-scripts.js`: 485,988 bytes
- `web/api/mock-backend.js`: 325,117 bytes

### Audit path totals (before)

- `web/data`: 264,699 bytes across 40 files
- `data/mock`: 362 bytes across 1 file
- `data-central/ai-tools/mock-data`: 289 bytes across 1 file
- `data/roadmap`: 4,849,906 bytes across 4 files

### Dependency/reference mapping summary

- `web/dashboard.html` is served by server routes in `server/index.js`, `unified-server.js`, and `simple_http_server.js`.
- `web/dashboard-new.html` is served by `fixed-server.js`, `gguf-dashboard-server.js`, and `complete-server.js`.
- `web/scripts/dashboard-scripts.js` is a bundle entry (`web/scripts/webpack.config.js`) and referenced by tooling/docs; `dashboard.html` now consumes its static payload companion.
- `web/api/mock-backend.js` is published via `/api/mock-backend.js` in `src/api/dashboard-stub-api.js` and `fixed-server.js`; runtime consumers are dashboard pages making `/api/*` fetches.
- Audit path references are enforced by Simplebeacon config/tests (`packages/simplebeacon-cli/src/config.js`, multiple tests) and roadmap resolvers (`server/lib/sample-path-resolver.js`, `src/api/*roadmap*`).

## Implemented Changes (low-risk, rollback-safe)

### 1) `web/api/mock-backend.js` optimization

- Externalized the largest static GGUF report payload into new `web/api/mock-backend-static-data.js`.
- `mock-backend.js` now reads `globalThis.__MOCK_BACKEND_STATIC_DATA` when available and keeps a safe fallback object.
- Removed one duplicate `generateDatabaseMetrics()` method definition (earlier scalar version), preserving the later array-shape endpoint contract.

### 2) Dashboard HTML staged de-bloat

- Extracted primary inline CSS from:
  - `web/dashboard.html` -> `web/styles/dashboard-core.css`
  - `web/dashboard-new.html` -> `web/styles/dashboard-new-core.css`
- Wired non-breaking stylesheet includes with cache-busting query params.
- In `dashboard-new.html`, removed duplicate Chart.js script include.
- In `dashboard-new.html`, inserted `mock-backend-static-data.js` before `mock-backend.js` to preserve load order.

### 3) `dashboard-scripts.js` incremental extraction

- Externalized large immutable in-file payloads (`comprehensiveAnalysisData`, `roadmapData`) to `web/scripts/dashboard-static-data.js`.
- `dashboard-scripts.js` now reads from `window.__DASHBOARD_STATIC_DATA` with compatibility fallbacks.
- Added include in `dashboard.html` for `scripts/dashboard-static-data.js`.

### 4) Audit path pass

- Ran hash-based dedupe scan across:
  - `web/data`
  - `data/mock`
  - `data-central/ai-tools/mock-data`
  - `data/roadmap`
- Result: 46 files scanned, 0 exact duplicate groups found.
- `data/roadmap/archive/` remains dominant size hotspot (~4.83 MB) and is already archive-class content; no risky mutation done in this tranche.

## Validation

### Commands run

- Baseline + after sizing (files + audit paths) via Python size walkers.
- Duplicate-content audit scan (SHA-256 grouping) for the 4 scope paths.
- Endpoint compatibility validation:
  - `node tools/validate-mock-backend-compat.js`
- Existing dashboard E2E checks:
  - `npm run test:export -- --runInBand`
- Build readiness probes:
  - `npm run build`
  - `npx webpack --config web/scripts/webpack.config.js --mode production`

### Validation results

- Mock backend compatibility script passed:
  - `/api/gguf/mock-analysis-report` contract preserved
  - `/api/gguf/mock-analysis-summary` contract preserved
  - `/api/database/metrics` contract preserved (array shape)
  - `/api/analytics/alerts` contract preserved
- Dashboard export/E2E suite passed (151 tests, 0 failures).
- Build probes surfaced pre-existing blockers outside this tranche:
  - root `npm run build` fails because the default webpack entry resolves `./src/index` (not present in current layout),
  - targeted dashboard webpack config requires missing package `html-webpack-plugin`.

## Size Deltas

### Target file sizes (after)

- `web/dashboard.html`: 632,729 bytes (**-29,665**)
- `web/dashboard-new.html`: 242,810 bytes (**-347,921**)
- `web/scripts/dashboard-scripts.js`: 491,045 bytes (**+5,057**)
- `web/api/mock-backend.js`: 318,278 bytes (**-6,839**)

### Added companion assets (new files)

- `web/styles/dashboard-core.css`: 44,201 bytes
- `web/styles/dashboard-new-core.css`: 347,947 bytes
- `web/api/mock-backend-static-data.js`: 8,474 bytes
- `web/scripts/dashboard-static-data.js`: 5,845 bytes

### Audit path totals (after)

- `web/data`: 264,699 bytes (no change)
- `data/mock`: 362 bytes (no change)
- `data-central/ai-tools/mock-data`: 289 bytes (no change)
- `data/roadmap`: 4,849,906 bytes (no change)

## Risk Notes

- Extracted CSS and static payload modules are load-order dependent; includes were inserted ahead of dependent scripts to keep behavior stable.
- No route/API signatures were changed.
- No archival/deletion was performed in audit paths due to schema/reference sensitivity and to keep this tranche rollback-safe.

## Next Checkpoints for Larger Reductions

1. Split `dashboard-scripts.js` into page-level lazy modules loaded on nav section activation (high impact, medium risk).
2. Move dashboard HTML export-template `<style>` strings (generated report HTML) into helper modules to reduce base parser weight.
3. Add build pipeline flag for production minification/compression:
   - ensure `webpack --mode production` emits minimized assets for dashboard bundles
   - document optional precompressed (`.gz`/`.br`) static serving path for Node servers.
   - unblock by either adding `html-webpack-plugin` (and related loaders/plugins) or simplifying the dashboard-specific webpack config to match installed deps.
4. `data/roadmap/archive` follow-up:
   - add explicit archive manifest + exclusion-from-runtime assertion tests
   - then safely relocate/archive larger legacy snapshots outside runtime tree if accepted.
