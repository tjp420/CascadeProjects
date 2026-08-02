# Test Plan — Track 52 Secure Multi-Party Inner Product and Encrypted Search Indexes

**Branch:** `feature/track52-encrypted-search-index`
**Date:** 2026-08-02
**Status:** Active

## Objective

Build blind search indexes over encrypted keyword vectors and evaluate secure inner-product queries across multiple enclave parties without revealing the query terms or the indexed documents. Each party holds a shard of the index; the inner product is computed via secret sharing so no single party sees the full result.

## Change Set

| File | Change |
|------|--------|
| server/lib/hsm-adapter/secure-inner-product-search.cjs | New — SecureInnerProductSearch class (523 lines) |
| server/lib/hsm-adapter/hsm-metrics.cjs | Added 9 Track 52 counters |
| server/lib/hsm-adapter/__tests__/secure-inner-product-search.test.cjs | New — 36 tests |
| .simplebeacon/qa/test_plan.md | Updated |
| .simplebeacon/qa/software_health_report.md | Updated |

## Architecture

- **BlindIndexBuilder**: Creates encrypted keyword indexes with deterministic blinding
- **InnerProductEngine**: Computes secure inner products across distributed parties
- **SecretShareSplitter**: Splits query vectors into additive shares for query privacy
- **MultiPartyAggregator**: Aggregates per-party inner product results with ranking
- **IndexShardManager**: Manages index shards distributed across enclave parties (round-robin)

## Check Items

### Level 1 - Deterministic
- [x] L1.1 node -c all modified JS files - PASS
- [x] L1.2 36 new Track 52 tests pass
- [x] L1.3 331 existing tests pass (no regression)
- [x] L1.4 No new dependencies

### Level 2 - Functional
- [x] L2.01 registerParty (5 tests)
- [x] L2.02 unregisterParty (2 tests)
- [x] L2.03 buildIndex (7 tests)
- [x] L2.04 search (9 tests)
- [x] L2.05 freezeIndex (2 tests)
- [x] L2.06 deprecateIndex (2 tests)
- [x] L2.07 deleteIndex (2 tests)
- [x] L2.08 getIndex (2 tests)
- [x] L2.09 getIndexes (1 test)
- [x] L2.10 getParties (1 test)
- [x] L2.11 getCompletedQueries (1 test)
- [x] L2.12 getStats (1 test)
- [x] L2.13 reset (1 test)
- [x] L2.14 full search flow (1 test)

### Level 3 - Security
- [x] L3.01 No secrets exposed
- [x] L3.02 No scope creep
- [x] L3.03 No regression
