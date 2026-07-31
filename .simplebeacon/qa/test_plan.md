# Test Plan: Final Phase 2 Cleanup — flow/negate + basenamePath

**Date:** 2026-07-31
**Branch:** main
**Feature:** Remove dead duplicate `flow`/`negate` from `async.js` and
consolidate `basenamePath` (3 defs) into its canonical source.

## Context

Two remaining safe-to-consolidate items:

1. **flow/negate** — duplicated in `utils-lib/async.js` (lines 655, 663)
   and `utils-lib/function.js` (lines 51, 59). Both are **never called**
   anywhere in the codebase (dead code). `utils.js` re-exports from
   `AsyncUtils` — should be `FunctionUtils`.
   - **Action:** Remove from `async.js`, fix `utils.js` re-export source.

2. **basenamePath** — 3 definitions with near-identical logic:
   - `lib/analyzePathSuggestions.js` (line 17) — canonical, not exported
   - `views/AnalyzeView.js` (line 1268) — local copy, identical
   - `views/AnalyzePathSection.js` (line 6) — local copy, returns `''` instead of `projectPath` as fallback
   - **Action:** Export from `analyzePathSuggestions.js`, import in both consumers.

3. **isPlausibleProjectPath** — **SKIP** (not in this commit)
   - `lib/pageRepoScan.js` and `views/AnalyzeView.js` have functionally
     different implementations (different rejection patterns, one uses
     `stripArtifactSuffixes`). Merging requires careful logic
     reconciliation — deferred to a future commit.

## Files to Change

| File | Change |
|------|--------|
| `utils-lib/async.js` | Remove `flow` and `negate` exports (dead code) |
| `utils.js` | Fix `flow`/`negate` re-export source: AsyncUtils → FunctionUtils |
| `lib/analyzePathSuggestions.js` | Export `basenamePath` |
| `views/AnalyzeView.js` | Remove local `basenamePath`, import from analyzePathSuggestions |
| `views/AnalyzePathSection.js` | Remove local `basenamePath`, import from analyzePathSuggestions |

## Objective Check-Items

### Level 1 — Deterministic

| # | Item | Expected |
|---|------|----------|
| L1.1 | `node -c` on all 5 edited files | exit 0 |
| L1.2 | `npx simplebeacon scan --gate` | PASS (exit 0) |
| L1.3 | WebSocket integration test still passes | 16/16 pass |

### Level 2 — Behavioral

| # | Item | Expected |
|---|------|----------|
| L2.1 | `flow`/`negate` still available via utils.js | Re-exported from FunctionUtils |
| L2.2 | `basenamePath` works identically in all consumers | Same output for same input |
| L2.3 | No duplicate `basenamePath` definitions remain | grep finds 0 local defs |

### Level 3 — Self-review / drift

| # | Item | Expected |
|---|------|----------|
| L3.1 | No new files created | Only edits to existing files |
| L3.2 | No new dependencies | Uses existing import chain |
| L3.3 | isPlausibleProjectPath left untouched | Documented as deferred |
| L3.4 | basenamePath fallback behavior unified | All use `|| projectPath` (canonical) |
