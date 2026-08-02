# Test Plan - Core Replication Telemetry Exposure

**Branch:** `feature/core-replication-telemetry`
**Date:** 2026-08-02
**Status:** Active

## Objective

Expose Track 34-38 backend metrics to the frontend Analytical Dashboard via a unified JSON API endpoint.

## Change Set

| File | Change |
|------|--------|
| `server/routes/hsm-vault-routes.cjs` | Add `GET /api/vault/replication/status` endpoint |
| `server/lib/__tests__/hsm-vault-replication-status-route.test.cjs` | **New** - Test suite (8 tests) |
| `web/dashboard/js-es2018/services/replicationTelemetryService.js` | **New** - Dashboard service |
| `web/dashboard/js-es2018/components/CoreReplicationTelemetryDashboard.js` | **New** - Dashboard component |

## Check Items

### Level 1 - Deterministic

- [x] L1.1 `node -c hsm-vault-routes.cjs` - PASS
- [x] L1.2 `node -c hsm-vault-replication-status-route.test.cjs` - PASS
- [x] L1.3 Replication status route test suite (8 tests) - PASS
- [x] L1.4 Existing vault route tests (12 tests) - PASS (no regression)
- [x] L1.5 No new dependencies added

### Level 2 - Functional Operations

- [x] L2.01 `GET /api/vault/replication/status` returns 200 with JSON for admin
- [x] L2.02 Response includes all 5 track groups with 7 counters each (35 total)
- [x] L2.03 Returns 403 for non-admin users
- [x] L2.04 ReplicationTelemetryService fetches data from the endpoint
- [x] L2.05 CoreReplicationTelemetryDashboard renders 5 groups of metric chips

### Level 3 - Security Engineering

- [x] L3.01 Endpoint requires `admin:all` authorization
- [x] L3.02 No secrets exposed in telemetry output
- [x] L3.03 No scope creep - only 6 files (route + test + service + component + QA docs)
- [x] L3.04 All existing tests still pass (no regression)
