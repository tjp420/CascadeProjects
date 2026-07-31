# Test Plan: Consolidate isRemoteDashboardHost + isAbsoluteLocalPath + normalizeSlashes

**Date:** 2026-07-31
**Branch:** main
**Feature:** Consolidate 3 duplicate functions into their canonical
utils-lib modules and update all consumers to import from there.

## Context

Three functions are duplicated across views/services:

1. **isRemoteDashboardHost** — 3 identical definitions:
   - `views/AnalyzeView.js` (line 18) — used 31 times
   - `components/ScanStatus.js` (line 7) — used 8 times
   - `services/scanStrategy.js` (line 110) — used 1 time
   - **Canonical:** `utils-lib/url.js` (already has `_isLoopbackHost` private)

2. **isAbsoluteLocalPath** — 2 identical definitions:
   - `views/AnalyzeView.js` (line 25) — used 8 times
   - `components/ScanStatus.js` (line 10) — used 5 times
   - **Canonical:** `utils-lib/path.js`

3. **normalizeSlashes** — 2 definitions with different signatures:
   - `utils-lib/string.js` (line 31) — simple: `(path)` only
   - `utils-lib/path.js` (line 12) — extended: `(path, opts)` with stripLeadingDot/lowercase
   - `utils.js` re-exports the SIMPLE version (bug — should be the extended one)
   - **Canonical:** `utils-lib/path.js` (has opts parameter)

## Files to Change

| File | Change |
|------|--------|
| `utils-lib/url.js` | Add `isRemoteDashboardHost` export |
| `utils-lib/path.js` | Add `isAbsoluteLocalPath` export |
| `utils.js` | Re-export `isRemoteDashboardHost`, `isAbsoluteLocalPath`; fix `normalizeSlashes` to use PathUtils |
| `views/AnalyzeView.js` | Remove local copies, import from utils.js |
| `components/ScanStatus.js` | Remove local copies, import from utils.js |
| `services/scanStrategy.js` | Remove local copy, import from utils.js |

## Objective Check-Items

### Level 1 — Deterministic

| # | Item | Expected |
|---|------|----------|
| L1.1 | `node -c` on all 6 edited files | exit 0 |
| L1.2 | `npx simplebeacon scan --gate` | PASS (exit 0) |
| L1.3 | WebSocket integration test still passes | 16/16 pass |

### Level 2 — Behavioral

| # | Item | Expected |
|---|------|----------|
| L2.1 | `isRemoteDashboardHost()` returns true on remote hosts | Same logic as before |
| L2.2 | `isAbsoluteLocalPath()` detects Windows/Unix absolute paths | Same logic as before |
| L2.3 | `normalizeSlashes()` with opts still works | PathUtils version supports opts |
| L2.4 | No duplicate function definitions remain | grep finds 0 local defs |

### Level 3 — Self-review / drift

| # | Item | Expected |
|---|------|----------|
| L3.1 | No new files created | Only edits to existing files |
| L3.2 | No new dependencies | Uses existing utils.js import |
| L3.3 | normalizeSlashes fix: PathUtils version is backward-compatible | opts param is optional |
| L3.4 | Import paths use existing cache-busting convention | `?v=20260731audit2` |
| L3.5 | All 3 functions have identical behavior to before | No logic changes, only relocation |
