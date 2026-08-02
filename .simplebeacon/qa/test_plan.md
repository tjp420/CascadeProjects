# Test Plan — Track 34: Cross-Cluster Migration

**Branch:** `feature/track34-cross-cluster-migration`
**Date:** 2026-08-02
**Status:** Active

## Objective

Implement a cross-cluster migration engine that engineers secure multi-region state transitions. The engine coordinates shard state transfer between source and destination clusters with BFT-gated commit, attested migration manifests, rollback safety, and replay protection.

## Change Set

| File | Change |
|------|--------|
| `server/lib/hsm-adapter/cross-cluster-migration-engine.cjs` | **New** — Cross-cluster migration engine |
| `server/lib/hsm-adapter/__tests__/cross-cluster-migration.test.cjs` | **New** — Test suite (32 tests) |
| `server/lib/hsm-adapter/crypto-policy-engine.cjs` | Add `crossClusterMigration` policy block |
| `server/lib/hsm-adapter/hsm-metrics.cjs` | Add migration counters/gauges |

## Check Items

### Level 1 — Deterministic

- [x] L1.1 `node -c cross-cluster-migration-engine.cjs` — PASS
- [x] L1.2 `node -c cross-cluster-migration.test.cjs` — PASS
- [x] L1.3 `node -c crypto-policy-engine.cjs` — PASS
- [x] L1.4 `node -c hsm-metrics.cjs` — PASS
- [x] L1.5 Cross-cluster migration test suite (32 tests) — PASS
- [x] L1.6 Policy engine test suite (16 tests) — PASS (no regression)
- [x] L1.7 No new dependencies added

### Level 2 — Functional Operations

- [x] L2.01 Full happy-path: initiate → attest → transfer → verify → commit
- [x] L2.02 MigrationManifest carries shard IDs, vector-clock snapshot, entry counts
- [x] L2.03 BFT quorum acknowledgment gates commit on destination cluster
- [x] L2.04 Multiple shards migrated in a single migration
- [x] L2.05 Migration state machine enforces valid transitions
- [x] L2.06 Policy validation: crossClusterMigration block present, tenant overrides work
- [x] L2.07 Attestation required before transfer begins
- [x] L2.08 Vector-clock checkpoint included in manifest

### Level 3 — Security Engineering

- [x] L3.01 Rollback on verification failure — source retains primary ownership
- [x] L3.02 Rollback on quorum failure — migration does not commit
- [x] L3.03 Replay protection: unique monotonic migration IDs
- [x] L3.04 Replay protection: committed migration cannot be acked again
- [x] L3.05 Unauthorized attestation authority rejected
- [x] L3.06 Cannot commit without quorum
- [x] L3.07 No scope creep — only engine + policy + metrics + tests
- [x] L3.08 No ghost files or hallucinated API paths
- [x] L3.09 All existing tests still pass (no regression)
