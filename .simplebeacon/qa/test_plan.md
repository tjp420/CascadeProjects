# Test Plan — Track 27: PQC Threshold Signatures

**Branch:** `feature/track27-pqc-threshold-signatures`
**Date:** 2026-08-02
**Status:** Active

## Objective

Implement a threshold signature scheme that combines the DKG foundation (Track 26) with simulated post-quantum signature primitives (ML-DSA / Dilithium-style). This enables a quorum of N nodes to jointly sign a message without any single node holding the full signing key.

## Change Set

| File | Change |
|------|--------|
| `server/lib/hsm-adapter/pqc-threshold-signature-engine.cjs` | **New** — PQC threshold signature engine |
| `server/lib/hsm-adapter/__tests__/pqc-threshold-signature.test.cjs` | **New** — Test suite (27 tests) |
| `server/lib/hsm-adapter/crypto-policy-engine.cjs` | Add `pqcThreshold` policy block + merge entry |
| `server/lib/hsm-adapter/hsm-metrics.cjs` | Add 7 PQC threshold counters + metadata |

## Check Items

### Level 1 — Deterministic

- [x] L1.1 `node -c pqc-threshold-signature-engine.cjs` — PASS
- [x] L1.2 `node -c pqc-threshold-signature.test.cjs` — PASS
- [x] L1.3 `node -c crypto-policy-engine.cjs` — PASS
- [x] L1.4 `node -c hsm-metrics.cjs` — PASS
- [x] L1.5 PQC threshold test suite (27 tests) — PASS
- [x] L1.6 DKG test suite (29 tests) — PASS (no regression)
- [x] L1.7 Policy engine test suite (16 tests) — PASS (no regression)

### Level 2 — Functional Operations

- [x] L2.01 Full happy-path: DKG round (N=3, t=2) then threshold sign + verify
- [x] L2.02 Partial signature generation: each node produces a valid partial signature
- [x] L2.03 Signature aggregation: t partial signatures combine into a valid threshold signature
- [x] L2.04 Signature verification against DKG master public key
- [x] L2.05 Quorum starvation: fewer than t partial signatures cannot produce a valid signature
- [x] L2.06 Larger quorum (N=5, t=3) threshold sign + verify
- [x] L2.07/L2.08 Policy validation: pqcThreshold block present, tenant overrides work

### Level 3 — Security Engineering

- [x] L3.01 Invalid partial signature detection: tampered partial sigma rejected
- [x] L3.02 Non-qualified node cannot produce valid partial signature (NODE_DISQUALIFIED)
- [x] L3.03 Memory sanitization: partial signatures zeroized after aggregation
- [x] L3.04 No scope creep — only PQC threshold engine + policy + metrics + tests
- [x] L3.05 No ghost files or hallucinated API paths
- [x] L3.06 All existing tests still pass (no regression)
