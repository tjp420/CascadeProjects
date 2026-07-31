# Software Health Report: Alerting System Completion

**Date:** 2026-07-31
**Branch:** main
**Validator:** Devin (acting as Validator only)
**Feature:** Complete the alerting system — fix critical logger bug, mount routes, wire up missing event triggers.

## Gate Status

| Check | Result |
|-------|--------|
| SimpleBeacon gate scan (local CLI) | PASS (exit 0) |
| WebSocket integration test | 16/16 pass, 0 fail |
| Syntax check (all 5 changed files) | PASS (all `node -c` exit 0) |
| Behavioral validation (live server) | PASS (all alert endpoints respond correctly) |

## Level 1 — Deterministic (all required)

| # | Item | Result | Evidence |
|---|------|--------|----------|
| L1.1 | `node -c` on all 5 changed files | PASS | alert-routes.cjs, model-eval-routes.cjs, guardrail-routes.cjs, prompt-firewall.cjs, index.cjs |
| L1.2 | SimpleBeacon gate scan | PASS | exit 0 (local CLI) |
| L1.3 | WebSocket integration test | PASS | 16/16 pass |

## Level 2 — Behavioral (verified with live server on port 58000)

| # | Item | Result | Evidence |
|---|------|--------|----------|
| L2.1 | GET /api/alerts/rules | PASS | 200 `{ success: true, rules: [] }` |
| L2.2 | GET /api/alerts/event-types | PASS | 200 with 6 event types + 4 destination types |
| L2.3 | POST /api/alerts/rules (create) | PASS | 200 `{ success: true, rule: {...} }` |
| L2.4 | POST /api/alerts/trigger (no match) | PASS | 200 `{ dispatched: 0, results: [] }` |
| L2.4 | POST /api/alerts/trigger (match) | PASS | 200 `{ dispatched: 1, results: [{...}] }` |
| L2.5 | GET /api/alerts/incidents | PASS | 200 with incidents array |
| L2.6 | GET /api/alerts/stats | PASS | 200 with stats aggregation |
| L2.7 | DELETE /api/alerts/rules/:id | PASS | 200 `{ success: true, deleted: "..." }` |
| L2.8 | Guardrail test endpoint | PASS | 200 with verdict "block" for injection attempt |
| L2.9 | Guardrail stats | PASS | 200 with byVerdict/byProvider/byMatchType |
| L2.10 | Guardrail incidents | PASS | 200 with incident list |

## Level 3 — Self-review / drift

| # | Item | Result | Evidence |
|---|------|--------|----------|
| L3.1 | No new files created | PASS | Only edits to existing files |
| L3.2 | No response format changes | PASS | Existing endpoints unchanged |
| L3.3 | No mount path conflicts | PASS | `/api/alerts` and `/api/guardrails` not previously mounted in index.cjs |
| L3.4 | Alert triggers are non-blocking | PASS | All `.catch(() => {})` on trigger calls |

## Defects Found

### Defect 1: alert-routes.cjs missing logger import (CRITICAL)
- **Severity**: Critical
- **Description**: `alert-routes.cjs` used `logger.warn()` in 8 catch blocks but never imported `logger`. This would crash the server with `ReferenceError: logger is not defined` on the first error in any alert endpoint.
- **Fix**: Added `const logger = require('../lib/app-logger.cjs');` import.
- **Status**: Fixed

### Defect 2: model-eval-routes.cjs missing logger import (CRITICAL)
- **Severity**: Critical
- **Description**: Same as Defect 1 — `model-eval-routes.cjs` had `logger.warn()` calls added in Phase 5 but the `logger` module was never imported. This was a pre-existing bug from the Phase 5 migration script.
- **Fix**: Added `const logger = require('../lib/app-logger.cjs');` import.
- **Status**: Fixed

### Defect 3: guardrail-routes.cjs missing logger import (CRITICAL)
- **Severity**: Critical
- **Description**: Same as Defects 1 and 2 — `guardrail-routes.cjs` had `logger.warn()` calls but no `logger` import.
- **Fix**: Added `const logger = require('../lib/app-logger.cjs');` import.
- **Status**: Fixed

### Defect 4: Alert routes not mounted in index.cjs (HIGH)
- **Severity**: High
- **Description**: The alert routes were mounted in `simplebeacon-server.cjs` (production) but not in `index.cjs` (alternate entry point). The guardrail routes were not mounted in either entry point.
- **Fix**: Added `app.use('/api/alerts', require('./routes/alert-routes.cjs'));` and `app.use('/api/guardrails', require('./routes/guardrail-routes.cjs'));` to `index.cjs`.
- **Status**: Fixed

### Defect 5: guardrail_blocked event never triggered (MEDIUM)
- **Severity**: Medium
- **Description**: The `guardrail_blocked` event type was defined in the alert rule store but never triggered. When the prompt firewall blocked a request, no alert was dispatched.
- **Fix**: Added `triggerAlert(orgId, 'guardrail_blocked, {...})` call in the prompt firewall middleware's block handler.
- **Status**: Fixed

### Defect 6: eval_failure event never triggered (MEDIUM)
- **Severity**: Medium
- **Description**: The `eval_failure` event type was defined but never triggered. When a model eval run failed, no alert was dispatched.
- **Fix**: Added `triggerAlert(getOrgId(req), 'eval_failure', {...})` call in the model eval run catch block.
- **Status**: Fixed

## Files Changed (5 files, 0 new)

| File | Change |
|------|--------|
| `server/routes/alert-routes.cjs` | Add missing `logger` import (hotfix) |
| `server/routes/model-eval-routes.cjs` | Add missing `logger` import + `eval_failure` alert trigger |
| `server/routes/guardrail-routes.cjs` | Add missing `logger` import (hotfix) |
| `server/middleware/prompt-firewall.cjs` | Add `guardrail_blocked` alert trigger on block verdict |
| `server/index.cjs` | Mount alert-routes and guardrail-routes |

## Alerting System Architecture (After Completion)

```
Event Sources (all wired up):
  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │  Analytics   │  │  Dep. Gate   │  │  Guardrail   │  │  Model Eval  │
  │   Routes     │  │    Routes    │  │  Middleware  │  │    Routes    │
  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
         │                 │                 │                 │
  critical_finding    gate_failed    guardrail_blocked    eval_failure
  sla_breached                                              │
         │                 │                 │                 │
         └─────────────────┴─────────────────┴─────────────────┘
                           │
                           ▼
              ┌──────────────────────┐
              │  alert-dispatcher.cjs│
              │   processEvent()     │
              └──────────┬───────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
  │alert-rule    │ │alert-incident│ │  Webhook     │
  │store.cjs     │ │store.cjs     │ │  delivery    │
  └──────────────┘ └──────────────┘ └──────────────┘

API Layer (mounted in both entry points):
  /api/alerts/rules (CRUD)
  /api/alerts/incidents (query)
  /api/alerts/stats
  /api/alerts/test
  /api/alerts/trigger
  /api/alerts/event-types
  /api/guardrails/incidents
  /api/guardrails/stats
  /api/guardrails/test
```

## Event Type Coverage

| Event Type | Trigger Location | Status |
|------------|-----------------|--------|
| `critical_finding` | analytics-routes.cjs | ✅ Wired (by user) |
| `sla_breached` | analytics-routes.cjs | ✅ Wired (by user) |
| `gate_failed` | deployment-gate-routes.cjs | ✅ Wired (pre-existing) |
| `guardrail_blocked` | prompt-firewall.cjs middleware | ✅ Wired (this commit) |
| `eval_failure` | model-eval-routes.cjs | ✅ Wired (this commit) |
| `audit_delete` | audit-routes.cjs | ❌ Not wired (no delete endpoint exists) |

## Remaining Gaps (Future Work)

| Gap | Priority | Description |
|-----|----------|-------------|
| Slack destination | Medium | Only webhook delivery implemented; Slack/Email/PagerDuty stubs return "No webhook URL configured" |
| Email destination | Medium | No email sending logic |
| PagerDuty destination | Low | No PagerDuty API integration |
| `audit_delete` event | Low | No delete endpoint in audit-routes.cjs to trigger from |
| Webhook secret UI | Low | Dashboard modal doesn't expose `destination.secret` field |
| Incident retry | Low | No endpoint to retry failed incidents |
| Real-time incident streaming | Low | No WebSocket/SSE for live incident updates |

## Validator Sign-off

- [x] All Level 1 checks pass
- [x] All Level 2 checks pass (verified with live server)
- [x] All Level 3 checks pass
- [x] Defect 1 found and fixed (alert-routes.cjs missing logger import)
- [x] Defect 2 found and fixed (model-eval-routes.cjs missing logger import)
- [x] Defect 3 found and fixed (guardrail-routes.cjs missing logger import)
- [x] Defect 4 found and fixed (alert/guardrail routes not mounted in index.cjs)
- [x] Defect 5 found and fixed (guardrail_blocked event never triggered)
- [x] Defect 6 found and fixed (eval_failure event never triggered)
- [x] Broom strategy: 0 new files, 5 edits
- [x] No response format changes
- [x] Ready for commit
