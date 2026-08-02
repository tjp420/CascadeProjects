# Test Plan — Expose Recovery Telemetry

**Branch:** `feature/expose-recovery-telemetry`
**Date:** 2026-08-02
**Status:** Active

## Objective

Expose Track 39's threshold account recovery metrics to the frontend Analytical Dashboard via a JSON API endpoint, dashboard service, and component.

## Change Set

| File | Change |
|------|--------|
| `server/routes/hsm-vault-routes.cjs` | Add `GET /api/vault/recovery/status` endpoint |
| `server/lib/__tests__/hsm-vault-recovery-status-route.test.cjs` | **New** — Test suite (6 tests) |
| `web/dashboard/js-es2018/services/recoveryTelemetryService.js` | **New** — Dashboard service |
| `web/dashboard/js-es2018/components/RecoveryTelemetryDashboard.js` | **New** — Dashboard component |

## Check Items

### Level 1 — Deterministic

- [x] L1.1 `node -c hsm-vault-routes.cjs` — PASS
- [x] L1.2 `node -c hsm-vault-recovery-status-route.test.cjs` — PASS
- [x] L1.3 Recovery status route test suite (6 tests) — PASS
- [x] L1.4 Existing vault metrics route tests (6 tests) — PASS (no regression)
- [x] L1.5 No new dependencies added

### Level 2 — Functional Operations

- [x] L2.01 `GET /api/vault/recovery/status` returns 200 with JSON for admin
- [x] L2.02 Response includes all 7 recovery counters
- [x] L2.03 Returns 403 for non-admin users
- [x] L2.04 RecoveryTelemetryService fetches data from the endpoint
- [x] L2.05 RecoveryTelemetryDashboard renders metric chips

### Level 3 — Security Engineering

- [x] L3.01 Endpoint requires `admin:all` authorization
- [x] L3.02 No secrets exposed in telemetry output
- [x] L3.03 No scope creep — only route + service + component + tests
- [x] L3.04 All existing tests still pass (no regression)
