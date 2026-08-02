# Test Plan — Track 32: BFT Shard Sync

**Branch:** `feature/track32-bft-shard-sync`
**Date:** 2026-08-02
**Status:** Active

## Objective

Implement a BFT shard sync engine that restores cross-node share replication accuracy via monotonic `ShardVectorClock` sequence tracking and non-blocking background sliding-window catch-up batch streamers.

## Change Set

| File | Change |
|------|--------|
| `server/lib/hsm-adapter/bft-shard-sync-engine.cjs` | **New** — BFT shard sync engine with ShardVectorClock |
| `server/lib/hsm-adapter/__tests__/bft-shard-sync.test.cjs` | **New** — Test suite (32 tests) |
| `server/lib/hsm-adapter/crypto-policy-engine.cjs` | Add `bftShardSync` policy block |
| `server/lib/hsm-adapter/hsm-metrics.cjs` | Add 7 shard sync counters |

## Check Items

### Level 1 — Deterministic

- [x] L1.1 `node -c bft-shard-sync-engine.cjs` — PASS
- [x] L1.2 `node -c bft-shard-sync.test.cjs` — PASS
- [x] L1.3 `node -c crypto-policy-engine.cjs` — PASS
- [x] L1.4 `node -c hsm-metrics.cjs` — PASS
- [x] L1.5 BFT shard sync test suite (32 tests) — PASS
- [x] L1.6 Policy engine test suite (16 tests) — PASS (no regression)
- [x] L1.7 No new dependencies added

### Level 2 — Functional Operations

- [x] L2.01 Full happy-path: create shard → append entries → quorum ack → commit
- [x] L2.02 ShardVectorClock tracks per-node replication position
- [x] L2.03 Quorum acknowledgment (t-of-N) gates commit
- [x] L2.04 Sliding-window catch-up detects lagging nodes
- [x] L2.05 Catch-up batch streams missing entries to lagging node
- [x] L2.06 Multiple shards tracked independently
- [x] L2.07/L2.08 Policy validation: bftShardSync block present, tenant overrides work

### Level 3 — Security Engineering

- [x] L3.01 Byzantine node detection: node with divergent state flagged
- [x] L3.02 Quarantined node excluded from synced state
- [x] L3.03 Anti-replay: stale sequence number rejected
- [x] L3.04 Cannot commit without quorum
- [x] L3.05 No scope creep — only engine + policy + metrics + tests
- [x] L3.06 No ghost files or hallucinated API paths
- [x] L3.07 All existing tests still pass (no regression)
