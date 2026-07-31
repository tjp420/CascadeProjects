# Software Health Report: Consolidate isRemoteDashboardHost + isAbsoluteLocalPath + normalizeSlashes

**Date:** 2026-07-31
**Branch:** main
**Validator:** Devin (acting as Validator)
**Feature:** Consolidate 3 duplicate functions into canonical utils-lib
modules and update all consumers to import from there.

## Gate Status

| Check | Result |
|-------|--------|
| SimpleBeacon gate scan | PASS (exit 0) |
| WebSocket integration test | 16/16 pass, 0 fail |
| Syntax check (6 edited files) | PASS (all `node -c` exit 0) |
| No duplicate local definitions remain | PASS (grep finds 0) |

## Level 1 — Deterministic (all required)

| # | Item | Result | Evidence |
|---|------|--------|----------|
| L1.1 | `node -c` on all 6 edited files | PASS | All exit 0 |
| L1.2 | `npx simplebeacon scan --gate` | PASS | exit 0 |
| L1.3 | WebSocket integration test | PASS | 16/16 pass |

## Level 2 — Behavioral

| # | Item | Result | Evidence |
|---|------|--------|----------|
| L2.1 | `isRemoteDashboardHost()` returns true on remote hosts | PASS | Identical logic relocated to utils-lib/url.js |
| L2.2 | `isAbsoluteLocalPath()` detects Windows/Unix absolute paths | PASS | Identical logic relocated to utils-lib/path.js |
| L2.3 | `normalizeSlashes()` with opts still works | PASS | Now uses PathUtils version (has opts param, backward-compatible) |
| L2.4 | No duplicate function definitions remain | PASS | grep for `^function isRemoteDashboardHost\|^function isAbsoluteLocalPath` → 0 matches |

## Level 3 — Self-review / drift

| # | Item | Result | Evidence |
|---|------|--------|----------|
| L3.1 | No new files created | PASS | Only edits to 6 existing files |
| L3.2 | No new dependencies | PASS | Uses existing utils.js import chain |
| L3.3 | normalizeSlashes fix: PathUtils version is backward-compatible | PASS | `opts` param is optional, defaults to `{}` |
| L3.4 | Import paths use existing cache-busting convention | PASS | `?v=20260731audit2` follows pattern |
| L3.5 | All 3 functions have identical behavior to before | PASS | No logic changes, only relocation; normalizeSlashes now uses extended version (superset of old behavior) |

## Defects

None.

## Bug Fix: normalizeSlashes canonical source

**Before:** `utils.js` re-exported `normalizeSlashes` from `StringUtils`
(`utils-lib/string.js`) — the simple version that only takes `(path)`.

**After:** `utils.js` now re-exports from `PathUtils` (`utils-lib/path.js`)
— the extended version that takes `(path, opts)` with `stripLeadingDot`
and `lowercase` options.

This is backward-compatible because `opts` defaults to `{}`, making the
extended version behave identically to the simple version when called
without opts. Any code that was importing `normalizeSlashes` from
`utils.js` now gets the superset version.

## Files Changed (6 files)

| File | Change |
|------|--------|
| `utils-lib/url.js` | Added `isRemoteDashboardHost` export (8 lines) |
| `utils-lib/path.js` | Added `isAbsoluteLocalPath` export (10 lines) |
| `utils.js` | Added `isRemoteDashboardHost` + `isAbsoluteLocalPath` re-exports; fixed `normalizeSlashes` to use PathUtils |
| `views/AnalyzeView.js` | Removed local `isRemoteDashboardHost` + `isAbsoluteLocalPath`, added to import |
| `components/ScanStatus.js` | Removed local `isRemoteDashboardHost` + `isAbsoluteLocalPath`, added to import |
| `services/scanStrategy.js` | Removed local `isRemoteDashboardHost`, added import |

## Audit Progress

| Phase | Status | Impact |
|-------|--------|--------|
| Phase 1 | COMPLETE | escapeHtml security fix (3 files) + 10 legacy/patch files deleted |
| Phase 2a | COMPLETE | utils-format.js deleted (26 functions, 416 lines) |
| Phase 2b (this) | COMPLETE | isRemoteDashboardHost (3→1), isAbsoluteLocalPath (2→1), normalizeSlashes (2→1 canonical) |
| Phase 2 (remaining) | TODO | flow/negate in async.js, basenamePath, isPlausibleProjectPath |

## Validator Sign-off

- [x] All Level 1 checks pass
- [x] All Level 2 checks pass
- [x] All Level 3 checks pass
- [x] No defects found
- [x] Broom strategy followed (6 edits, 0 new files)
- [x] normalizeSlashes bug fix documented
- [x] Ready for commit
