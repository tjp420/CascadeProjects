# Test Plan: Filter/Sort for Realtime Live Issues Table

**Date:** 2026-07-31
**Branch:** main
**Feature:** Add severity filter buttons and sort controls to the live
analysis stream panel in AnalyzeView.

## Context

The `_renderRealtimeStreamResults()` method (shipped in prior commit)
renders a flat issues table from `_realtimeChunks`. As chunks accumulate,
users need to triage by severity and sort by chunk order or severity
weight. The existing `codebase-cat-filter` pattern in
`renderCodebaseHealthSection` uses `btn-ghost`/`btn-primary` toggle
buttons with `data-cat` attributes and an `applyFilter()` function.

## Files to Change

| File | Change |
|------|--------|
| `js-es2018/views/AnalyzeView.js` | Add filter state, filter buttons, sort control, and wire handlers |

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
| L2.1 | Severity filter buttons render: All, Critical, High, Medium, Low | 5 buttons visible |
| L2.2 | Clicking a severity filter shows only matching issues | Rows filtered by severity |
| L2.3 | "All" filter shows all issues | All rows visible |
| L2.4 | Sort toggle: by chunk order (default) vs by severity weight | Issues re-ordered |
| L2.5 | Filter state persists across re-renders (new chunks arrive) | Active filter maintained |
| L2.6 | Filtered count shown ("X shown · Y filtered out") | Count label updates |
| L2.7 | Empty state when filter matches zero issues | "No issues match filter" message |

### Level 3 — Self-review / drift

| # | Item | Expected |
|---|------|----------|
| L3.1 | No new files created (Broom strategy) | Only AnalyzeView.js edited |
| L3.2 | No new dependencies | package.json unchanged |
| L3.3 | Filter pattern matches existing codebase-cat-filter convention | btn-ghost/btn-primary toggle |
| L3.4 | Filter state stored on the view instance, not in DOM | `this._realtimeFilter` |
| L3.5 | Re-render preserves filter state | Filter not reset on new chunk |
