# Test Plan — Track 47 Post-Quantum Cryptographic Enclave Migrations

**Branch:** `feature/track47-pqc-enclave-migrations`
**Date:** 2026-08-02
**Status:** Active

## Objective

Manage migration of enclaves from classical cryptographic algorithms to post-quantum cryptography (PQC) with lattice-based signature constraints. Support hybrid mode (classical + PQC) during transition period and enforce policy-gated algorithm upgrades.

## Change Set

| File | Change |
|------|--------|
| server/lib/hsm-adapter/pqc-enclave-migration.cjs | New — PqcEnclaveMigrationEngine class (532 lines) |
| server/lib/hsm-adapter/hsm-metrics.cjs | Added 12 Track 47 counters |
| server/lib/hsm-adapter/__tests__/pqc-enclave-migration.test.cjs | New — 46 tests |
| .simplebeacon/qa/test_plan.md | Updated |
| .simplebeacon/qa/software_health_report.md | Updated |

## Architecture

- **PqcMigrationPlanner**: Tracks migration state per enclave (pending -> planned -> hybrid-active -> pqc-active -> completed)
- **LatticeSignatureConstraint**: Enforces ML-DSA / lattice-based signature requirements per enclave
- **HybridTransitionManager**: Manages dual-algorithm transition period with configurable duration
- **AlgorithmPolicyGate**: Validates that migrations meet security policy (supported algorithms, attestation)
- **RollbackSupport**: Allows rollback with max attempt tracking and failure state

## Check Items

### Level 1 - Deterministic
- [x] L1.1 node -c all modified JS files - PASS
- [x] L1.2 46 new Track 47 tests pass
- [x] L1.3 144 existing tests pass (no regression)
- [x] L1.4 No new dependencies

### Level 2 - Functional
- [x] L2.01 registerEnclave (7 tests)
- [x] L2.02 planMigration (3 tests)
- [x] L2.03 activateHybrid (5 tests)
- [x] L2.04 activatePqc (4 tests)
- [x] L2.05 completeMigration (2 tests)
- [x] L2.06 rollback (4 tests)
- [x] L2.07 satisfySignatureConstraint (6 tests)
- [x] L2.08 violateSignatureConstraint (2 tests)
- [x] L2.09 getMigrationState (2 tests)
- [x] L2.10 getSignatureConstraint (2 tests)
- [x] L2.11 getAllEnclaves (1 test)
- [x] L2.12 getMigrationLog (1 test)
- [x] L2.13 getStats (1 test)
- [x] L2.14 unregisterEnclave (2 tests)
- [x] L2.15 reset (1 test)
- [x] L2.16 no-hybrid-transition mode (2 tests)
- [x] L2.17 full migration flow (1 test)

### Level 3 - Security
- [x] L3.01 No secrets exposed
- [x] L3.02 No scope creep
- [x] L3.03 No regression
