# Test Plan — Track 34 Phase 6: Log Compaction & Snapshotting

**Branch:** `feature/track34-phase6-snapshotting`
**Date:** 2026-08-02
**Status:** Retroactive (hotfix per QA framework)

## Objective

Implement log compaction and snapshotting to prevent unbounded replication log memory growth. The engine can now truncate the committed log prefix, storing only a compacted state snapshot, and synchronize lagging followers via InstallSnapshot RPC.

## Change Set

| File | Change |
|------|--------|
| `server/lib/hsm-adapter/cluster-consensus-engine.cjs` | Added `createSnapshot()`, `maybeCompact()`, `installSnapshot()`, `getSnapshot()`. Snapshot state structs (`_lastSnapshotIndex`, `_lastSnapshotTerm`, `_snapshotState`). Updated `appendAndReplicate`, `appendEntries`, `_applyCommittedEntries`, `startElection`, `requestVote`, `_becomeLeader` to account for snapshot offset in log indexing. |
| `server/lib/hsm-adapter/crypto-policy-engine.cjs` | Added `enableSnapshotCompaction`, `snapshotThresholdMin`, `snapshotThresholdMax` to consensus policy + `_validateConsensus()` |
| `server/lib/hsm-adapter/hsm-metrics.cjs` | 3 new counters: `snapshot_created_total`, `snapshot_installed_total`, `snapshot_rejected_total` |
| `server/lib/hsm-adapter/__tests__/cluster-consensus-snapshot.test.cjs` | 33 new tests |

## Check Items

### Level 1 — Deterministic (required)

- [x] **L1.1** `node -c cluster-consensus-engine.cjs` — syntax pass
- [x] **L1.2** `node -c crypto-policy-engine.cjs` — syntax pass
- [x] **L1.3** `node -c hsm-metrics.cjs` — syntax pass
- [x] **L1.4** `node -c cluster-consensus-snapshot.test.cjs` — syntax pass
- [x] **L1.5** `npm test` (ai-platform) — 242 suites pass, 2645 tests pass
- [x] **L1.6** No new dependencies added
- [x] **L1.7** No secrets/keys committed

### Level 2 — Behavioral

- [x] **L2.1** createSnapshot truncates log prefix and stores state
- [x] **L2.2** createSnapshot rejects when commitIndex is 0
- [x] **L2.3** createSnapshot rejects when commitIndex already covered by snapshot
- [x] **L2.4** createSnapshot uses stateOverride when provided
- [x] **L2.5** createSnapshot records correct lastSnapshotTerm
- [x] **L2.6** maybeCompact returns null when below threshold
- [x] **L2.7** maybeCompact triggers compaction when threshold exceeded
- [x] **L2.8** Can append new entries after snapshot (index continues correctly)
- [x] **L2.9** getState includes snapshot info
- [x] **L2.10** Election uses absolute log index after snapshot
- [x] **L2.11** Follower installs snapshot from leader
- [x] **L2.12** installSnapshot rejects stale term
- [x] **L2.13** installSnapshot rejects older snapshot
- [x] **L2.14** installSnapshot rejects invalid signature
- [x] **L2.15** installSnapshot rejects missing inputs
- [x] **L2.16** installSnapshot rejects unknown leader
- [x] **L2.17** installSnapshot restores state via callback
- [x] **L2.18** installSnapshot keeps compatible log entries after snapshot point
- [x] **L2.19** getSnapshot returns null when no snapshot exists
- [x] **L2.20** getSnapshot returns snapshot data after createSnapshot
- [x] **L2.21** SNAPSHOT_CREATED event emitted
- [x] **L2.22** SNAPSHOT_INSTALLED event emitted
- [x] **L2.23** SNAPSHOT_REJECTED event emitted
- [x] **L2.24** End-to-end: leader compacts, continues appending, follower catches up via snapshot

### Level 3 — Self-review / drift

- [x] **L3.1** No scope creep — only snapshotting added
- [x] **L3.2** No ghost files
- [x] **L3.3** Existing 111 Track 34 tests still pass (no regression)
- [x] **L3.4** Policy validation covers `enableSnapshotCompaction`, `snapshotThreshold` bounds
- [x] **L3.5** Prometheus metrics increment correctly for created/installed/rejected events
- [x] **L3.6** Snapshot offset correctly applied to all log indexing paths

## Pre-existing Failures (not caused by this change)

| Suite | Cause |
|-------|-------|
| `hsm-vault-throttle.test.cjs` | Pre-existing |
| `hub-smoke.test.js` | Pre-existing |
| `dashboard-auth.test.cjs` | Pre-existing |
| `zkp-identity.test.cjs` | Pre-existing (from recently merged track43) |
