# Test Plan: Export Collision Cleanup

**Date:** 2026-07-31
**Branch:** main
**Issue:** 48 `SimplebeaconExportCollision` warnings on server startup from the
simplebeacon barrel loader (`packages/simplebeacon-cli/src/index.js`).

## Root Cause

The barrel loader in `index.js` flattens ~50 module exports into one namespace.
Five modules re-export utility functions that are already exported by dedicated
utility modules, causing collisions:

| Module | Colliding Exports | Canonical Source |
|--------|-------------------|-------------------|
| `reporters/audit-report.js` | 40 utilities (isBlank, isEmpty, capitalize, etc.) | `utils/string`, `utils/object`, `utils/functional`, `utils/async` |
| `lib/ai-problem-analyzer-suite.js` | 28 utilities | Same as above |
| `compliance-checklist.js` | `formatBytes` | `lib/format-utils` (via `scan.js`) |
| `config.js` | `normalizePathKey` | `lib/path-utils` |
| `lib/simplebeacon-report-export-sanitize.js` | `redactProjectPathForExport`, `projectLabelFromPath` | `lib/assessment-export-sanitize.js` |
| `lib/ai-problem-analyzer-export-sanitize.js` | `projectLabelFromPath` | `lib/assessment-export-sanitize.js` |
| `utils/async-advanced.js` | `retry`, `withTimeout`, `delay` | `utils/async` |

## Fix Strategy

Remove utility re-exports from the five secondary modules. Keep them in the
canonical dedicated utility modules. No external code imports these utilities
from the secondary modules (verified by subagent search).

## Objective Check-Items

### Level 1 — Deterministic

| # | Item | Command | Pass Criteria |
|---|------|---------|---------------|
| L1.1 | All changed files syntax check | `node -c <file>` | Exit 0 for each |
| L1.2 | CLI tests pass | `cd packages/simplebeacon-cli && npm test` | All pass |
| L1.3 | Gate scan passes | `npx simplebeacon scan --gate` | Exit 0 |

### Level 2 — Behavioral

| # | Item | Method | Pass Criteria |
|---|------|--------|---------------|
| L2.1 | No collision warnings | Run server, check stderr | Zero SimplebeaconExportCollision warnings |
| L2.2 | audit-report functions still work | Run existing tests | audit-report.test.js passes |
| L2.3 | ai-problem-analyzer functions still work | Run existing tests | All analyzer tests pass |
| L2.4 | compliance-checklist formatBytes still works internally | Code review | Internal usage preserved |

### Level 3 — Self-review

| # | Item | Pass Criteria |
|---|------|---------------|
| L3.1 | No new files created | Broom strategy |
| L3.2 | No new dependencies | package.json unchanged |
| L3.3 | Internal usage of utilities preserved | Functions still defined locally, just not re-exported |
| L3.4 | No external imports of removed re-exports | Verified by subagent search |

## Files Changed

| File | Action |
|------|--------|
| `packages/simplebeacon-cli/src/reporters/audit-report.js` | Remove 40 utility re-exports from module.exports |
| `packages/simplebeacon-cli/src/lib/ai-problem-analyzer-suite.js` | Remove 28 utility re-exports from module.exports |
| `packages/simplebeacon-cli/src/scan.js` | Remove `formatBytes` from module.exports |
| `packages/simplebeacon-cli/src/config.js` | Remove `normalizePathKey` from module.exports |
| `packages/simplebeacon-cli/src/compliance-checklist.js` | Remove `formatBytes` from module.exports |
| `packages/simplebeacon-cli/src/lib/simplebeacon-report-export-sanitize.js` | Remove `redactProjectPathForExport`, `projectLabelFromPath` from module.exports |
| `packages/simplebeacon-cli/src/lib/ai-problem-analyzer-export-sanitize.js` | Remove `projectLabelFromPath` from module.exports |
| `packages/simplebeacon-cli/src/utils/async-advanced.js` | Remove `retry`, `withTimeout`, `delay` from module.exports if duplicated |
