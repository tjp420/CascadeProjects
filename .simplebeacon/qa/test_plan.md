# Test Plan: Track 123 — Secure Shard Repair Worker Hardening

> Copy to `.simplebeacon/qa/test_plan.md` and fill before Builder writes feature code.
> User approval required unless the task explicitly includes an approved plan.

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Track 123: Secure shard repair worker — idempotent repair loop, jitter, atomic persistence, observability, tenant isolation |
| Author (Builder) | Devin |
| Date | 2026-08-05 |
| Branch | feat/track123-secure-shard-repair |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `server/lib/storage/repair-worker.cjs` — core worker implementation
- `server/lib/storage/__tests__/repair-worker.test.cjs` — worker unit tests
- `server/lib/storage/reassembler.cjs` — shard reassembly validation
- `server/lib/storage/__tests__/reassembler.test.cjs` — reassembly edge cases
- `server/lib/storage/README-REPAIR-WORKER.md` — operational documentation
- `server/lib/hsm-adapter/hsm-metrics.cjs` — new telemetry counters

### APIs / routes

- Event bus: `shard:reconciler:reconcile_requested` and `reconcile:requested` subscriptions
- Internal repair worker lifecycle: `handle(payload)`, `executeRepair(payload)`, event emissions
- Metrics: `hsm_repair_worker_*_total` counters and `hsm_shard_reconciler_*_total` counters

### UI / IDE surfaces

- [ ] Not applicable — pure backend storage worker

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on changed JS/CJS | `node -c server/lib/storage/repair-worker.cjs` | [ ] |
| L1-02 | Syntax on changed test | `node -c server/lib/storage/__tests__/repair-worker.test.cjs` | [ ] |
| L1-03 | ai-platform unit test | `cd ai-platform && npx jest server/lib/storage/__tests__/repair-worker.test.cjs --no-coverage` | [ ] |
| L1-04 | SimpleBeacon gate (full) | `npx simplebeacon scan --full --gate --format json` | [ ] |
| L1-05 | No secrets in diff | Manual / gate token rules | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Idempotency prevents duplicate repair | Emit two `reconcile_requested` events with identical `tenantId\|shardId\|rotatedAt` | Second request emits `repair:skipped` and increments `repair_skipped_duplicate` | [ ] |
| L2-02 | Coordinated jitter spreads load | Emit 50 repair requests with `repairJitterMs=1000` | Delays are uniformly distributed in `[0, 1000]` ms and started at distinct times | [ ] |
| L2-03 | Observability counters emit | Run a repair to success and a duplicate | `hsm_repair_worker_completed_total` and `hsm_shard_reconciler_repair_skipped_duplicate_total` increment with `{tenantId, shardId, worker}` labels | [ ] |
| L2-04 | Monotonic sequence validation | Attempt to apply a sequence number that is not `last+1` | Worker rejects and increments `repair_failed` | [ ] |
| L2-05 | Atomic write persistence | Simulate a crash mid-write | Shard state is either unchanged or fully repaired; no torn writes | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Re-entrant `handle` during processing | Worker does not lose track of active repair and correctly removes lock in `finally` | [ ] |
| L3-02 | Missing `rotatedAt` in payload | Worker throws clear error and does not corrupt store | [ ] |
| L3-03 | Concurrent repairs for different tenants | Both complete independently, no cross-tenant key collision | [ ] |
| L3-04 | Zero `repairJitterMs` | Repair starts immediately with delay `0` | [ ] |
| L3-05 | Existing Track 112 / reassembler tests | All existing `storage/` tests continue to pass | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No credentials / PII in logs or commits | [ ] |
| S-02 | Tenant-scoped shard fetch / apply | [ ] |
| S-03 | Sensitive session data encrypted with AES-256-GCM envelope before disk write | [ ] |
| S-04 | No long-term secrets persisted in worker process | [ ] |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________
