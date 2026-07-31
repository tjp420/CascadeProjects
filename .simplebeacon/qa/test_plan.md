# Test Plan: Real-Time Incident Streaming + audit_delete Trigger + UI Fields

**Date:** 2026-07-31
**Branch:** main
**Feature:** WebSocket incident streaming, audit_delete event trigger, destination-specific UI fields.

## Context

The alert dispatcher supports all 4 destination types (webhook, Slack, email, PagerDuty). Three remaining gaps:
1. Incidents are persisted but not broadcast to connected dashboard clients in real-time.
2. The `audit_delete` event type is defined but never triggered (no delete endpoint exists).
3. The dashboard rule builder has all 4 destination types in the dropdown but only a generic `webhookUrl` field — no destination-specific config fields.

## Architecture Decisions

**WebSocket broadcasting:** The WebSocket server lives inside `simplebeacon-server.cjs` as `setupWebSocketServer(server)`. To avoid circular dependencies, we use a **callback injection pattern**: `alert-dispatcher.cjs` exposes a `setIncidentBroadcaster(fn)` function. The server registers a callback that broadcasts to all `wss.clients`. No new files needed.

**audit_delete trigger:** No `trigger-engine.cjs` exists. We add a DELETE endpoint to `audit-routes.cjs` that calls `processEvent()` with the `audit_delete` event type — following the same pattern used for `guardrail_blocked` in `prompt-firewall.cjs` and `eval_failure` in `model-eval-routes.cjs`.

**UI fields:** The React dashboard (`UsageAnalyticsView.tsx`) already has the destination type dropdown. We add conditional fields that appear based on the selected destination type.

## Files to Change (4 files)

| File | Change |
|------|--------|
| `server/lib/alert-dispatcher.cjs` | Add `setIncidentBroadcaster()` callback setter. Call broadcaster after `recordIncident()` in `processEvent()`. Export setter. |
| `simplebeacon-server.cjs` | After `setupWebSocketServer()` returns `wss`, import `setIncidentBroadcaster` and register a callback that broadcasts `INCIDENT_STREAM` to all connected WS clients. |
| `server/routes/audit-routes.cjs` | Add `DELETE /log/:entryId` endpoint that deletes an audit entry and triggers `processEvent()` with `audit_delete` event type. |
| `web/simplebeacon-dashboard/src/views/UsageAnalyticsView.tsx` | Add conditional fields: webhook secret (webhook), routing key (pagerduty), email recipient (email). Update form state to include `destination` object. |

## Objective Check-Items

### Level 1 — Deterministic

| # | Item | Expected |
|---|------|----------|
| L1.1 | `node -c` on alert-dispatcher.cjs | exit 0 |
| L1.2 | `node -c` on audit-routes.cjs | exit 0 |
| L1.3 | `npx simplebeacon scan --gate` | PASS (exit 0) |
| L1.4 | WebSocket integration test | 16/16 pass |
| L1.5 | Dashboard TypeScript compile | PASS (no new type errors) |

### Level 2 — Behavioral

| # | Item | Expected |
|---|------|----------|
| L2.1 | Trigger alert → WebSocket client receives INCIDENT_STREAM within 500ms | Message received with correct structure |
| L2.2 | INCIDENT_STREAM payload has required fields | id, ruleId, ruleName, status, destinationType, createdAt |
| L2.3 | No WebSocket clients connected → no crash, incident still persisted | Incident recorded, no error |
| L2.4 | DELETE /api/audit/log/:entryId → audit_delete event triggered | Incident recorded for audit_delete rule |
| L2.5 | Webhook rule with secret → secret included in destination object | destination.secret populated |
| L2.6 | PagerDuty rule with routingKey → routingKey included in destination object | destination.routingKey populated |
| L2.7 | Email rule with email recipient → email included in destination object | destination.email populated |
| L2.8 | Webhook/Slack/email/PagerDuty delivery still works (no regression) | All destinations still function |

### Level 3 — Self-review / drift

| # | Item | Expected |
|---|------|----------|
| L3.1 | No circular dependencies introduced | alert-dispatcher.cjs does not import simplebeacon-server.cjs |
| L3.2 | No new files created | Only existing files modified |
| L3.3 | No regression in existing alert delivery | All 4 destination types still work |
| L3.4 | WebSocket broadcast is fire-and-forget (does not block delivery) | Delivery latency unchanged |
