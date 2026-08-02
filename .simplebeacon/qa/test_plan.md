# Test Plan — Track 56 Oblivious RAM and Secure Side-Channel Memory Attenuation

**Branch:** `feature/track56-oram`
**Date:** 2026-08-02
**Status:** Active

## Objective

Implement a Path ORAM scheme that hides data access patterns from observers who can monitor memory reads/writes (side-channel attackers). Every access touches a full path from root to leaf, making all accesses indistinguishable regardless of which logical block is being read or written.

## Change Set

| File | Change |
|------|--------|
| server/lib/hsm-adapter/oram-engine.cjs | New — OramEngine class (588 lines) |
| server/lib/hsm-adapter/hsm-metrics.cjs | Added 8 Track 56 counters |
| server/lib/hsm-adapter/__tests__/oram-engine.test.cjs | New — 31 tests |
| .simplebeacon/qa/test_plan.md | Updated |
| .simplebeacon/qa/software_health_report.md | Updated |

## Architecture

- **OramTree**: Binary tree storage with buckets of blocks
- **PositionMap**: Maps logical block IDs to leaf paths
- **StashManager**: Temporary block buffer for path eviction
- **PathOramEngine**: Orchestrates read/write access with oblivious paths
- **SideChannelAttenuator**: Constant-time operations to prevent timing leaks
- **AccessPatternObfuscator**: Dummy accesses and path reshuffling

## Check Items

### Level 1 - Deterministic
- [x] L1.1 node -c all modified JS files - PASS
- [x] L1.2 31 new Track 56 tests pass
- [x] L1.3 513 existing tests pass (no regression)
- [x] L1.4 No new dependencies

### Level 2 - Functional
- [x] L2.01 write (6 tests)
- [x] L2.02 read (6 tests)
- [x] L2.03 delete (3 tests)
- [x] L2.04 has (3 tests)
- [x] L2.05 getBlockInfo (2 tests)
- [x] L2.06 getBlockIds (1 test)
- [x] L2.07 getStashSize (1 test)
- [x] L2.08 getAccessLog (1 test)
- [x] L2.09 verifyAccessLogIntegrity (1 test)
- [x] L2.10 getStats (1 test)
- [x] L2.11 evictStash (2 tests)
- [x] L2.12 reset (1 test)
- [x] L2.13 oblivious access patterns (2 tests)
- [x] L2.14 full ORAM flow (1 test)

### Level 3 - Security
- [x] L3.01 No secrets exposed
- [x] L3.02 No scope creep
- [x] L3.03 No regression
