# Test Plan — Track 26: DKG & zk-SNARKs (Joint-Feldman VSS)

**Branch:** `feature/track26-dkg-zk-snarks`
**Date:** 2026-08-02
**Status:** Active

## Objective

Implement Joint-Feldman Verifiable Secret Sharing (VSS) with zero-knowledge validation parameters, removing single-operator points of failure during distributed key generation. This is the foundational track that unblocks Tracks 27, 32, 34, 35, and 37.

## Change Set

| File | Change |
|------|--------|
| `server/lib/hsm-adapter/dkg-snark-engine.cjs` | New — Joint-Feldman VSS engine with zk-SNARK validation parameters |
| `server/lib/hsm-adapter/crypto-policy-engine.cjs` | Add `dkg` policy block to DEFAULT_POLICY + merge function |
| `server/lib/hsm-adapter/hsm-metrics.cjs` | Add DKG counters and metadata |
| `server/lib/hsm-adapter/__tests__/dkg-snark.test.cjs` | New — targeted test suite |

## Check Items

### Level 1 — Deterministic (required)

- [ ] **L1.1** `node -c dkg-snark-engine.cjs` — syntax pass
- [ ] **L1.2** `node -c crypto-policy-engine.cjs` — syntax pass
- [ ] **L1.3** `node -c hsm-metrics.cjs` — syntax pass
- [ ] **L1.4** `node -c dkg-snark.test.cjs` — syntax pass
- [ ] **L1.5** `npm test` (ai-platform) — all tests pass, no new failures
- [ ] **L1.6** No new dependencies added
- [ ] **L1.7** No secrets/keys committed

### Level 2 — Functional Operations

- [ ] **L2.01** Full happy-path DKG round-trip: N=3, t=2. Nodes generate polynomials, distribute shares, verify commitments, reconstruct unified master public key (Y = prod g^a_{i,0})
- [ ] **L2.02** Complaint management: A node distributes an invalid private share. Recipient detects failure, registers complaint, rogue node is disqualified
- [ ] **L2.03** Quorum starvation: Key reconstruction with fewer than t valid shares throws DKG_QUORUM_STARVATION
- [ ] **L2.04** N=5, t=3 larger quorum round-trip
- [ ] **L2.05** Share verification: g^{s_{i,k}} == prod_{j=0}^{t-1} (C_{i,j})^{k^j} mod p
- [ ] **L2.06** Master public key derivation: Y = prod_{i} g^{a_{i,0}} mod p
- [ ] **L2.07** Lagrange interpolation reconstructs group secret from t shares
- [ ] **L2.08** Policy validation: dkg.minQuorumThreshold enforced
- [ ] **L2.09** Policy validation: dkg.maxNodes enforced

### Level 3 — Security Engineering

- [ ] **L3.01** Zero-knowledge proof forgery detection: Manipulating zk-SNARK evaluation parameters triggers DKG_ZK_PROOF_INVALID
- [ ] **L3.02** Memory sanitization: Ephemeral polynomial coefficients (a_{i,j}) are zeroized after share distribution
- [ ] **L3.03** No scope creep — only DKG engine + policy + metrics + tests
- [ ] **L3.04** No ghost files or hallucinated API paths
- [ ] **L3.05** All existing tests still pass (no regression)
