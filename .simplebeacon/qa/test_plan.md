# Test Plan — Track 40 Route Integration

**Branch:** `feature/track40-route-integration`
**Date:** 2026-08-02
**Status:** Active

## Objective

Mount the Track 40 DistributedConsensusCoordinator into `hsm-vault-routes.cjs` to expose live consensus group management, proposal routing, view change coordination, and fault detection telemetry via REST endpoints.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/vault/consensus/groups` | List all consensus groups |
| GET | `/api/vault/consensus/groups/:groupId` | Get a specific group's state |
| POST | `/api/vault/consensus/groups` | Create a new consensus group |
| DELETE | `/api/vault/consensus/groups/:groupId` | Destroy a consensus group |
| POST | `/api/vault/consensus/proposals` | Route a proposal to the appropriate group |
| POST | `/api/vault/consensus/heartbeat` | Record a heartbeat from a node |
| POST | `/api/vault/consensus/view-change` | Initiate a view change |
| POST | `/api/vault/consensus/view-change/vote` | Cast a vote for an ongoing view change |
| GET | `/api/vault/consensus/coordinator/status` | Get aggregated coordinator state + telemetry counters |

## Change Set

| File | Change |
|------|--------|
| `server/lib/hsm-adapter/base-adapter.cjs` | Add coordinator registry (register/get) |
| `server/routes/hsm-vault-routes.cjs` | Add 9 consensus coordinator endpoints |
| `server/lib/__tests__/hsm-vault-consensus-coordinator-routes.test.cjs` | **New** — Test suite |

## Check Items

### Level 1 — Deterministic

- [ ] L1.1 `node -c base-adapter.cjs` — PASS
- [ ] L1.2 `node -c hsm-vault-routes.cjs` — PASS
- [ ] L1.3 `node -c hsm-vault-consensus-coordinator-routes.test.cjs` — PASS
- [ ] L1.4 All new tests pass
- [ ] L1.5 All existing tests pass (no regression)
- [ ] L1.6 No new dependencies added

### Level 2 — Functional Operations

- [ ] L2.01 GET `/consensus/groups` returns 200 with group list
- [ ] L2.02 GET `/consensus/groups/:groupId` returns 200 with group state
- [ ] L2.03 GET `/consensus/groups/:groupId` returns 404 for non-existent group
- [ ] L2.04 POST `/consensus/groups` creates a group and returns 201
- [ ] L2.05 POST `/consensus/groups` returns 400 for missing groupId
- [ ] L2.06 POST `/consensus/groups` returns 409 for duplicate groupId
- [ ] L2.07 DELETE `/consensus/groups/:groupId` destroys a group and returns 200
- [ ] L2.08 DELETE `/consensus/groups/:groupId` returns 404 for non-existent group
- [ ] L2.09 POST `/consensus/proposals` routes a proposal and returns 200
- [ ] L2.10 POST `/consensus/proposals` returns 400 for invalid proposal
- [ ] L2.11 POST `/consensus/heartbeat` records a heartbeat and returns 200
- [ ] L2.12 POST `/consensus/view-change` initiates a view change and returns 200
- [ ] L2.13 POST `/consensus/view-change/vote` casts a vote and returns 200
- [ ] L2.14 GET `/consensus/coordinator/status` returns 200 with aggregated state + counters
- [ ] L2.15 All endpoints require admin:all authorization (403 for non-admin)

### Level 3 — Security Engineering

- [ ] L3.01 All endpoints gated behind admin:all authorization
- [ ] L3.02 No secrets exposed in any response
- [ ] L3.03 Coordinator registry follows existing consensus engine pattern
- [ ] L3.04 No scope creep — only routes + registry + tests
- [ ] L3.05 All existing tests still pass (no regression)
