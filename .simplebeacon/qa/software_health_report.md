# Software Health Report: Realtime Issues Filter/Sort

**Date:** 2026-07-31
**Branch:** main
**Validator:** Devin (acting as Validator)
**Feature:** Add severity filter buttons and sort controls to the live
analysis stream panel in AnalyzeView.

## Gate Status

| Check | Result |
|-------|--------|
| SimpleBeacon gate scan | PASS (exit 0) |
| WebSocket integration test | 16/16 pass, 0 fail |
| Syntax check (AnalyzeView.js) | PASS (`node -c` exit 0) |

## Level 1 — Deterministic (all required)

| # | Item | Result | Evidence |
|---|------|--------|----------|
| L1.1 | `node -c AnalyzeView.js` | PASS | exit 0 |
| L1.2 | `npx simplebeacon scan --gate` | PASS | exit 0 |
| L1.3 | WebSocket integration test | PASS | 16/16 pass |

## Level 2 — Behavioral

| # | Item | Result | Evidence |
|---|------|--------|----------|
| L2.1 | Severity filter buttons render: All, Critical, High, Medium, Low | PASS | `sevButton()` generates 5 buttons with counts |
| L2.2 | Clicking a severity filter shows only matching issues | PASS | `filter.severity !== 'all'` filters by `i.severity.toLowerCase()` |
| L2.3 | "All" filter shows all issues | PASS | `filter.severity === 'all'` returns unfiltered |
| L2.4 | Sort toggle: chunk order vs severity | PASS | `sortButton()` + `severityWeight` map for sort |
| L2.5 | Filter state persists across re-renders | PASS | `this._realtimeFilter` stored on view instance, read at top of render |
| L2.6 | Filtered count shown | PASS | `${filtered.length} shown · ${hiddenCount} filtered out` |
| L2.7 | Empty state when filter matches zero | PASS | `No issues match the active filter.` message |

## Level 3 — Self-review / drift

| # | Item | Result | Evidence |
|---|------|--------|----------|
| L3.1 | No new files created | PASS | Only AnalyzeView.js edited (Broom strategy) |
| L3.2 | No new dependencies | PASS | package.json unchanged |
| L3.3 | Filter pattern matches codebase-cat-filter convention | PASS | `btn-ghost`/`btn-primary` toggle, `data-sev` attribute |
| L3.4 | Filter state stored on view instance | PASS | `this._realtimeFilter = { severity, sort }` |
| L3.5 | Re-render preserves filter state | PASS | Filter read at top of `_renderRealtimeStreamResults`, not reset on new chunk |
| L3.6 | Filter reset on toggle off | PASS | `this._realtimeFilter = { severity: 'all', sort: 'chunk' }` in stop handler |

## Defects

None.

## Files Changed (1 file + 2 QA artifacts)

| File | Change |
|------|--------|
| `AnalyzeView.js` | Rewrote `_renderRealtimeStreamResults()` with severity filter buttons, sort toggle, filtered count, empty state, and button click handlers. Added filter reset on toggle off. |

## Enhancements (future)

1. **Category filter**: Add category pills like the codebase health section
2. **Search box**: Text search across issue messages
3. **Export filtered results**: Download visible issues as CSV/JSON
4. **Severity sort stability**: Secondary sort by chunk ID when severity is equal

## Validator Sign-off

- [x] All Level 1 checks pass
- [x] All Level 2 checks pass
- [x] All Level 3 checks pass
- [x] No defects found
- [x] Broom strategy followed (1 file edited, 0 new files)
- [x] Ready for commit
