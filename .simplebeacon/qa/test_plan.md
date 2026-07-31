# Test Plan: Real-Time Token Budget Allocation Tracker

> Finalize per-org token budget tracking with soft-cap / hard-stop monetary thresholds and asymmetric webhook alerts.

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Real-Time Token Budget Allocation Tracker — route mounting, threshold webhook dispatch, and multi-level alert intervals |
| Author (Builder) | Devin |
| Date | 2026-08-01 |
| Branch | feat/agentic-orchestration |
| Packages touched | ai-platform |

## Context

The `token-budget-allocation-store.cjs` and `token-budget-allocation-routes.cjs` already provide per-org budget CRUD, model rates, expenditure recording, and soft-cap / hard-stop percentage checks. To finalize the epic, the routes must be mounted in the main application, threshold crossings must dispatch webhook alerts via the existing `webhook-engine.cjs`, and the inference path should enforce the hard-stop policy before spending more tokens. This delivers fiscal guardrails that administrators can configure as custom percentage intervals.

## Design

### Core mechanics

1. **Route mounting**
   - Mount `token-budget-allocation-routes.cjs` in the main `ai-platform` server app under `/api/token-budget`.
   - All existing endpoints (budgets, rates, alerts, config, record) become reachable.

2. **Threshold webhook dispatch**
   - Add `budget_threshold_exceeded` to the integration webhook event vocabulary (`integration-config-store.cjs` / `webhook-engine.cjs`).
   - In `token-budget-allocation-store.cjs::checkThresholds`, when `webhookAlertsEnabled` is true, call `webhook-engine.dispatchEvent(config.webhookEvent || 'budget_threshold_exceeded', context)`.
   - Context includes `orgId`, `severity` (`critical` for hard stop, `high` for soft cap), `summary`, `percentUsed`, `spentUSD`, `limitUSD`, `scope`, and `thresholdType`.

3. **Custom interval alerts**
   - Budget config may carry an optional `alertIntervals` array of percentage points (e.g., `[50, 80, 100]`).
   - On `recordUsage`, evaluate each interval not yet crossed and fire a webhook alert for the highest newly-crossed interval, still honoring the cooldown.
   - Backward-compatible: if `alertIntervals` is absent, fall back to `softCapPercent`/`hardStopPercent`.

4. **Hard-stop enforcement**
   - `cloud-inference-service.cjs` calls `tokenBudget.checkHardStop(orgId)` before dispatching a cloud inference request.
   - If `blocked: true`, return an error response with `budget_hard_stop_exceeded` instead of calling the provider.
   - After successful inference, `recordUsage` already tracks spend; ensure it is also called for local/ollama paths where token counts are available.

5. **Auto-reset**
   - If `autoResetEnabled` is true, `recordUsage` or a `getBudget` read path detects `periodEnd < now` and resets the budget before recording.

### Files in scope

| File | Purpose |
|------|---------|
| `ai-platform/server/lib/token-budget-allocation-store.cjs` | Add webhook dispatch, auto-reset, custom `alertIntervals`, and hard-stop exposure |
| `ai-platform/server/routes/token-budget-allocation-routes.cjs` | Minor route fixes, add `authorize` where missing, keep existing CRUD surface |
| `ai-platform/server/lib/webhook-engine.cjs` | Register `budget_threshold_exceeded` event label |
| `ai-platform/server/lib/integration-config-store.cjs` | Add `budget_threshold_exceeded` to `EVENT_TYPES` if needed |
| `ai-platform/server/services/cloud-inference-service.cjs` | Enforce `checkHardStop` before cloud calls and record usage for all paths |
| Main server bootstrap (e.g., `server/app.cjs` or `server/index.cjs`) | Mount `/api/token-budget` router |
| `ai-platform/server/lib/__tests__/token-budget-allocation.test.cjs` | New — budget CRUD, threshold alerts, hard stop, webhook dispatch, auto-reset, multi-org isolation |

### Files explicitly NOT in scope (deferred)

- Dashboard UI for budget graphs or alert configuration
- Persistent queue for failed webhook retries
- Multi-currency support
- Granular per-user budget sub-scopes

### APIs / routes

- `GET    /api/token-budget/stats`
- `GET    /api/token-budget/budgets`
- `POST   /api/token-budget/budgets`
- `GET    /api/token-budget/budgets/:scope`
- `PUT    /api/token-budget/budgets/:scope`
- `DELETE /api/token-budget/budgets/:scope`
- `POST   /api/token-budget/budgets/:scope/reset`
- `GET    /api/token-budget/budgets/:scope/breakdown`
- `GET    /api/token-budget/rates`
- `PUT    /api/token-budget/rates/:model`
- `GET    /api/token-budget/alerts`
- `POST   /api/token-budget/alerts/clear`
- `GET    /api/token-budget/config`
- `PUT    /api/token-budget/config`
- `POST   /api/token-budget/record`

### UI / IDE surfaces

- [ ] Sidebar webview
- [ ] Main dashboard iframe / address bar
- [ ] Welcome / main window panel
- [ ] Simple Browser / external browser

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on changed JS/CJS | `node -c ai-platform/server/lib/token-budget-allocation-store.cjs`, `node -c ai-platform/server/routes/token-budget-allocation-routes.cjs`, `node -c ai-platform/server/lib/webhook-engine.cjs`, `node -c ai-platform/server/services/cloud-inference-service.cjs` | [ ] |
| L1-02 | ai-platform tests | `cd ai-platform && npm test` | [ ] |
| L1-03 | Extension compile (if touched) | `cd simplebeacon-vscode-merged && npm run compile` | [ ] |
| L1-04 | SimpleBeacon gate (full) | `npx simplebeacon scan --full --gate --format json` | [ ] |
| L1-05 | No secrets in diff | Manual review: no hardcoded webhook URLs, no plaintext tokens | [ ] |
| L1-06 | npm audit (if deps changed) | `npm audit` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Budget creation and retrieval | POST `/api/token-budget/budgets` with `limitUSD=100`, then GET `/api/token-budget/budgets/org` | 200 with matching budget, `spentUSD=0` | [ ] |
| L2-02 | Usage recording updates spend | POST `/api/token-budget/record` with `inputTokens=1000`, `outputTokens=500`, `model=gpt-4` | `spentUSD` increases by calculated cost | [ ] |
| L2-03 | Soft-cap webhook fires | Set `softCapPercent=50`, record enough tokens to cross 50%, with a mocked `webhook-engine` | `webhook-engine.dispatchEvent` called once with `budget_threshold_exceeded` | [ ] |
| L2-04 | Hard stop blocks inference | Create budget with `limitUSD=1`, exceed 100%, then call `cloud-inference-service.generateWithProvider` | Request rejected with `budget_hard_stop_exceeded` | [ ] |
| L2-05 | Custom interval alerts | Configure `alertIntervals: [25, 50, 75, 100]` and record usage crossing each | One alert per interval, no duplicate within cooldown | [ ] |
| L2-06 | Auto-reset on period rollover | Set past `periodEnd`, then GET budget or record usage | `spentUSD` resets to 0 and `periodStart`/`periodEnd` advance | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Record usage with no budget | `recordUsage` returns `{ recorded: false, reason: 'no_budget' }` without throwing | [ ] |
| L3-02 | Disabled budget | `recordUsage` returns `recorded: false` and no alerts fire | [ ] |
| L3-03 | Cooldown dedup | Repeated threshold-crossing records within cooldown fire only one alert | [ ] |
| L3-04 | Missing webhook config | `checkThresholds` logs a warning but does not crash | [ ] |
| L3-05 | Multi-org isolation | `getAllBudgets('org-a')` does not include `org-b` budgets | [ ] |
| L3-06 | Hard stop preserves existing spend data | After crossing hard stop, budget values remain readable and correct | [ ] |
| L3-07 | No new dependencies | Only existing Node built-ins and in-repo modules are used | [ ] |
| L3-08 | Routes properly authorized | Admin-mutating endpoints (`POST/PUT/DELETE`) enforce `authorize('admin:all')` | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No raw API keys or webhook tokens committed in budget store | [ ] |
| S-02 | Webhook payloads do not include full request content or PII beyond org/scope/cost | [ ] |
| S-03 | Hard-stop decision cannot be bypassed by setting `orgId` in query string alone; authorization validated | [ ] |
| S-04 | Cost calculations use sanitized numeric inputs; NaN/invalid values default to 0 | [ ] |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________
