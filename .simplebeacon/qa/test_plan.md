# Test Plan — Track 54 Multi-Party Threshold Cryptography and Distributed Decryption Circuits

**Branch:** `feature/track54-threshold-crypto`
**Date:** 2026-08-02
**Status:** Active

## Objective

Enable fault-tolerant shared secret assembly for decrypting ciphertexts across a cluster of enclaves. Each enclave holds a partial decryption key share; t-of-n shares are required to reconstruct the plaintext without any single enclave ever holding the full key. Uses Shamir secret sharing over a 257-bit prime field with BigInt arithmetic for exact reconstruction.

## Change Set

| File | Change |
|------|--------|
| server/lib/hsm-adapter/threshold-decryption-circuit.cjs | New — ThresholdDecryptionCircuit class (694 lines) |
| server/lib/hsm-adapter/hsm-metrics.cjs | Added 9 Track 54 counters |
| server/lib/hsm-adapter/__tests__/threshold-decryption-circuit.test.cjs | New — 45 tests |
| .simplebeacon/qa/test_plan.md | Updated |
| .simplebeacon/qa/software_health_report.md | Updated |

## Architecture

- **ThresholdKeySet**: Manages distributed key shares (t-of-n Shamir over GF(2^257-93))
- **PartialDecryptionEngine**: Each node computes partial decryption from its share
- **DecryptionShareVerifier**: Verifies partial decryption shares
- **DecryptionAssembler**: Combines valid shares via Lagrange interpolation (BigInt)
- **DecryptionCircuit**: Orchestrates the full distributed decryption flow
- **FaultToleranceManager**: Handles key set compromise, rotation, and destruction

## Check Items

### Level 1 - Deterministic
- [x] L1.1 node -c all modified JS files - PASS
- [x] L1.2 45 new Track 54 tests pass
- [x] L1.3 416 existing tests pass (no regression)
- [x] L1.4 No new dependencies

### Level 2 - Functional
- [x] L2.01 createKeySet (9 tests)
- [x] L2.02 encrypt (4 tests)
- [x] L2.03 initiateCircuit (6 tests)
- [x] L2.04 submitPartialDecryption (6 tests)
- [x] L2.05 assembleDecryption (3 tests)
- [x] L2.06 compromiseKeySet (2 tests)
- [x] L2.07 rotateKeySet (2 tests)
- [x] L2.08 destroyKeySet (2 tests)
- [x] L2.09 getKeySet (2 tests)
- [x] L2.10 getKeySets (1 test)
- [x] L2.11 getShare (2 tests)
- [x] L2.12 getCircuit (2 tests)
- [x] L2.13 getCompletedCircuits (1 test)
- [x] L2.14 getStats (1 test)
- [x] L2.15 reset (1 test)
- [x] L2.16 full distributed decryption flow (1 test)

### Level 3 - Security
- [x] L3.01 No secrets exposed
- [x] L3.02 No scope creep
- [x] L3.03 No regression
