# Test Plan — Track 49 Dynamic Enclave Rescaling and Predictive Load Balancing

**Branch:** `feature/track49-dynamic-rescaling`
**Date:** 2026-08-02
**Status:** Active

## Objective

Auto-scale the enclave cluster layout topology based on real-time load metrics and predictive forecasting. Integrates with Track 44 CrossEnclaveStateSync for shard rebalancing and Track 48 FaultInjection for chaos-triggered rescaling.

## Change Set

| File | Change |
|------|--------|
| server/lib/hsm-adapter/dynamic-enclave-rescaling.cjs | New — DynamicEnclaveRescaler class (570 lines) |
| server/lib/hsm-adapter/hsm-metrics.cjs | Added 9 Track 49 counters |
| server/lib/hsm-adapter/__tests__/dynamic-enclave-rescaling.test.cjs | New — 43 tests |
| .simplebeacon/qa/test_plan.md | Updated |
| .simplebeacon/qa/software_health_report.md | Updated |

## Architecture

- **LoadMonitor**: Per-enclave load sampling with configurable sliding window
- **PredictiveForecaster**: Moving average and linear trend (least squares) forecasting
- **RescalingDecisionEngine**: Threshold-based scale up/down/rebalance decisions with cooldown
- **ShardRebalancer**: Redistributes shards from overloaded to underloaded enclaves
- **CapacityPlanner**: Calculates optimal enclave count based on predicted load
- **ChaosTrigger**: Rescales on chaos events from Track 48

## Check Items

### Level 1 - Deterministic
- [x] L1.1 node -c all modified JS files - PASS
- [x] L1.2 43 new Track 49 tests pass
- [x] L1.3 200 existing tests pass (no regression)
- [x] L1.4 No new dependencies

### Level 2 - Functional
- [x] L2.01 registerEnclave (5 tests)
- [x] L2.02 unregisterEnclave (2 tests)
- [x] L2.03 recordLoad (4 tests)
- [x] L2.04 getAverageLoad (2 tests)
- [x] L2.05 getMaxLoad (1 test)
- [x] L2.06 forecastLoad (3 tests)
- [x] L2.07 getImbalance (3 tests)
- [x] L2.08 evaluateScaling (8 tests)
- [x] L2.09 executeScaling (5 tests)
- [x] L2.10 registerShard (3 tests)
- [x] L2.11 onChaosEvent (3 tests)
- [x] L2.12 getEnclaves (1 test)
- [x] L2.13 getActionHistory (1 test)
- [x] L2.14 getStats (1 test)
- [x] L2.15 reset (1 test)

### Level 3 - Security
- [x] L3.01 No secrets exposed
- [x] L3.02 No scope creep
- [x] L3.03 No regression
