# Test Plan: Multi-Tenant Workspace Configuration UI

> Dashboard view that gives administrators visibility into the multi-tenant cryptographic sandbox and live control over token budget parameters.

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Multi-Tenant Workspace Configuration UI — admin panels for sandbox summary and token budget live tuning |
| Author (Builder) | Devin |
| Date | 2026-08-01 |
| Branch | feat/agentic-orchestration |
| Packages touched | ai-platform (dashboard + backend) |

## Scope

### Files in scope

| File | Purpose |
|------|---------|
| `ai-platform/web/simplebeacon-dashboard/js-es2018/views/WorkspaceConfigView.js` | New dashboard view for the workspace page |
| `ai-platform/web/simplebeacon-dashboard/js-es2018/components/WorkspaceBudgetPanel.js` | Budget cards, limit/interval editor, and threshold list |
| `ai-platform/web/simplebeacon-dashboard/js-es2018/components/WorkspaceSandboxPanel.js` | Read-only sandbox summary (per-org config counts and prefixes) |
| `ai-platform/web/simplebeacon-dashboard/js-es2018/services/workspaceConfigService.js` | `fetch` wrappers for new and existing API endpoints |
| `ai-platform/web/simplebeacon-dashboard/js-es2018/router.js` | Register `/workspace` route |
| `ai-platform/web/simplebeacon-dashboard/js-es2018/main.js` | Add view to the view registry |
| `ai-platform/web/simplebeacon-dashboard/index.html` | Optional nav/sidebar link (if navigation is centralized in HTML) |
| `ai-platform/server/routes/workspace-config-routes.cjs` | New read-only API for sandbox store summaries and budget batch updates |
| `ai-platform/server/index.cjs` | Mount `/api/workspace` router |
| `ai-platform/server/lib/__tests__/workspace-config-routes.test.cjs` | Backend tests for sandbox summary and budget update endpoints |

### APIs / routes

- `GET /api/workspace/sandbox-summary?orgId=<orgId>` — counts of SSO, integration, and webhook configs per org; no secret values
- `GET /api/workspace/budgets?orgId=<orgId>` — list of token-budget entries for an org
- `PUT /api/workspace/budgets/:scope` — update `limitUSD`, `alertIntervals`, `softCapPercent`, `hardStopPercent`, `webhookAlertsEnabled`, `autoResetEnabled`
- `POST /api/workspace/budgets/:scope/reset` — reset budget period and spend

### UI / IDE surfaces

- [x] Sidebar webview / dashboard nav
- [x] Main dashboard iframe / address bar
- [ ] Welcome / main window panel
- [ ] Simple Browser / external browser

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on changed JS/CJS | `node -c ai-platform/server/routes/workspace-config-routes.cjs` and `node -c ai-platform/server/index.cjs` | [ ] |
| L1-02 | Dashboard build compile (if a build step exists) | `cd ai-platform/web/simplebeacon-dashboard && npm run build` if present, else `npm test` | [ ] |
| L1-03 | ai-platform tests | `cd ai-platform && npm test` | [ ] |
| L1-04 | SimpleBeacon gate (full) | `npx simplebeacon scan --full --gate --format json` | [ ] |
| L1-05 | No secrets in diff | Manual review: no UI logging of tokens, no raw secret values sent | [ ] |
| L1-06 | npm audit (if deps changed) | `npm audit` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Open workspace view | Navigate to `#/workspace` in dashboard | View loads with budget and sandbox panels | [ ] |
| L2-02 | Token budget card | Select an org with a budget | Card shows `limitUSD`, `spentUSD`, `percentUsed`, `periodEnd` | [ ] |
| L2-03 | Live budget edit | Change `limitUSD` and `alertIntervals`, click Save | PUT to backend; next fetch reflects new values | [ ] |
| L2-04 | Soft/hard threshold display | Cross a soft-cap threshold | Panel highlights the crossed threshold and shows last alert timestamp | [ ] |
| L2-05 | Sandbox summary | Load the sandbox panel | Lists per-org counts of SSO, integration, and webhook configs; no `authToken` or `clientSecret` visible | [ ] |
| L2-06 | Manual reset | Click Reset on a budget scope | Budget spend, tokens, and alerts clear; period advances | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Non-admin user attempts edit | Save button disabled or backend returns 403 | [ ] |
| L3-02 | Missing orgId | Service uses `default` and does not crash | [ ] |
| L3-03 | Invalid `alertIntervals` input | UI sanitizes to numbers; backend rejects out-of-range values | [ ] |
| L3-04 | Large budget list | Pagination or scrollable grid, no UI lock-up | [ ] |
| L3-05 | Existing dashboard routes unaffected | All other views still load and route correctly | [ ] |
| L3-06 | No new dependencies | Uses existing `fetch` helpers and Vanilla JS | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No plaintext secrets rendered in the DOM or sent to the dashboard | [ ] |
| S-02 | Budget mutations require `admin:all` on the backend | [ ] |
| S-03 | Sandbox summary endpoint returns only counts and metadata, never decryption keys | [ ] |
| S-04 | API responses include `success/error` without leaking internal paths | [ ] |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________
