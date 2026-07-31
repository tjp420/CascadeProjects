# Test Plan: Inline Row Expansion for Realtime Issues Table

**Date:** 2026-07-31
**Branch:** main
**Feature:** Make issue rows in the live analysis stream panel clickable
to expand/collapse and show the raw JSON chunk payload inline.

## Context

The `_renderRealtimeStreamResults()` method renders a flat issues table.
Users need to click a row to see the full issue details (type, severity,
message, category) and the chunk's metadata (confidence, processing time,
recommendations, method). This follows the expandable-row pattern where
clicking a `<tr>` toggles a hidden detail row beneath it.

## Files to Change

| File | Change |
|------|--------|
| `js-es2018/views/AnalyzeView.js` | Add expandable detail rows + click handlers |

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
| L2.1 | Issue rows have cursor:pointer and click handler | Rows are clickable |
| L2.2 | Clicking a row expands a detail row beneath it | Detail row appears with JSON |
| L2.3 | Clicking again collapses the detail row | Detail row removed |
| L2.4 | Detail row shows full issue JSON + chunk metadata | All fields visible |
| L2.5 | Only one row expanded at a time (or multiple — pick one) | Documented behavior |
| L2.6 | Expanded state survives re-render if chunk still present | Row stays expanded |
| L2.7 | Filter/sort buttons still work with expanded rows | No interference |

### Level 3 — Self-review / drift

| # | Item | Expected |
|---|------|----------|
| L3.1 | No new files created (Broom strategy) | Only AnalyzeView.js edited |
| L3.2 | No new dependencies | package.json unchanged |
| L3.3 | JSON in detail row is escaped (no XSS) | escapeHtml on all values |
| L3.4 | Expanded row ID is deterministic (chunkId + issue index) | Stable across re-renders |
| L3.5 | Click handler does not interfere with filter buttons | Event delegation scoped to tbody |
