# Test Plan — Track 36: ZK Proof-of-Assets

**Branch:** `feature/track36-zk-proof-of-assets`
**Date:** 2026-08-02
**Status:** Active

## Objective

Implement a ZK proof-of-assets engine that generates non-interactive zero-knowledge proofs verifying that a tenant's assets are fully backed by committed reserves, without revealing individual asset amounts. Supports multi-tenant proofs with per-tenant commitment trees and Merkle-root compact verification.

## Architecture

- **AssetCommitment**: Pedersen-style commitment hiding individual asset amounts using blinding factors
- **MerkleCommitmentTree**: Merkle tree of asset commitments for compact proof aggregation
- **ProofOfAssets**: Non-interactive ZK proof that aggregate committed assets >= claimed backing
- **Multi-tenant support**: Per-tenant commitment trees with isolated blinding factors
- **Proof state machine**: `DRAFT → COMMITTED → PROVEN → VERIFIED` (with `INVALID` terminal)
- **BFT quorum gating**: Proof finalization requires t-of-N quorum signatures from validator nodes
- **Anti-inflation**: Proof verifies that no assets are double-counted across tenants

## Change Set

| File | Change |
|------|--------|
| `server/lib/hsm-adapter/zk-proof-of-assets-engine.cjs` | **New** — ZK proof-of-assets engine |
| `server/lib/hsm-adapter/__tests__/zk-proof-of-assets.test.cjs` | **New** — Test suite |
| `server/lib/hsm-adapter/crypto-policy-engine.cjs` | Add `zkProofOfAssets` policy block |
| `server/lib/hsm-adapter/hsm-metrics.cjs` | Add ZK proof-of-assets counters/gauges |

## Check Items

### Level 1 — Deterministic

- [ ] L1.1 `node -c zk-proof-of-assets-engine.cjs` — PASS
- [ ] L1.2 `node -c zk-proof-of-assets.test.cjs` — PASS
- [ ] L1.3 `node -c crypto-policy-engine.cjs` — PASS
- [ ] L1.4 `node -c hsm-metrics.cjs` — PASS
- [ ] L1.5 ZK proof-of-assets test suite — all pass
- [ ] L1.6 Policy engine test suite — all pass (no regression)
- [ ] L1.7 No new dependencies added

### Level 2 — Functional Operations

- [ ] L2.01 Full happy-path: register assets → build commitments → generate proof → verify → quorum finalize
- [ ] L2.02 AssetCommitment hides amount via Pedersen-style blinding
- [ ] L2.03 MerkleCommitmentTree aggregates commitments into compact root
- [ ] L2.04 Multiple tenants tracked independently with isolated commitment trees
- [ ] L2.05 Proof state machine enforces valid transitions
- [ ] L2.06 Policy validation: zkProofOfAssets block present, tenant overrides work
- [ ] L2.07 Proof verifies aggregate backing without revealing individual amounts
- [ ] L2.08 BFT quorum signatures gate proof finalization

### Level 3 — Security Engineering

- [ ] L3.01 Anti-inflation: double-counted assets detected and rejected
- [ ] L3.02 Tampered proof rejected (hash mismatch)
- [ ] L3.03 Cannot finalize proof without quorum
- [ ] L3.04 Invalid commitment (zero or negative amount) rejected
- [ ] L3.05 No scope creep — only engine + policy + metrics + tests
- [ ] L3.06 No ghost files or hallucinated API paths
- [ ] L3.07 All existing tests still pass (no regression)
