# Test Plan — Track 35: Cluster Key Reconciliation

**Branch:** `feature/track35-cluster-key-reconciliation`
**Date:** 2026-08-02
**Status:** Active

## Objective

Implement a cluster key reconciliation engine that detects split-brain key divergence across cluster nodes and reconciles divergent keys via quorum-voted key epoch advancement with anti-rollback protection.

## Change Set

| File | Change |
|------|--------|
| `server/lib/hsm-adapter/cluster-key-reconciliation-engine.cjs` | **New** — Cluster key reconciliation engine |
| `server/lib/hsm-adapter/__tests__/cluster-key-reconciliation.test.cjs` | **New** — Test suite (34 tests) |
| `server/lib/hsm-adapter/crypto-policy-engine.cjs` | Add `clusterKeyReconciliation` policy block |
| `server/lib/hsm-adapter/hsm-metrics.cjs` | Add reconciliation counters/gauges |

## Check Items

### Level 1 — Deterministic

- [x] L1.1 `node -c cluster-key-reconciliation-engine.cjs` — PASS
- [x] L1.2 `node -c cluster-key-reconciliation.test.cjs` — PASS
- [x] L1.3 `node -c crypto-policy-engine.cjs` — PASS
- [x] L1.4 `node -c hsm-metrics.cjs` — PASS
- [x] L1.5 Cluster key reconciliation test suite (34 tests) — PASS
- [x] L1.6 Policy engine test suite (16 tests) — PASS (no regression)
- [x] L1.7 No new dependencies added

### Level 2 — Functional Operations

- [x] L2.01 Full happy-path: scan → detect divergence → reconcile → quorum vote → commit
- [x] L2.02 KeyEpochTracker tracks per-node, per-key epoch with fingerprint
- [x] L2.03 BFT quorum vote gates key epoch promotion
- [x] L2.04 Multiple keys reconciled independently
- [x] L2.05 Reconciliation state machine enforces valid transitions
- [x] L2.06 Policy validation: clusterKeyReconciliation block present, tenant overrides work
- [x] L2.07 Key fingerprint computed via SHA-256 without exposing key material
- [x] L2.08 Divergence severity classification (minor vs critical)

### Level 3 — Security Engineering

- [x] L3.01 Anti-rollback: key epoch cannot decrease
- [x] L3.02 Split-brain detection: divergent nodes isolated from quorum voting
- [x] L3.03 Quarantine: unrecoverable divergence results in QUARANTINED state
- [x] L3.04 Cannot promote key epoch without quorum
- [x] L3.05 Stale fingerprint rejected (must match current epoch)
- [x] L3.06 No scope creep — only engine + policy + metrics + tests
- [x] L3.07 No ghost files or hallucinated API paths
- [x] L3.08 All existing tests still pass (no regression)
