# Phase 2A Runtime Log Hygiene Runbook

Scope: active runtime/server paths only (`server/**`, `src/server/**`, runtime entrypoints).  
Goal: remove or gate unguarded runtime debug/info artifacts without changing behavior.

## 1) Prepare and Baseline

```bash
cd C:/Users/Trevor/CascadeProjects/ai-platform
git status --short
```

## 2) Find Remaining Runtime Debug Artifacts (Scoped)

```bash
rg "console\.(log|debug|info)\(|debugger;" server src/server "{server.js,unified-server.js,fixed-server.js,complete-server.js,gguf-dashboard-server.js,enhanced-auth-server.js,simple-server.js}"
```

## 3) Apply Low-Risk Hygiene

- Keep `console.warn` and `console.error` for operational visibility.
- Convert startup/debug chatter to env-gated logs:
  - gate with `LOG_RUNTIME_INFO=true` or `RUNTIME_DEBUG=true`
  - prefer `console.info(...)` for gated informational messages.
- Reuse existing auth/audit log gates where already present.

## 4) Hard Gates

### Gate A — Medium findings are zero
```bash
npm run simplebeacon:report
```
Pass criteria: medium severity findings in `.simplebeacon/report.json` are `0`.

### Gate B — Targeted debug artifacts addressed (scoped files)
```bash
rg "console\.(log|debug)\(|debugger;" \
  server/bootstrap/phase2-integration.js \
  server/routes/local-models-api.js \
  server/routes/flexible-analyze-api.js \
  server/lib/legacy-page-redirects.js \
  server/services/user-service.js
```
Pass criteria: no unguarded matches remain in scoped tranche files.

### Gate C — Targeted tests/smoke
```bash
npm run test:auth -- --runInBand
npm run verify:route-smoke
```
Pass criteria: both commands exit `0`.

### Gate D — Syntax checks for touched JS files
```bash
node --check server/bootstrap/phase2-integration.js
node --check server/routes/local-models-api.js
node --check server/routes/flexible-analyze-api.js
node --check server/lib/legacy-page-redirects.js
node --check server/services/user-service.js
```
Pass criteria: all commands exit `0`.

## 5) Report-Out Format

- Files changed (exact list).
- Commands run with key output lines.
- Gate status matrix (A/B/C/D pass/fail).
- Smallest next tranche recommendation.
