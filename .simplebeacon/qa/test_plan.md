# Test Plan — Drag-and-Drop Telemetry Exposure

**Branch:** `feature/drop-telemetry`
**Date:** 2026-08-02
**Status:** Active

## Objective

Expose drag-and-drop pre-read success counters and Firefox fallback bypass metrics to the frontend Analytical Dashboard. Since drag-and-drop scan telemetry is purely client-side (no server involvement), this is a client-side only telemetry dashboard — no backend API endpoint needed.

## Architecture

- **Counters**: Module-level in-memory counters in `dropFolderTraversal.ts` — track pre-read success, pre-read skip (files >2 MB), pre-read failure, drop traversal errors, total files dropped, drop method
- **Service**: `dropTelemetryService.js` — reads the in-memory counters directly (no fetch needed)
- **Component**: `DropTelemetryDashboard.js` — renders metric chips with auto-refresh

## Change Set

| File | Change |
|------|--------|
| `coming-soon/public/app/src/services/dropFolderTraversal.ts` | Add `DropTelemetry` counters object + `getDropTelemetry()` export |
| `coming-soon/public/dashboard/src/services/dropFolderTraversal.ts` | Same fix (dashboard version) |
| `coming-soon/public/app/js-es2018/services/dropTelemetryService.js` | **New** — Dashboard service |
| `coming-soon/public/app/js-es2018/components/DropTelemetryDashboard.js` | **New** — Dashboard component |
| `coming-soon/public/app/src/services/dropFolderTraversal.test.ts` | **New** — Test suite for counters |

## Check Items

### Level 1 — Deterministic

- [ ] L1.1 `node -c` on all changed JS files — PASS
- [ ] L1.2 TypeScript compiles without errors
- [ ] L1.3 No new dependencies added
- [ ] L1.4 No secrets committed

### Level 2 — Functional Operations

- [ ] L2.01 `getDropTelemetry()` returns counters object with all expected fields
- [ ] L2.02 Counters increment correctly during drop traversal
- [ ] L2.03 `resetDropTelemetry()` resets all counters to zero
- [ ] L2.04 DropTelemetryService reads counters from dropFolderTraversal module
- [ ] L2.05 DropTelemetryDashboard renders metric chips

### Level 3 — Self-review / Drift

- [ ] L3.01 No scope creep — only telemetry files touched
- [ ] L3.02 No ghost files or hallucinated API paths
- [ ] L3.03 Counters are client-side only (no backend endpoint needed)
- [ ] L3.04 All existing tests still pass (no regression)
