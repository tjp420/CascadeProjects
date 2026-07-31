# Software Health Report: Export Collision Cleanup

**Date:** 2026-07-31
**Branch:** main
**Validator:** Devin (acting as Validator)
**Issue:** 48 `SimplebeaconExportCollision` warnings on server startup from the
simplebeacon barrel loader (`packages/simplebeacon-cli/src/index.js`).

## Gate Status

| Check | Result |
|-------|--------|
| SimpleBeacon gate scan | PASS (exit 0) |
| Collision warnings | 0 (down from 48) |
| CLI tests | 575 pass, 0 fail, 2 skipped |
| All changed files syntax | PASS (`node -c` exit 0) |

## Level 1 — Deterministic (all required)

| # | Item | Result | Evidence |
|---|------|--------|----------|
| L1.1 | All changed files syntax check | PASS | `node -c` exit 0 for all 11 files |
| L1.2 | CLI tests pass | PASS | 575 pass, 0 fail, 2 skipped |
| L1.3 | Gate scan passes | PASS | Exit 0, 0 collision warnings |

## Level 2 — Behavioral

| # | Item | Result | Evidence |
|---|------|--------|----------|
| L2.1 | Zero collision warnings | PASS | `npx simplebeacon scan --gate` produces 0 SimplebeaconExportCollision |
| L2.2 | audit-report functions still work | PASS | audit-report.test.js passes |
| L2.3 | ai-problem-analyzer functions still work | PASS | All analyzer tests pass |
| L2.4 | file-reduction formatBytes works | PASS | file-reduction.test.js passes (imports from lib/format-utils) |
| L2.5 | Simplebeacon.utils has capitalize/pluralize/truncate | PASS | index.test.js line 84-91 passes |
| L2.6 | Simplebeacon.report has formatJsonReport | PASS | index.test.js line 77-80 passes |
| L2.7 | index.sleep/retry/memoize/camelCase/noop | PASS | index.test.js line 35-41 passes |

## Level 3 — Self-review / drift

| # | Item | Result | Evidence |
|---|------|--------|----------|
| L3.1 | No new files created | PASS | Only edited existing files |
| L3.2 | No new dependencies | PASS | package.json unchanged |
| L3.3 | Canonical utility modules are source of truth | PASS | utils/string.js has capitalize/pluralize/truncate; utils/functional.js has memoize |
| L3.4 | No external imports of removed re-exports | PASS | Verified by subagent search |
| L3.5 | Internal usage preserved | PASS | Functions still defined locally in modules, just not re-exported |
| L3.6 | ai-problem-analyzer-suite removed from utils namespace | PASS | Was not a utility module; its utilities were duplicates |

## Defects

None.

## Root Cause Analysis

The barrel loader in `packages/simplebeacon-cli/src/index.js` flattens ~50 module
exports into one namespace. Five modules re-exported utility functions that were
already exported by dedicated utility modules, causing 48 collision warnings:

1. **reporters/audit-report.js** — exported 40+ utilities (isBlank, isEmpty, capitalize,
   pluralize, truncate, sleep, delay, hash, etc.) that collided with utils/string,
   utils/object, utils/functional, utils/async
2. **lib/ai-problem-analyzer-suite.js** — exported 28 utilities + clampScore that
   collided with the same utils modules and ai-problem-analyzer-export-sanitize
3. **compliance-checklist.js** — exported formatBytes that collided with scan.js
   (which imports from lib/format-utils)
4. **config.js** — exported normalizePathKey that collided with lib/path-utils
5. **lib/simplebeacon-report-export-sanitize.js** — exported redactProjectPathForExport
   and projectLabelFromPath that collided with lib/assessment-export-sanitize
6. **lib/ai-problem-analyzer-export-sanitize.js** — exported projectLabelFromPath
   that collided with lib/assessment-export-sanitize
7. **utils/async-advanced.js** — exported retry, withTimeout, delay that collided
   with utils/async

## Fix Summary

### Canonical utility modules enriched
- `utils/string.js`: Added `capitalize`, `pluralize`, `truncate` (moved from audit-report)
- `utils/functional.js`: Added `memoize` (moved from audit-report)

### Re-exports removed from secondary modules
- `reporters/audit-report.js`: Removed 40+ utility re-exports, kept only report functions
- `lib/ai-problem-analyzer-suite.js`: Removed 28 utility re-exports + clampScore
- `scan.js`: Removed `formatBytes` re-export (canonical source: lib/format-utils)
- `config.js`: Removed `normalizePathKey` re-export (canonical source: lib/path-utils)
- `compliance-checklist.js`: Removed `formatBytes` re-export
- `lib/simplebeacon-report-export-sanitize.js`: Removed `redactProjectPathForExport`, `projectLabelFromPath`
- `lib/ai-problem-analyzer-export-sanitize.js`: Removed `projectLabelFromPath`
- `utils/async-advanced.js`: Removed `retry`, `withTimeout`, `delay` (canonical source: utils/async)

### Namespace cleanup
- `index.js`: Removed `lib/ai-problem-analyzer-suite` from `utils` multi-namespace
  (it's an analyzer module, not a utility module)

### Test updates
- `tests/scan.test.js`: Import `formatBytes` from `lib/format-utils` instead of `scan.js`
- `tests/index.test.js`: Updated `Simplebeacon.report` test to check `compileAuditReportMarkdown`
  instead of `capitalize`/`pluralize`/`truncate` (now in `Simplebeacon.utils`)

### Import fix
- `reporters/file-reduction-report.js`: Import `formatBytes` from `lib/format-utils`
  instead of `../scan`

## Files Changed (11 files)

| File | Action |
|------|--------|
| `packages/simplebeacon-cli/src/utils/string.js` | Added capitalize, pluralize, truncate |
| `packages/simplebeacon-cli/src/utils/functional.js` | Added memoize |
| `packages/simplebeacon-cli/src/reporters/audit-report.js` | Removed 40+ utility re-exports |
| `packages/simplebeacon-cli/src/lib/ai-problem-analyzer-suite.js` | Removed 28 utility re-exports + clampScore |
| `packages/simplebeacon-cli/src/scan.js` | Removed formatBytes re-export |
| `packages/simplebeacon-cli/src/config.js` | Removed normalizePathKey re-export |
| `packages/simplebeacon-cli/src/compliance-checklist.js` | Removed formatBytes re-export |
| `packages/simplebeacon-cli/src/lib/simplebeacon-report-export-sanitize.js` | Removed 2 sanitize re-exports |
| `packages/simplebeacon-cli/src/lib/ai-problem-analyzer-export-sanitize.js` | Removed projectLabelFromPath re-export |
| `packages/simplebeacon-cli/src/utils/async-advanced.js` | Removed 3 duplicate async re-exports |
| `packages/simplebeacon-cli/src/index.js` | Removed ai-problem-analyzer-suite from utils namespace |
| `packages/simplebeacon-cli/tests/scan.test.js` | Updated formatBytes import |
| `packages/simplebeacon-cli/tests/index.test.js` | Updated report namespace test |

## Enhancements (future)

1. **Consolidate remaining utility duplicates**: `audit-report.js` and
   `ai-problem-analyzer-suite.js` still define `isBlank`, `isEmpty`, `ensureArray`,
   etc. locally. These could be imported from utils modules instead of being
   redefined.
2. **Add barrel integrity test**: A test that checks for collision warnings on
   module load would prevent regressions.
3. **Consider ESM named exports**: The CommonJS barrel pattern is inherently
   collision-prone. Migrating to ESM named exports would make collisions
   impossible at the module level.

## Validator Sign-off

- [x] All Level 1 checks pass
- [x] All Level 2 checks pass
- [x] All Level 3 checks pass
- [x] Gate scan passes with 0 collision warnings
- [x] All 575 CLI tests pass
- [x] No defects found
- [x] Ready for commit
