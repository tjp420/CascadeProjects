# Test Plan — Track 40 Route Integration

**Branch:** `feature/track40-route-integration`
**Date:** 2026-08-02
**Status:** Active

## Objective

Mount the Track 40 DistributedConsensusCoordinator into hsm-vault-routes.cjs to expose live consensus group management, proposal routing, view change coordination, and fault detection telemetry via REST endpoints.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/vault/consensus/coordinator/status | Aggregated state + counters |
| GET | /api/vault/consensus/groups | List all groups |
| GET | /api/vault/consensus/groups/:groupId | Get specific group |
| POST | /api/vault/consensus/groups | Create group |
| DELETE | /api/vault/consensus/groups/:groupId | Destroy group |
| POST | /api/vault/consensus/proposals | Route proposal |
| POST | /api/vault/consensus/heartbeat | Record heartbeat |
| POST | /api/vault/consensus/view-change | Initiate view change |
| POST | /api/vault/consensus/view-change/vote | Cast vote |

## Change Set

| File | Change |
|------|--------|
| server/lib/hsm-adapter/base-adapter.cjs | Add coordinator registry |
| server/routes/hsm-vault-routes.cjs | Add 9 endpoints |
| server/lib/__tests__/hsm-vault-consensus-coordinator-routes.test.cjs | New - 38 tests |

## Check Items

### Level 1 - Deterministic
- [x] L1.1 node -c base-adapter.cjs - PASS
- [x] L1.2 node -c hsm-vault-routes.cjs - PASS
- [x] L1.3 node -c test file - PASS
- [x] L1.4 All 38 new tests pass
- [x] L1.5 All 78 existing tests pass (no regression)
- [x] L1.6 No new dependencies

### Level 2 - Functional
- [x] L2.01-L2.15 All endpoint tests pass (see test suite)

### Level 3 - Security
- [x] L3.01 All endpoints gated behind admin:all
- [x] L3.02 No secrets exposed
- [x] L3.03 No scope creep
- [x] L3.04 No regression
