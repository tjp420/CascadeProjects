# Test Plan — Track 58 Multi-Key FHE Relinearization Engine

**Branch:** `feature/track58-multi-key-fhe`
**Date:** 2026-08-02
**Status:** Active

## Objective

Bridge isolated user key spaces over the mesh by supporting multi-key FHE operations. Each user has their own FHE key pair; ciphertexts encrypted under different keys can be combined homomorphically through relinearization keys that allow cross-key operations without revealing private keys.

## Change Set

| File | Change |
|------|--------|
| server/lib/hsm-adapter/multi-key-fhe-relinearization-engine.cjs | New — MultiKeyFheRelinearizationEngine class (815 lines) |
| server/lib/hsm-adapter/hsm-metrics.cjs | Added 9 Track 58 counters |
| server/lib/hsm-adapter/__tests__/multi-key-fhe-relinearization-engine.test.cjs | New — 47 tests |
| .simplebeacon/qa/test_plan.md | Updated |
| .simplebeacon/qa/software_health_report.md | Updated |

## Architecture

- **MultiKeyFheKeyGenerator**: Generates per-user FHE key pairs
- **RelinearizationKeyFactory**: Creates relinearization keys for cross-key ops
- **MultiKeyEncryptor**: Encrypts plaintexts under a specific user's key
- **MultiKeyEvaluator**: Performs homomorphic operations across keys
- **RelinearizationEngine**: Relinearizes ciphertexts after multiplication
- **NoiseBudgetTracker**: Tracks noise growth in ciphertexts
- **KeySwitchingEngine**: Switches ciphertexts between key spaces
- **BootstrappingManager**: Refreshes noise budget via bootstrapping

## Check Items

### Level 1 - Deterministic
- [x] L1.1 node -c all modified JS files - PASS
- [x] L1.2 47 new Track 58 tests pass
- [x] L1.3 588 existing tests pass (no regression)
- [x] L1.4 No new dependencies

### Level 2 - Functional
- [x] L2.01 generateKeyPair (4 tests)
- [x] L2.02 generateRelinearizationKey (6 tests)
- [x] L2.03 encrypt (4 tests)
- [x] L2.04 decrypt (2 tests)
- [x] L2.05 add (2 tests)
- [x] L2.06 sub (1 test)
- [x] L2.07 mul (4 tests)
- [x] L2.08 scalarMul (2 tests)
- [x] L2.09 scalarAdd (2 tests)
- [x] L2.10 switchKey (4 tests)
- [x] L2.11 bootstrap (3 tests)
- [x] L2.12 revokeKey (2 tests)
- [x] L2.13 getKeyPair (2 tests)
- [x] L2.14 getKeyPairs (1 test)
- [x] L2.15 getCiphertext (2 tests)
- [x] L2.16 getRelinearizationKey (2 tests)
- [x] L2.17 getEvalHistory (1 test)
- [x] L2.18 getStats (1 test)
- [x] L2.19 reset (1 test)
- [x] L2.20 full multi-key FHE flow (1 test)

### Level 3 - Security
- [x] L3.01 No secrets exposed
- [x] L3.02 No scope creep
- [x] L3.03 No regression
