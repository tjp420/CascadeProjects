# Test Plan — Track 39: Threshold Account Recovery

**Branch:** `feature/track39-threshold-account-recovery`
**Date:** 2026-08-02
**Status:** Active

## Objective

Implement a threshold account recovery engine that provides multi-signature social recovery for accounts with guardian-based approval, time-locked execution, and anti-replay protection.

## Change Set

| File | Change |
|------|--------|
| `server/lib/hsm-adapter/threshold-account-recovery-engine.cjs` | **New** — Threshold account recovery engine |
| `server/lib/hsm-adapter/__tests__/threshold-account-recovery.test.cjs` | **New** — Test suite (39 tests) |
| `server/lib/hsm-adapter/crypto-policy-engine.cjs` | Add `thresholdAccountRecovery` policy block |
| `server/lib/hsm-adapter/hsm-metrics.cjs` | Add account recovery counters/gauges |

## Check Items

### Level 1 — Deterministic

- [x] L1.1 `node -c threshold-account-recovery-engine.cjs` — PASS
- [x] L1.2 `node -c threshold-account-recovery.test.cjs` — PASS
- [x] L1.3 `node -c crypto-policy-engine.cjs` — PASS
- [x] L1.4 `node -c hsm-metrics.cjs` — PASS
- [x] L1.5 Threshold account recovery test suite (39 tests) — PASS
- [x] L1.6 Policy engine test suite (16 tests) — PASS (no regression)
- [x] L1.7 No new dependencies added

### Level 2 — Functional Operations

- [x] L2.01 Full happy-path: designate guardians → request recovery → approve (quorum) → recover → restore
- [x] L2.02 GuardianRegistry tracks per-account guardians
- [x] L2.03 BFT quorum approvals gate recovery execution
- [x] L2.04 Multiple accounts tracked independently
- [x] L2.05 Recovery state machine enforces valid transitions
- [x] L2.06 Policy validation: thresholdAccountRecovery block present, tenant overrides work
- [x] L2.07 Time-lock enforces delay between request and execution
- [x] L2.08 Guardian management: add/remove with quorum approval

### Level 3 — Security Engineering

- [x] L3.01 Anti-replay: duplicate recovery requests rejected
- [x] L3.02 Cannot recover without quorum approvals
- [x] L3.03 Cannot approve after recovery is restored
- [x] L3.04 Rejected recovery is terminal
- [x] L3.05 Unauthorized guardian approval rejected
- [x] L3.06 No scope creep — only engine + policy + metrics + tests
- [x] L3.07 No ghost files or hallucinated API paths
- [x] L3.08 All existing tests still pass (no regression)
