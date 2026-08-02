# Test Plan — Track 50 Confidential Federated Learning and ZK Model Aggregation

**Branch:** `feature/track50-federated-learning`
**Date:** 2026-08-02
**Status:** Active

## Objective

Enable privacy-preserving ML model training across multiple enclaves without exposing individual training data. Each enclave trains locally and submits encrypted gradient updates; the aggregator combines them using secure multi-party computation with ZK proofs of correctness.

## Change Set

| File | Change |
|------|--------|
| server/lib/hsm-adapter/confidential-federated-learning.cjs | New — ConfidentialFederatedLearning class (557 lines) |
| server/lib/hsm-adapter/hsm-metrics.cjs | Added 10 Track 50 counters |
| server/lib/hsm-adapter/__tests__/confidential-federated-learning.test.cjs | New — 35 tests |
| .simplebeacon/qa/test_plan.md | Updated |
| .simplebeacon/qa/software_health_report.md | Updated |

## Architecture

- **RoundCoordinator**: Manages training rounds (initiate -> submit -> verify -> aggregate)
- **GradientSubmitter**: Accepts encrypted gradient updates with ZK proofs
- **ZkProofVerifier**: Verifies ZK proofs without decrypting gradients
- **FedAvgAggregator**: Weighted averaging with gradient clipping and Gaussian noise (DP)
- **DifferentialPrivacy**: Gradient clipping + Gaussian noise for privacy guarantees
- **GlobalModelTracker**: Tracks global model version and weights across rounds

## Protocol

1. INITIATE: Coordinator starts a training round with participant enclaves
2. SUBMIT: Each enclave submits encrypted gradient + ZK proof
3. VERIFY: Aggregator verifies all ZK proofs without decrypting
4. AGGREGATE: FedAvg with DP noise combines verified gradients
5. DISTRIBUTE: Updated global model is available for next round

## Check Items

### Level 1 - Deterministic
- [x] L1.1 node -c all modified JS files - PASS
- [x] L1.2 35 new Track 50 tests pass
- [x] L1.3 243 existing tests pass (no regression)
- [x] L1.4 No new dependencies

### Level 2 - Functional
- [x] L2.01 initiateRound (6 tests)
- [x] L2.02 submitGradient (10 tests)
- [x] L2.03 verifyGradients (4 tests)
- [x] L2.04 aggregateGradients (3 tests)
- [x] L2.05 full training round (1 test)
- [x] L2.06 getRound (3 tests)
- [x] L2.07 getActiveRounds (1 test)
- [x] L2.08 getCompletedRounds (1 test)
- [x] L2.09 checkExpiredRounds (1 test)
- [x] L2.10 getStats (1 test)
- [x] L2.11 getGlobalModel (2 tests)
- [x] L2.12 reset (1 test)
- [x] L2.13 no ZK proof mode (1 test)

### Level 3 - Security
- [x] L3.01 No secrets exposed
- [x] L3.02 No scope creep
- [x] L3.03 No regression
