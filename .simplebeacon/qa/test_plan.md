# Test Plan: Real-Time Log Stream Analysis

**Date:** 2026-07-31
**Branch:** main
**Feature:** Server log streaming, burst pattern detection, and performance anomaly tracking.

## Context

The server uses `src/lib/app-logger.cjs` (wraps console.error/warn/info/debug) across all 44+ server modules. The main WebSocket server (`/ws` on port 58000) already broadcasts `data_update` messages in dev mode and `INCIDENT_STREAM` for alerts. No request timing middleware exists. No log streaming or burst detection exists.

## Architecture

Following the Broom Strategy — extend existing files, use callback injection pattern (same as incident broadcaster):

1. **Log subscriber pattern** in `app-logger.cjs` — add `onLog(callback)` that fires on every log call. Server registers a WS broadcaster.
2. **Burst detector + metrics aggregator** — new small module `server/lib/log-stream-metrics.cjs` (justified: self-contained analytics logic, would bloat app-logger if inline). Tracks sliding-window counts per level, detects bursts, and aggregates request metrics.
3. **Request timing middleware** — add to `server/middleware/` (existing middleware directory). Records latency, status code, and method for each request.
4. **Server wiring** — in `simplebeacon-server.cjs`, register log subscriber + metrics broadcaster with the WebSocket server (same pattern as incident broadcaster).
5. **Dashboard UI** — add a log stream panel + metrics display to `UsageAnalyticsView.tsx` (existing alerting dashboard section).

## WebSocket Message Types

| Type | Direction | Payload |
|------|-----------|---------|
| `LOG_STREAM` | server→client | `{ level, message, timestamp, source }` |
| `METRICS_UPDATE` | server→client | `{ requests, avgLatencyMs, errorRate, throughput, bursts }` |
| `BURST_DETECTED` | server→client | `{ level, count, windowMs, threshold, timestamp }` |

## Files to Change (5 files, 1 new)

| File | Change |
|------|--------|
| `src/lib/app-logger.cjs` | Add `onLog(callback)` subscriber pattern. Each log call notifies subscribers with `{ level, message, timestamp }`. |
| `server/lib/log-stream-metrics.cjs` | **NEW** — Burst detector (sliding window per level) + request metrics aggregator (latency, throughput, error rate). Emits events via callback. |
| `server/middleware/request-timing.cjs` | **NEW** — Express middleware that records `req.startTime`, measures latency on response finish, feeds metrics aggregator. |
| `simplebeacon-server.cjs` | Register log subscriber → WS broadcast. Register metrics broadcaster. Mount request timing middleware. |
| `web/simplebeacon-dashboard/src/views/UsageAnalyticsView.tsx` | Add log stream panel (filtered by level, real-time) + metrics display (latency, throughput, error rate, burst alerts). |

## Objective Check-Items

### Level 1 — Deterministic

| # | Item | Expected |
|---|------|----------|
| L1.1 | `node -c` on all changed/new .cjs files | exit 0 |
| L1.2 | `npx simplebeacon scan --gate` | PASS (exit 0) |
| L1.3 | WebSocket integration test | 16/16 pass |
| L1.4 | TypeScript compile | PASS (no new errors) |

### Level 2 — Behavioral

| # | Item | Expected |
|---|------|----------|
| L2.1 | Server log → WebSocket client receives LOG_STREAM within 500ms | Message received with level + message + timestamp |
| L2.2 | LOG_STREAM respects log level filter (client sends `{ type: 'set_log_level', level: 'warn' }`) | Only warn+error messages received |
| L2.3 | 10+ error logs in 30s → BURST_DETECTED message sent | Burst message with count + threshold |
| L2.4 | HTTP request → METRICS_UPDATE broadcast with latency + status | Metrics update received within 5s |
| L2.5 | Request to non-existent endpoint (404) → error rate increases | Error rate reflects 4xx/5xx responses |
| L2.6 | No WebSocket clients → no crash, logs still work | Server healthy, no errors |
| L2.7 | Dashboard log stream panel shows real-time logs | Logs appear in UI |
| L2.8 | Dashboard metrics display shows latency/throughput/error rate | Metrics visible in UI |

### Level 3 — Self-review / drift

| # | Item | Expected |
|---|------|----------|
| L3.1 | No circular dependencies | app-logger.cjs does not import server files |
| L3.2 | Log subscriber is fire-and-forget | Subscriber errors never block logging |
| L3.3 | Burst detector does not leak memory | Sliding window prunes old entries |
| L3.4 | Request timing middleware does not block responses | Metrics recorded on response 'finish' event |
| L3.5 | No regression in existing WebSocket functionality | 16/16 integration tests pass |
