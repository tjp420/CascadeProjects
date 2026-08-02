# Software Health Report — Track 39: Threshold Account Recovery

**Date:** 2026-08-02
**Branch:** `feature/track39-threshold-account-recovery`
**Validator Sign-off:** Pending (Builder self-report; separate Validator pass recommended)

## Summary

Implemented ThresholdAccountRecoveryEngine that provides multi-signature social recovery for accounts. Account owners designate N guardians who hold recovery shares; recovery requires t-of-N guardian approvals to restore access. Includes time-locked recovery, guardian management, and anti-replay protection.

## Change Set

| File | Change | Lines |
|------|--------|-------|
| `server/lib/hsm-adapter/threshold-account-recovery-engine.cjs` | **New** — Threshold account recovery engine with GuardianRegistry | 482 |
| `server/lib/hsm-adapter/__tests__/threshold-account-recovery.test.cjs` | **New** — Test suite (39 tests) | 445 |
| `server/lib/hsm-adapter/crypto-policy-engine.cjs` | Added `thresholdAccountRecovery` policy block + merge entry | +18 |
| `server/lib/hsm-adapter/hsm-metrics.cjs` | Added 7 account recovery counters/gauges | +16 |

## Level 1 — Deterministic (required)

| Check | Result |
|-------|--------|
| `node -c threshold-account-recovery-engine.cjs` | PASS |
| `node -c threshold-account-recovery.test.cjs` | PASS |
| `node -c crypto-policy-engine.cjs` | PASS |
| `node -c hsm-metrics.cjs` | PASS |
| Threshold account recovery test suite (39 tests) | PASS |
| Policy engine test suite (16 tests) | PASS (no regression) |
| No new dependencies | Confirmed |
| No secrets committed | Confirmed |

## Level 2 — Functional Operations

| Test | Result |
|------|--------|
| L2.01: Happy-path register → request → approve (quorum) → execute → restore | PASS |
| L2.02: GuardianRegistry per-account tracking | PASS |
| L2.03: BFT quorum approvals gate recovery execution | PASS |
| L2.04: Multiple accounts tracked independently | PASS |
| L2.05: State machine enforces valid transitions | PASS |
| L2.06: Policy validation (thresholdAccountRecovery block, tenant overrides) | PASS |
| L2.07: Time-lock enforces delay between request and execution | PASS |
| L2.08: Guardian management: add/remove with quorum approval | PASS |

## Level 3 — Security Engineering

| Test | Result |
|------|--------|
| L3.01: Anti-replay — duplicate recovery requests rejected | PASS |
| L3.02: Cannot recover without quorum approvals | PASS |
| L3.03: Cannot approve after recovery is restored | PASS |
| L3.04: Rejected recovery is terminal | PASS |
| L3.05: Unauthorized guardian approval rejected | PASS |
| L3.06: No scope creep — only engine + policy + metrics + tests | Confirmed |
| L3.07: No ghost files or hallucinated API paths | Confirmed |
| L3.08: All existing tests still pass (no regression) | Confirmed |

## Defects

None.

## Unimplemented

None — all planned check-items from `test_plan.md` are implemented and passing.

## Bug Fixes During Testing

1. **Missing nonce in return value**: `initiateRecovery` did not return the `nonce` field, causing all `approveRecovery` calls to fail with `RECOVERY_NONCE_MISMATCH`. Fixed by adding `nonce` to the return object.
2. **Falsy-zero time-lock**: `options.defaultTimeLockMs || 86400000` treated `0` as falsy, falling through to 24-hour default. Fixed with `options.defaultTimeLockMs !== undefined ? options.defaultTimeLockMs : 86400000` (same pattern as Track 37's `targetEpoch` fix).
