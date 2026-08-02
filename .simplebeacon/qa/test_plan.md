# Test Plan — Track 44 Distributed Sharding and Cross-Enclave State Sync

**Branch:** `feature/track44-cross-enclave-state-sync`
**Date:** 2026-08-02
**Status:** Active

## Objective

Implement multi-enclave architecture with shard distribution across enclaves, cross-enclave state synchronization with vector clocks, shard assignment/rebalancing, and conflict resolution for concurrent state updates.

## Change Set

| File | Change |
|------|--------|
| server/lib/hsm-adapter/cross-enclave-state-sync.cjs | New — CrossEnclaveStateSync class (488 lines) |
| server/lib/hsm-adapter/hsm-metrics.cjs | Added 13 Track 44 counters |
| server/lib/hsm-adapter/__tests__/cross-enclave-state-sync.test.cjs | New — 37 tests |
| .simplebeacon/qa/test_plan.md | Updated |
| .simplebeacon/qa/software_health_report.md | Updated |

## Architecture

- **EnclaveRegistry**: Tracks enclaves with status (active/degraded/offline), capacity, load, heartbeats
- **ShardAssignment**: Maps shards to enclaves with configurable replication factor
  - consistent-hash strategy: load-balanced assignment
  - round-robin strategy: simple sequential assignment
- **StateSyncProtocol**: Vector-clock-based state sync between enclaves
  - Incremental sync with merge/skip/conflict tracking
  - Last-writer-wins or quorum-merge conflict resolution
- **ConflictResolver**: Timestamp + sequence tiebreaker for concurrent writes
- **StaleDetection**: Marks enclaves offline after configurable heartbeat timeout
- **Auto-reassignment**: Reassigns shards when enclaves go offline

## Check Items

### Level 1 - Deterministic
- [x] L1.1 node -c all modified JS files - PASS
- [x] L1.2 37 new Track 44 tests pass
- [x] L1.3 110 existing tests pass (no regression)
- [x] L1.4 No new dependencies

### Level 2 - Functional
- [x] L2.01 registerEnclave/unregisterEnclave (5 tests)
- [x] L2.02 heartbeat and status tracking (2 tests)
- [x] L2.03 getActiveEnclaves filter (1 test)
- [x] L2.04 createShard with assignment (5 tests)
- [x] L2.05 writeState/readState (7 tests)
- [x] L2.06 syncState merge/skip/conflict (6 tests)
- [x] L2.07 detectStaleEnclaves (2 tests)
- [x] L2.08 getShards/getShard (3 tests)
- [x] L2.09 getSyncLog (1 test)
- [x] L2.10 getStats (1 test)
- [x] L2.11 reset (1 test)
- [x] L2.12 round-robin assignment (1 test)
- [x] L2.13 conflict resolution last-writer-wins (1 test)
- [x] L2.14 vector clock merge (1 test)

### Level 3 - Security
- [x] L3.01 No secrets exposed
- [x] L3.02 No scope creep
- [x] L3.03 No regression
