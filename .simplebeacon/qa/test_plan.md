# Test Plan: Realtime Analysis Result Rendering in Dashboard

**Date:** 2026-07-31
**Branch:** main
**Feature:** Wire `realtimeAnalysisService` `analysis_result` events to the
AnalyzeView UI so streaming analysis findings render live as they arrive.

## Context

The `realtimeAnalysisService.js` (shipped in prior commit) connects to the
server's WebSocket on port 8082 and dispatches events. The server sends
`{ type: 'analysis_result', chunkId, result, timestamp }` messages where
`result` contains `{ issues, recommendations, confidence, processingTime }`.

Currently the service listens for `type: 'result'` — a bug. The server
actually sends `type: 'analysis_result'`. This must be fixed.

The AnalyzeView has a `#analyze-results` container and a `renderResults()`
method, but these are designed for complete scan reports, not incremental
streaming. We need a lightweight streaming results panel that accumulates
findings as chunks arrive, without replacing the full scan results area.

## Files to Change

| File | Change |
|------|--------|
| `js-es2018/services/realtimeAnalysisService.js` | Fix message type: `analysis_result` not `result` |
| `js-es2018/views/AnalyzeView.js` | Add streaming results panel + wire `on('analysis_result')` listener |

## Objective Check-Items

### Level 1 — Deterministic

| # | Item | Expected |
|---|------|----------|
| L1.1 | `node -c realtimeAnalysisService.js` | exit 0 |
| L1.2 | `node -c AnalyzeView.js` | exit 0 |
| L1.3 | `npx simplebeacon scan --gate` | PASS (exit 0) |
| L1.4 | WebSocket integration test still passes | 16/16 pass |

### Level 2 — Behavioral

| # | Item | Expected |
|---|------|----------|
| L2.1 | Service emits `analysis_result` event when server sends `type: 'analysis_result'` | Event fired with `{ chunkId, result, timestamp }` |
| L2.2 | AnalyzeView shows a streaming results panel when realtime monitoring is enabled | Panel visible with chunk count |
| L2.3 | Each received chunk appends findings to the panel | Issues list grows incrementally |
| L2.4 | Panel shows chunk ID, issue count, confidence, and processing time | All fields rendered |
| L2.5 | Toggling realtime monitoring off clears the streaming panel | Panel removed from DOM |
| L2.6 | Status indicator dot still works (green/amber/red/gray) | Unchanged from prior commit |

### Level 3 — Self-review / drift

| # | Item | Expected |
|---|------|----------|
| L3.1 | No new files created (Broom strategy) | Only existing files edited |
| L3.2 | No new dependencies added | package.json unchanged |
| L3.3 | Streaming panel does not replace `#analyze-results` | Full scan results preserved |
| L3.4 | Message type matches server's actual output | `analysis_result` not `result` |
| L3.5 | No ghost DOM elements or hallucinated selectors | All selectors verified against template |
