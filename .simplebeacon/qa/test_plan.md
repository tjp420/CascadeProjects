# Test Plan - Track 40: Distributed Consensus Coordinator

**Branch:** `feature/track40-consensus-coordinator`
**Date:** 2026-08-02
**Status:** Active

## Objective

Build a Distributed Consensus Coordinator that orchestrates multiple ClusterConsensusEngine instances (Track 34) across consensus groups.

## Change Set

| File | Change |
|------|--------|
| `server/lib/hsm-adapter/distributed-consensus-coordinator.cjs` | **New** - Coordinator engine (620 lines) |
| `server/lib/hsm-adapter/__tests__/distributed-consensus-coordinator.test.cjs` | **New** - Test suite (46 tests) |
| `server/lib/hsm-adapter/hsm-metrics.cjs` | Add 10 `hsm_consensus_coord_*` counters |
| `server/lib/hsm-adapter/crypto-policy-engine.cjs` | Add `distributedConsensusCoordinator` policy block |

## Check Items

### Level 1 - Deterministic

- [x] L1.1 `node -c distributed-consensus-coordinator.cjs` - PASS
- [x] L1.2 `node -c distributed-consensus-coordinator.test.cjs` - PASS
- [x] L1.3 `node -c hsm-metrics.cjs` - PASS
- [x] L1.4 `node -c crypto-policy-engine.cjs` - PASS
- [x] L1.5 All 46 new tests pass
- [x] L1.6 All 178 existing consensus/policy tests pass (no regression)
- [x] L1.7 No new dependencies added

### Level 2 - Functional Operations

- [x] L2.01 Create a consensus group - group appears in registry
- [x] L2.02 Destroy a consensus group - group removed from registry
- [x] L2.03 Route a proposal to the correct group by key range
- [x] L2.04 Route a proposal to the correct group by topic
- [x] L2.05 Detect a node failure via heartbeat timeout - fault detector triggers
- [x] L2.06 Coordinate view change across groups when a leader fails
- [x] L2.07 Aggregate state from all consensus groups
- [x] L2.08 Verify cross-group quorum for multi-group operations
- [x] L2.09 Reject proposal to non-existent group
- [x] L2.10 Reject proposal when quorum not met

### Level 3 - Security Engineering

- [x] L3.01 Coordinator validates group creation against policy limits
- [x] L3.02 Fault detector has configurable timeout thresholds
- [x] L3.03 View change coordinator prevents split-brain
- [x] L3.04 No scope creep - only coordinator + metrics + policy + tests
- [x] L3.05 All existing tests still pass (no regression)
