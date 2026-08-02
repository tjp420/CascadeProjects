# Test Plan — Track 48 Enclave Fault Injection and Byzantine Chaos Testing

**Branch:** `feature/track48-enclave-fault-injection`
**Date:** 2026-08-02
**Status:** Active

## Objective

Provide a controlled framework for injecting faults into the enclave cluster to validate the resilience of Tracks 41-47. Simulates byzantine behavior, network partitions, enclave crashes, key corruption, and timing attacks in a deterministic, reproducible manner.

## Change Set

| File | Change |
|------|--------|
| server/lib/hsm-adapter/enclave-fault-injection.cjs | New — EnclaveFaultInjection class (544 lines) |
| server/lib/hsm-adapter/hsm-metrics.cjs | Added 12 Track 48 counters |
| server/lib/hsm-adapter/__tests__/enclave-fault-injection.test.cjs | New — 40 tests |
| .simplebeacon/qa/test_plan.md | Updated |
| .simplebeacon/qa/software_health_report.md | Updated |

## Architecture

- **FaultInjector**: Injects 8 fault types (byzantine equivocation/omission, network partition, crash, key corruption, timing attack, heartbeat loss, state divergence)
- **ByzantineSimulator**: Simulates byzantine behavior with effects and recovery actions
- **ChaosScheduler**: Random fault injection with configurable probability
- **ScenarioRunner**: Predefined multi-step fault scenarios with error tracking
- **FaultRecoveryValidator**: Validates system recovery state
- **DeterministicPRNG**: Reproducible fault injection with configurable seed

## Check Items

### Level 1 - Deterministic
- [x] L1.1 node -c all modified JS files - PASS
- [x] L1.2 40 new Track 48 tests pass
- [x] L1.3 160 existing tests pass (no regression)
- [x] L1.4 No new dependencies

### Level 2 - Functional
- [x] L2.01 injectFault (12 tests)
- [x] L2.02 cancelFault (2 tests)
- [x] L2.03 resolveFault (2 tests)
- [x] L2.04 checkExpiredFaults (2 tests)
- [x] L2.05 chaosStep (4 tests)
- [x] L2.06 runScenario (3 tests)
- [x] L2.07 validateRecovery (3 tests)
- [x] L2.08 getFault (3 tests)
- [x] L2.09 getActiveFaults (1 test)
- [x] L2.10 getFaultHistory (1 test)
- [x] L2.11 getScenario (2 tests)
- [x] L2.12 getStats (1 test)
- [x] L2.13 reset (1 test)
- [x] L2.14 recovery actions (2 tests)
- [x] L2.15 deterministic mode reproducibility (1 test)

### Level 3 - Security
- [x] L3.01 No secrets exposed
- [x] L3.02 No scope creep
- [x] L3.03 No regression
