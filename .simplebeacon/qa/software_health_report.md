# Software Health Report — Track 37: Multiparty Re-Keying

**Date:** 2026-08-02
**Branch:** `feature/track37-multiparty-rekeying`
**Validator Sign-off:** Pending

## Summary

Implemented MultipartyReKeyingEngine that proactively refreshes secret shares without changing the underlying secret. Supports adding/removing shareholders, threshold adjustment, and epoch-based anti-rollback protection using share resharing.

## Change Set

| File | Change | Lines |
|------|--------|-------|
| `server/lib/hsm-adapter/multiparty-rekeying-engine.cjs` | **New** — Multiparty re-keying engine with ShareResharing | 532 |
| `server/lib/hsm-adapter/__tests__/multiparty-rekeying.test.cjs` | **New** — Test suite (37 tests) | 472 |
| `server/lib/hsm-adapter/crypto-policy-engine.cjs` | Added `multipartyReKeying` policy block + merge entry | +18 |
| `server/lib/hsm-adapter/hsm-metrics.cjs` | Added 7 re-keying counters/gauges | +16 |

## Level 1 — Deterministic (required)

| Check | Result |
|-------|--------|
| `node -c multiparty-rekeying-engine.cjs` | PASS |
| `node -c multiparty-rekeying.test.cjs` | PASS |
| `node -c crypto-policy-engine.cjs` | PASS |
| `node -c hsm-metrics.cjs` | PASS |
| Multiparty re-keying test suite (37 tests) | PASS |
| Policy engine test suite (16 tests) | PASS (no regression) |
| No new dependencies | Confirmed |
| No secrets committed | Confirmed |

## Level 2 — Functional Operations

| Test | Result |
|------|--------|
| L2.01: Happy-path propose → reshave → verify → ack (quorum) → commit | PASS |
| L2.02: Re-keying epoch is monotonic (anti-rollback) | PASS |
| L2.03: BFT quorum acknowledgments gate commit | PASS |
| L2.04: Shareholder addition/removal during re-keying | PASS |
| L2.05: Threshold adjustment during re-keying | PASS |
| L2.06: State machine enforces valid transitions | PASS |
| L2.07: Policy validation (multipartyReKeying block, tenant overrides) | PASS |
| L2.08: Old shares zeroized after successful commit | PASS |

## Level 3 — Security Engineering

| Test | Result |
|------|--------|
| L3.01: Anti-rollback — re-keying epoch cannot decrease | PASS |
| L3.02: Cannot commit without quorum acknowledgments | PASS |
| L3.03: Cannot reshave without proposal phase | PASS |
| L3.04: Verification rejects invalid shares (non-zero constant, wrong degree, unknown target, insufficient) | PASS |
| L3.05: Aborted re-keying is terminal (cannot retry on same epoch) | PASS |
| L3.06: No scope creep — only engine + policy + metrics + tests | Confirmed |
| L3.07: No ghost files or hallucinated API paths | Confirmed |
| L3.08: All existing tests still pass (no regression) | Confirmed |

## Defects

None.

## Unimplemented

None — all planned check-items from `test_plan.md` are implemented and passing.

## Bug Fix During Testing

- Fixed `targetEpoch` falsy check: `options.targetEpoch || ...` treated `0` as falsy, replaced with `options.targetEpoch !== undefined ? ... : ...` to correctly handle explicit epoch `0`.
