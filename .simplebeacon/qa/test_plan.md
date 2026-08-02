# Test Plan — Track 43 Multiparty Auditing and Remote Attestation Logs

**Branch:** `feature/track43-multiparty-audit-logs`
**Date:** 2026-08-02
**Status:** Active

## Objective

Implement an append-only, cryptographically chained audit log of attestation events with multiparty verifier signatures. Each entry is hash-chained to the previous entry (tamper-evident), and a configurable set of verifiers must sign each entry before it is considered committed.

## Change Set

| File | Change |
|------|--------|
| server/lib/hsm-adapter/multiparty-audit-log.cjs | New — MultipartyAuditLog class (330 lines) |
| server/lib/hsm-adapter/hsm-metrics.cjs | Added 11 Track 43 counters |
| server/lib/hsm-adapter/__tests__/multiparty-audit-log.test.cjs | New — 30 tests |
| .simplebeacon/qa/test_plan.md | Updated |
| .simplebeacon/qa/software_health_report.md | Updated |

## Architecture

- **Append-only log**: Entries are hash-chained (SHA-256) to the previous entry
- **Multiparty verification**: Configurable min/max verifiers must sign each entry
- **Pending state**: Entries enter pending state until min verifier signatures are collected
- **Replay protection**: Duplicate verifier signatures are rejected
- **Timeout**: Pending entries expire after configurable window
- **Tamper-evident**: verifyChain() detects any modification to committed entries
- **Pruning**: Oldest entries pruned when maxEntries limit is reached

## Check Items

### Level 1 - Deterministic
- [x] L1.1 node -c all modified JS files - PASS
- [x] L1.2 30 new Track 43 tests pass
- [x] L1.3 80 existing tests pass (no regression)
- [x] L1.4 No new dependencies

### Level 2 - Functional
- [x] L2.01 registerVerifier/unregisterVerifier (5 tests)
- [x] L2.02 append valid/disallowed events (5 tests)
- [x] L2.03 signEntry and commit flow (4 tests)
- [x] L2.04 verification timeout (1 test)
- [x] L2.05 queryEntries with filters (4 tests)
- [x] L2.06 getEntry by ID (2 tests)
- [x] L2.07 verifyChain clean and tampered (2 tests)
- [x] L2.08 exportLog (1 test)
- [x] L2.09 getStats (1 test)
- [x] L2.10 getPendingEntries (1 test)
- [x] L2.11 reset (1 test)
- [x] L2.12 hash chaining (1 test)
- [x] L2.13 pruning (1 test)
- [x] L2.14 custom event types (1 test)
- [x] L2.15 duplicate signature rejection (1 test)

### Level 3 - Security
- [x] L3.01 No secrets exposed
- [x] L3.02 No scope creep
- [x] L3.03 No regression
