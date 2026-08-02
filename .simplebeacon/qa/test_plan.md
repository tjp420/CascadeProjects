# Test Plan — Track 37: Multiparty Re-Keying

**Branch:** `feature/track37-multiparty-rekeying`
**Date:** 2026-08-02
**Status:** Active

## Objective

Implement a multiparty re-keying engine that proactively refreshes secret shares without changing the underlying secret. Supports adding/removing shareholders, threshold adjustment, and epoch-based anti-rollback protection.

## Change Set

| File | Change |
|------|--------|
| `server/lib/hsm-adapter/multiparty-rekeying-engine.cjs` | **New** — Multiparty re-keying engine |
| `server/lib/hsm-adapter/__tests__/multiparty-rekeying.test.cjs` | **New** — Test suite (37 tests) |
| `server/lib/hsm-adapter/crypto-policy-engine.cjs` | Add `multipartyReKeying` policy block |
| `server/lib/hsm-adapter/hsm-metrics.cjs` | Add re-keying counters/gauges |

## Check Items

### Level 1 — Deterministic

- [x] L1.1 `node -c multiparty-rekeying-engine.cjs` — PASS
- [x] L1.2 `node -c multiparty-rekeying.test.cjs` — PASS
- [x] L1.3 `node -c crypto-policy-engine.cjs` — PASS
- [x] L1.4 `node -c hsm-metrics.cjs` — PASS
- [x] L1.5 Multiparty re-keying test suite (37 tests) — PASS
- [x] L1.6 Policy engine test suite (16 tests) — PASS (no regression)
- [x] L1.7 No new dependencies added

### Level 2 — Functional Operations

- [x] L2.01 Full happy-path: propose → reshave → verify → quorum ack → commit
- [x] L2.02 Re-keying epoch is monotonic (anti-rollback)
- [x] L2.03 BFT quorum acknowledgments gate commit
- [x] L2.04 Shareholder addition/removal during re-keying
- [x] L2.05 Threshold adjustment during re-keying
- [x] L2.06 Re-keying state machine enforces valid transitions
- [x] L2.07 Policy validation: multipartyReKeying block present, tenant overrides work
- [x] L2.08 Old shares zeroized after successful commit

### Level 3 — Security Engineering

- [x] L3.01 Anti-rollback: re-keying epoch cannot decrease
- [x] L3.02 Cannot commit without quorum acknowledgments
- [x] L3.03 Cannot reshave without proposal phase
- [x] L3.04 Verification rejects invalid new shares
- [x] L3.05 Aborted re-keying is terminal (cannot retry on same epoch)
- [x] L3.06 No scope creep — only engine + policy + metrics + tests
- [x] L3.07 No ghost files or hallucinated API paths
- [x] L3.08 All existing tests still pass (no regression)
