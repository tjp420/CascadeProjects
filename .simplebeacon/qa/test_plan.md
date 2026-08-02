# Test Plan — Track 55 ZK Verifiable Secret Sharing and Proactive Secret Sharing

**Branch:** `feature/track55-vss-pss`
**Date:** 2026-08-02
**Status:** Active

## Objective

Extends Shamir secret sharing with zero-knowledge share verification (Feldman-style commitments) and epoch-based proactive share refresh (PSS) to defend against adaptive adversaries who gradually compromise nodes over time. Shares are reshuffled every epoch so that t shares from different epochs cannot reconstruct the secret.

## Change Set

| File | Change |
|------|--------|
| server/lib/hsm-adapter/vss-pss-engine.cjs | New — VssPssEngine class (786 lines) |
| server/lib/hsm-adapter/hsm-metrics.cjs | Added 10 Track 55 counters |
| server/lib/hsm-adapter/__tests__/vss-pss-engine.test.cjs | New — 52 tests |
| .simplebeacon/qa/test_plan.md | Updated |
| .simplebeacon/qa/software_health_report.md | Updated |

## Architecture

- **VssDealer**: Splits a secret into verifiable shares with public commitments
- **VssVerifier**: Verifies share validity against commitments (ZK)
- **PssRefreshEngine**: Performs epoch-based share reshuffling
- **EpochManager**: Tracks epochs and enforces share expiration
- **ComplaintProcessor**: Handles verification disputes
- **ShareRecoveryEngine**: Recovers shares for compromised nodes

## Check Items

### Level 1 - Deterministic
- [x] L1.1 node -c all modified JS files - PASS
- [x] L1.2 52 new Track 55 tests pass
- [x] L1.3 461 existing tests pass (no regression)
- [x] L1.4 No new dependencies

### Level 2 - Functional
- [x] L2.01 startEpoch (4 tests)
- [x] L2.02 expireEpoch (3 tests)
- [x] L2.03 dealSecret (10 tests)
- [x] L2.04 verifyShare (4 tests)
- [x] L2.05 fileComplaint (4 tests)
- [x] L2.06 disqualifyNode (3 tests)
- [x] L2.07 reconstructSecret (5 tests)
- [x] L2.08 refreshShares (4 tests)
- [x] L2.09 recoverShare (4 tests)
- [x] L2.10 getSession (2 tests)
- [x] L2.11 getShareInfo (2 tests)
- [x] L2.12 getEpoch (2 tests)
- [x] L2.13 getEpochs (1 test)
- [x] L2.14 getCompletedSessions (1 test)
- [x] L2.15 getStats (1 test)
- [x] L2.16 reset (1 test)
- [x] L2.17 full VSS + PSS flow (1 test)

### Level 3 - Security
- [x] L3.01 No secrets exposed
- [x] L3.02 No scope creep
- [x] L3.03 No regression
