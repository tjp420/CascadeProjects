# Shard Reconciler Integration (Phase 1) — SPEC

Goal
----
Design and integrate a **Shard Reconciler** layer into the HomomorphicKeyShardDisperser stack to ensure partial or dropped shard states automatically trigger authenticated reconciliation cycles, with minimal service disruption and strong cryptographic guarantees.

Motivation
----------
- Restore resilience for fragmented key sets during node failure, network partitions, or partial uploads.
- Prevent stale/inconsistent shard states from blocking decryption or key recovery workflows.

Success criteria
----------------
- Deterministic reconciliation that re-assembles valid key material when >= threshold shards available.
- Tenant-isolated operation: reconciler must respect per-tenant access controls and not leak shard metadata.
- Audit events emitted for all reconciliation actions (request, accept, apply, fail).
- Automated unit + integration tests covering shard loss, concurrent reconciliations, and adversarial malformed shard inputs.

Phase 1 Plan (Spec-first)
-------------------------
1. Define state machine and message contract
   - `ReconcileRequest { tenantId, shardIds[], nonce, signer }`
   - `ReconcileAck { requestId, nodeId, proof }`
   - `ReconcileCommit { requestId, combinedMeta }`

2. Recovery algorithm (high-level)
   - Identify missing shards vs available
   - Validate shard signatures and versions
   - Use threshold recomposition if cryptographic scheme supports homomorphic recombine
   - If recomposition impossible, trigger safe-mode: create tombstone + alert

3. Authorization & Auditing
   - Require node-level attestation + signed requests
   - Emit audit events to `events.cjs` with redact rules (no raw shard material)

4. API surface and worker integration
   - Background worker: `shard-reconciler-worker` subscribes to `shard-events` queue
   - Admin endpoint: `POST /internal/shards/reconcile` to trigger manual reconciliation

5. Tests & Simulation
   - Unit tests for validation logic and signature checking
   - Integration tests simulating node drop and re-introduction
   - Fuzzer: randomize shard order, corrupted signatures, and out-of-date versions

6. Deployment & Rollout
   - Dark-run reconciliation (log-only) on canary first
   - Gradual enablement by tenant groups

Initial artifacts to create
-------------------------
- `ai-platform/server/lib/hsm-adapter/shard-reconciler.cjs` (worker + core functions)
- `ai-platform/server/routes/internal/shard-reconciler-routes.cjs` (admin trigger)
- Spec doc (this file)
- Tests: `__tests__/shard-reconciler.*.test.cjs`

Timing & Owners
---------------
- Owner: TBD (suggest: cryptography team lead + infra owner)
- Estimated Phase 1: 2-3 weeks (spec, core alg, tests, canary)

Next action (automated)
-----------------------
1. Create branch `feat/shard-reconciler-integration` (done).
2. Scaffold `shard-reconciler.cjs` with worker skeleton and add a TODO test harness.

---
For changes, propose follow-ups or request direct implementation on this branch.
