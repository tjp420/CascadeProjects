# Test Plan: Export to CSV/JSON from Realtime Stream Panel

**Date:** 2026-07-31
**Branch:** main
**Feature:** Add "Export CSV" and "Export JSON" buttons to the live
analysis stream panel so developers can download the currently filtered
issues list.

## Context

The `_renderRealtimeStreamResults()` method already builds a `sorted`
array of filtered issues. The dashboard has existing utilities
`downloadCsv(rows, filename, headers)` and `downloadJson(data, filename)`
imported in AnalyzeView.js. We just need to wire export buttons that
call these utilities with the filtered data.

## Files to Change

| File | Change |
|------|--------|
| `js-es2018/views/AnalyzeView.js` | Add export buttons + handlers using existing download utilities |

## Objective Check-Items

### Level 1 — Deterministic

| # | Item | Expected |
|---|------|----------|
| L1.1 | `node -c AnalyzeView.js` | exit 0 |
| L1.2 | `npx simplebeacon scan --gate` | PASS (exit 0) |
| L1.3 | WebSocket integration test still passes | 16/16 pass |

### Level 2 — Behavioral

| # | Item | Expected |
|---|------|----------|
| L2.1 | Two export buttons render: "Export CSV" and "Export JSON" | Buttons visible when issues exist |
| L2.2 | Export buttons hidden when no issues | Not rendered for empty state |
| L2.3 | Export respects active filter | Only filtered issues exported, not all |
| L2.4 | CSV export produces valid CSV with headers | severity,category,message,chunkId columns |
| L2.5 | JSON export produces valid JSON with issue + chunk metadata | Pretty-printed, all fields |
| L2.6 | Export buttons do not interfere with filter/sort/expand | Separate event handlers |
| L2.7 | Filename includes timestamp | e.g. realtime-issues-20260731.csv |

### Level 3 — Self-review / drift

| # | Item | Expected |
|---|------|----------|
| L3.1 | No new files created (Broom strategy) | Only AnalyzeView.js edited |
| L3.2 | No new dependencies | Uses existing downloadCsv/downloadJson |
| L3.3 | Export uses existing utility functions | downloadCsv, downloadJson from utils.js |
| L3.4 | CSV values are properly escaped | Handled by downloadCsv utility |
| L3.5 | No internal fields (_rowId, _chunkResult) leaked in export | Stripped from export data |
