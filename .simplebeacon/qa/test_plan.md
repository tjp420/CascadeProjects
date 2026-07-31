# Test Plan: Alerting System Completion

**Date:** 2026-07-31
**Branch:** main
**Feature:** Complete the alerting system — fix critical logger bug, mount routes, wire up missing event triggers.

## Context

The alerting system is 80% built. The backend core (dispatcher, rule store, incident store, routes) is complete. The frontend UI in `UsageAnalyticsView.tsx` is complete. However:

- `alert-routes.cjs` had a critical bug: used `logger.warn()` in 8 catch blocks without importing `logger`
- `model-eval-routes.cjs` had the same missing logger import (from Phase 5)
- Alert routes were not mounted in `index.cjs` (alternate entry point)
- `guardrail_blocked` event was defined but never triggered
- `eval_failure` event was defined but never triggered

## Changes (4 files, 0 new)

| File                                    | Change                                                     |
| --------------------------------------- | ---------------------------------------------------------- |
| `server/routes/alert-routes.cjs`        | Add missing `logger` import (hotfix)                       |
| `server/routes/model-eval-routes.cjs`   | Add missing `logger` import + `eval_failure` alert trigger |
| `server/middleware/prompt-firewall.cjs` | Add `guardrail_blocked` alert trigger on block verdict     |
| `server/index.cjs`                      | Mount alert-routes and guardrail-routes                    |

## Objective Check-Items

### Level 1 — Deterministic

| #    | Item                                       | Expected       |
| ---- | ------------------------------------------ | -------------- |
| L1.1 | `node -c` on all 4 changed files           | exit 0         |
| L1.2 | `npx simplebeacon scan --gate`             | PASS (exit 0)  |
| L1.3 | WebSocket integration test                 | 16/16 pass     |
| L1.4 | Alert integration test (`test-alerts.cjs`) | All tests pass |

### Level 2 — Behavioral

| #    | Item                                                       | Expected                                           |
| ---- | ---------------------------------------------------------- | -------------------------------------------------- |
| L2.1 | `GET /api/alerts/rules` returns 200 with rules array       | `{ success: true, rules: [] }`                     |
| L2.2 | `GET /api/alerts/event-types` returns 200 with event types | `{ success: true, eventTypes: [...] }`             |
| L2.3 | `POST /api/alerts/rules` creates a rule                    | `{ success: true, rule: {...} }`                   |
| L2.4 | `POST /api/alerts/trigger` dispatches event                | `{ success: true, dispatched: N, results: [...] }` |
| L2.5 | `GET /api/alerts/incidents` returns incidents              | `{ success: true, incidents: [...] }`              |
| L2.6 | `GET /api/alerts/stats` returns stats                      | `{ success: true, stats: {...} }`                  |
| L2.7 | `DELETE /api/alerts/rules/:id` deletes rule                | `{ success: true, deleted: "..." }`                |
| L2.8 | Guardrail block triggers `guardrail_blocked` alert         | Alert incident recorded                            |
| L2.9 | Model eval failure triggers `eval_failure` alert           | Alert incident recorded                            |

### Level 3 — Self-review / drift

| #    | Item                            | Expected                                                |
| ---- | ------------------------------- | ------------------------------------------------------- |
| L3.1 | No new files created            | Only edits to existing files                            |
| L3.2 | No response format changes      | Existing endpoints unchanged                            |
| L3.3 | No mount path conflicts         | `/api/alerts` and `/api/guardrails` not already mounted |
| L3.4 | Alert triggers are non-blocking | `.catch(() => {})` on all trigger calls                 |
