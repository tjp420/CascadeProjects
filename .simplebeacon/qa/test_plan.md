# Test Plan — Track 46 Zero-Knowledge Inter-Enclave MPC Handshakes

**Branch:** `feature/track46-mpc-handshakes`
**Date:** 2026-08-02
**Status:** Active

## Objective

Bridge cryptographic trust barriers during key generation across enclaves using zero-knowledge proofs. Enclaves prove they hold valid key shares without revealing the shares themselves, enabling secure distributed key generation without a trusted dealer.

## Change Set

| File | Change |
|------|--------|
| server/lib/hsm-adapter/zk-mpc-handshake.cjs | New — ZkMpcHandshake class (485 lines) |
| server/lib/hsm-adapter/hsm-metrics.cjs | Added 10 Track 46 counters |
| server/lib/hsm-adapter/__tests__/zk-mpc-handshake.test.cjs | New — 37 tests |
| .simplebeacon/qa/test_plan.md | Updated |
| .simplebeacon/qa/software_health_report.md | Updated |

## Protocol Phases

1. **INITIATE**: Coordinator proposes handshake with participant enclave IDs
2. **COMMIT**: Each participant commits to a random blinding factor (Pedersen-style)
3. **PROVE**: Each participant generates a ZK proof of knowledge of their share
4. **VERIFY**: Coordinator verifies all proofs without learning the shares
5. **FINALIZE**: Combined public key is derived; private shares remain hidden

## Check Items

### Level 1 - Deterministic
- [x] L1.1 node -c all modified JS files - PASS
- [x] L1.2 37 new Track 46 tests pass
- [x] L1.3 146 existing tests pass (no regression)
- [x] L1.4 No new dependencies

### Level 2 - Functional
- [x] L2.01 initiate (7 tests)
- [x] L2.02 commit (6 tests)
- [x] L2.03 prove (6 tests)
- [x] L2.04 verifyProofs (3 tests)
- [x] L2.05 finalize (3 tests)
- [x] L2.06 full 5-phase handshake flow (1 test)
- [x] L2.07 getHandshake (3 tests)
- [x] L2.08 getActiveHandshakes (1 test)
- [x] L2.09 getCompletedHandshakes (1 test)
- [x] L2.10 checkExpired (1 test)
- [x] L2.11 abort (1 test)
- [x] L2.12 getStats (1 test)
- [x] L2.13 reset (1 test)
- [x] L2.14 generateZkProof utility (2 tests)

### Level 3 - Security
- [x] L3.01 No secrets exposed
- [x] L3.02 No scope creep
- [x] L3.03 No regression
