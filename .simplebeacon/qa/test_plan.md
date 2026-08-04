# Test Plan: Shard Reconciler Recovery Loop Integration

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Complete and wire shard-reconciler self-healing recovery loop with tenant isolation |
| Author (Builder) | Devin |
| Date | 2026-08-03 |
| Branch | `feat/shard-reconciler-integration-v2` |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/lib/storage/shard-reconciler.cjs` *(extend)*
- `ai-platform/server/lib/hsm-adapter/homomorphic-key-shard-disperser.cjs` *(read-only hook integration)*
- `ai-platform/server/lib/storage/__tests__/shard-reconciler.test.cjs` *(extend)*
- `ai-platform/server/lib/hsm-adapter/__tests__/run-all-tracks.cjs` *(register test)*

### APIs / routes

N/A — core library and tests only.

### UI / IDE surfaces

None.

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on reconciler | `node -c ai-platform/server/lib/storage/shard-reconciler.cjs` | [ ] |
| L1-02 | Syntax on test file | `node -c ai-platform/server/lib/storage/__tests__/shard-reconciler.test.cjs` | [ ] |
| L1-03 | Shard reconciler tests | `cd ai-platform && npx jest shard-reconciler --coverage=false` | [ ] |
| L1-04 | Parallel orchestrator | `cd ai-platform && npm run test:parallel` | [ ] |
| L1-05 | Full SimpleBeacon gate | `node packages/simplebeacon-cli/bin/simplebeacon.js scan --gate` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Single-node dropout triggers recovery | Simulate flight with one missing commit | Reconciliation restores target state | [ ] |
| L2-02 | Quorum enforcement | Drop below threshold nodes | Reconciliation fails closed with `SHARD_RECON_VIOLATION` | [ ] |
| L2-03 | Cross-tenant mismatch blocks | Use wrong `tenantId` in request | `CROSS_TENANT_RECON_VIOLATION` | [ ] |
| L2-04 | Valid single-tenant recovery | All ownership and tenant ids match | Successful reconciliation | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | No new dependencies | Native modules only | [ ] |
| L3-02 | No regression on existing tracks | 106 suites still pass | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No credentials in code or tests | [ ] |

---

## Approval

- [x] User approved this plan (or task included approved scope)
- Approved by: user  Date: 2026-08-03
