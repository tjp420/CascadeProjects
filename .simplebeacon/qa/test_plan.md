# Test Plan — Track 60 Multi-Asset Sharded Mixnets and Blind Confidential Transactions

**Branch:** `feature/track60-mixnet-blind-tx`
**Date:** 2026-08-02
**Status:** Active

## Objective

Incorporate untraceable onion-routing across multi-enclave nodes with blind transaction support. Transactions are sharded across multiple mixnet layers, each layer peeling one encryption skin, making it computationally infeasible to link sender to recipient.

## Change Set

| File | Change |
|------|--------|
| server/lib/hsm-adapter/mixnet-blind-transaction-engine.cjs | New — MixnetBlindTransactionEngine class (802 lines) |
| server/lib/hsm-adapter/hsm-metrics.cjs | Added 9 Track 60 counters |
| server/lib/hsm-adapter/__tests__/mixnet-blind-transaction-engine.test.cjs | New — 58 tests |
| .simplebeacon/qa/test_plan.md | Updated |
| .simplebeacon/qa/software_health_report.md | Updated |

## Architecture

- **MixnetNodeManager**: Manages mix nodes across shards
- **OnionRoutingEngine**: Creates layered encryption paths
- **BlindTransactionFactory**: Creates blind confidential transactions
- **MixnetShardCoordinator**: Shards transactions across mix pools
- **TransactionPool**: Aggregates and shuffles transactions
- **MixnetVerifier**: Verifies mixnet integrity and unlinkability
- **AssetPrivacyEngine**: Per-asset privacy policies
- **RelayPathOptimizer**: Optimizes relay paths for latency/privacy

## Check Items

### Level 1 - Deterministic
- [x] L1.1 node -c all modified JS files - PASS
- [x] L1.2 58 new Track 60 tests pass
- [x] L1.3 683 existing tests pass (no regression)
- [x] L1.4 No new dependencies

### Level 2 - Functional
- [x] L2.01 registerNode (6 tests)
- [x] L2.02 createTransaction (10 tests)
- [x] L2.03 createOnionPath (5 tests)
- [x] L2.04 mixTransaction (4 tests)
- [x] L2.05 confirmTransaction (3 tests)
- [x] L2.06 createPool (3 tests)
- [x] L2.07 addToPool (4 tests)
- [x] L2.08 shufflePool (3 tests)
- [x] L2.09 flushPool (3 tests)
- [x] L2.10 banNode (2 tests)
- [x] L2.11 getNode (2 tests)
- [x] L2.12 getNodes (1 test)
- [x] L2.13 getTransaction (2 tests)
- [x] L2.14 getPool (2 tests)
- [x] L2.15 getShard (2 tests)
- [x] L2.16 getShards (1 test)
- [x] L2.17 getCompletedTransactions (1 test)
- [x] L2.18 getStats (1 test)
- [x] L2.19 reset (1 test)
- [x] L2.20 full mixnet flow (2 tests)

### Level 3 - Security
- [x] L3.01 No secrets exposed
- [x] L3.02 No scope creep
- [x] L3.03 No regression
