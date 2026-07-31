# Test Plan: Delete Dead utils-format.js Legacy File

**Date:** 2026-07-31
**Branch:** main
**Feature:** Delete `utils-format.js` — a legacy file with 26 functions
that is not imported by any file in the codebase.

## Context

The audit found `utils-format.js` contains 26 exported functions. Of these:
- 21 are duplicates of functions in `utils-lib/` (escapeRegExp, formatNumber,
  formatPercent, formatBytes, clamp, formatDuration, formatDate, relativeTime,
  formatAiSummarySkipMessage, isBlank, capitalize, truncate, pluralize,
  kebabCase, camelCase, snakeCase, stripHtml, padStart, padEnd, roundTo, noop)
- 5 are "unique" (timeAgo, words, repeat, titleCase, slugify, inRange) but:
  - `timeAgo` is an internal alias for `relativeTime` (same file)
  - `slugify` has a local copy in `RemediationRoadmapView.js`
  - `words`, `repeat`, `titleCase`, `inRange` are not used anywhere

**Key finding:** `grep` confirmed 0 files import from `utils-format.js`.
The file is completely dead code.

## Files to Change

| File | Action |
|------|--------|
| `utils-format.js` | Delete (dead code, 0 imports) |

## Objective Check-Items

### Level 1 — Deterministic

| # | Item | Expected |
|---|------|----------|
| L1.1 | `npx simplebeacon scan --gate` | PASS (exit 0) |
| L1.2 | WebSocket integration test still passes | 16/16 pass |
| L1.3 | No imports reference utils-format.js | grep returns 0 matches |

### Level 2 — Behavioral

| # | Item | Expected |
|---|------|----------|
| L2.1 | Dashboard loads without errors | No missing module errors |

### Level 3 — Self-review / drift

| # | Item | Expected |
|---|------|----------|
| L3.1 | No new files created | Only deletion |
| L3.2 | File is tracked in git | git ls-files confirms |
| L3.3 | Unique functions not used elsewhere | Verified by grep |
