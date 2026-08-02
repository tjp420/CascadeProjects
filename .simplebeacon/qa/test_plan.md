# Test Plan — Track 57 zk-SNARK Enclave Verifiers

**Branch:** `feature/track57-zk-snark-verifiers`
**Date:** 2026-08-02
**Status:** Active

## Objective

Compile succinct execution proofs for enclave computations, allowing verifiers to confirm that a computation was executed correctly without seeing the private inputs or re-executing the computation.

## Change Set

| File | Change |
|------|--------|
| server/lib/hsm-adapter/zk-snark-verifier-engine.cjs | New — ZkSnarkVerifierEngine class (792 lines) |
| server/lib/hsm-adapter/hsm-metrics.cjs | Added 9 Track 57 counters |
| server/lib/hsm-adapter/__tests__/zk-snark-verifier-engine.test.cjs | New — 44 tests |
| .simplebeacon/qa/test_plan.md | Updated |
| .simplebeacon/qa/software_health_report.md | Updated |

## Architecture

- **ArithmeticCircuitCompiler**: Compiles computation traces into R1CS circuits
- **WitnessGenerator**: Generates private and public witness vectors
- **TrustedSetupManager**: Manages proving and verification keys from SRS
- **ProofGenerator**: Generates succinct zero-knowledge proofs
- **ProofVerifier**: Verifies proofs in constant time
- **ProofAggregator**: Aggregates multiple proofs into a single proof
- **EnclaveAttestationBinder**: Binds proofs to enclave attestations

## Check Items

### Level 1 - Deterministic
- [x] L1.1 node -c all modified JS files - PASS
- [x] L1.2 44 new Track 57 tests pass
- [x] L1.3 544 existing tests pass (no regression)
- [x] L1.4 No new dependencies

### Level 2 - Functional
- [x] L2.01 compileCircuit (7 tests)
- [x] L2.02 generateTrustedSetup (3 tests)
- [x] L2.03 generateProof (10 tests)
- [x] L2.04 verifyProof (3 tests)
- [x] L2.05 aggregateProofs (4 tests)
- [x] L2.06 verifyAggregatedProof (2 tests)
- [x] L2.07 destroySetup (2 tests)
- [x] L2.08 getCircuit (2 tests)
- [x] L2.09 getCircuits (1 test)
- [x] L2.10 getProof (2 tests)
- [x] L2.11 getSetup (2 tests)
- [x] L2.12 getCompletedProofs (1 test)
- [x] L2.13 getAggregatedProof (2 tests)
- [x] L2.14 getStats (1 test)
- [x] L2.15 reset (1 test)
- [x] L2.16 full zk-SNARK flow (1 test)

### Level 3 - Security
- [x] L3.01 No secrets exposed
- [x] L3.02 No scope creep
- [x] L3.03 No regression
