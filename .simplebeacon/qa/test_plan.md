# Test Plan — Track 61 Recursive Proof Aggregation Engine

**Branch:** `feature/track61-recursive-zk-vdf`
**Date:** 2026-08-02
**Status:** Active

## Objective

Compress multi-hop mixnet states and VDF proofs using recursive SNARK composition. A "proof of proofs" that folds multiple proofs into a single succinct proof, enabling O(log N) verification of arbitrarily long computation chains.

## Change Set

| File | Change |
|------|--------|
| server/lib/hsm-adapter/recursive-proof-aggregation-engine.cjs | New — RecursiveProofAggregationEngine class (604 lines) |
| server/lib/hsm-adapter/hsm-metrics.cjs | Added 8 Track 61 counters |
| server/lib/hsm-adapter/__tests__/recursive-proof-aggregation-engine.test.cjs | New — 41 tests |
| .simplebeacon/qa/test_plan.md | Updated |
| .simplebeacon/qa/software_health_report.md | Updated |

## Architecture

- **RecursiveProofFolder**: Folds two proofs into one via recursion
- **ProofChainBuilder**: Builds chains of recursively composed proofs
- **VdfRecursiveAggregator**: Aggregates VDF proofs recursively
- **MixnetStateCompressor**: Compresses multi-hop mixnet states
- **SuccinctVerifier**: Verifies recursive proofs in constant time
- **ProofTreeBuilder**: Builds tree-structured proof aggregation
- **RecursiveCircuitCompiler**: Compiles recursion circuits
- **AggregationScheduler**: Schedules batch aggregation rounds

## Check Items

### Level 1 - Deterministic
- [x] L1.1 node -c all modified JS files - PASS
- [x] L1.2 41 new Track 61 tests pass
- [x] L1.3 741 existing tests pass (no regression)
- [x] L1.4 No new dependencies

### Level 2 - Functional
- [x] L2.01 submitProof (7 tests)
- [x] L2.02 foldProofs (5 tests)
- [x] L2.03 aggregateChain (4 tests)
- [x] L2.04 aggregateTree (4 tests)
- [x] L2.05 aggregateVdfProofs (3 tests)
- [x] L2.06 compressMixnetState (3 tests)
- [x] L2.07 verifyAggregation (4 tests)
- [x] L2.08 getProof (2 tests)
- [x] L2.09 getAggregation (2 tests)
- [x] L2.10 getAggregations (1 test)
- [x] L2.11 getCompletedAggregations (1 test)
- [x] L2.12 getStats (1 test)
- [x] L2.13 reset (1 test)
- [x] L2.14 full recursive aggregation flow (3 tests)

### Level 3 - Security
- [x] L3.01 No secrets exposed
- [x] L3.02 No scope creep
- [x] L3.03 No regression
