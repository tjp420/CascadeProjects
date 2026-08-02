# Test Plan — Track 45 Enclave Key Rotation and Cryptographic Heartbeats

**Branch:** `feature/track45-key-rotation-heartbeats`
**Date:** 2026-08-02
**Status:** Active

## Objective

Implement rolling key schedules across the sharded enclave layout with epoch-based key advancement and cryptographic heartbeat protocol for enclave liveness verification.

## Change Set

| File | Change |
|------|--------|
| server/lib/hsm-adapter/enclave-key-rotation-heartbeat.cjs | New — EnclaveKeyRotationEngine class (506 lines) |
| server/lib/hsm-adapter/hsm-metrics.cjs | Added 13 Track 45 counters |
| server/lib/hsm-adapter/__tests__/enclave-key-rotation-heartbeat.test.cjs | New — 40 tests |
| .simplebeacon/qa/test_plan.md | Updated |
| .simplebeacon/qa/software_health_report.md | Updated |

## Architecture

- **KeyEpochManager**: Tracks key epochs per enclave with rotation intervals
- **CryptographicHeartbeat**: Challenge-response liveness checks with HMAC-SHA256
- **KeyQuarantine**: Isolates keys from enclaves that miss heartbeats (3 misses = quarantine)
- **RotationScheduler**: Automatic epoch advancement based on key age
- **KeyRevocation**: Permanently revoke quarantined keys with zeroization
- **EnclaveRecovery**: Recover quarantined enclaves via forced key rotation

## Check Items

### Level 1 - Deterministic
- [x] L1.1 node -c all modified JS files - PASS
- [x] L1.2 40 new Track 45 tests pass
- [x] L1.3 115 existing tests pass (no regression)
- [x] L1.4 No new dependencies

### Level 2 - Functional
- [x] L2.01 registerEnclave (4 tests)
- [x] L2.02 unregisterEnclave (3 tests)
- [x] L2.03 heartbeat challenge-response (7 tests)
- [x] L2.04 heartbeat timeout and quarantine (3 tests)
- [x] L2.05 rotateKey (5 tests)
- [x] L2.06 checkAndRotate (3 tests)
- [x] L2.07 revokeKey (3 tests)
- [x] L2.08 recoverEnclave (2 tests)
- [x] L2.09 getKeyState/getHeartbeatState (4 tests)
- [x] L2.10 getEnclaves (1 test)
- [x] L2.11 getPendingChallenges (1 test)
- [x] L2.12 getStats (1 test)
- [x] L2.13 reset (1 test)
- [x] L2.14 maxEpochs (1 test)
- [x] L2.15 zeroization of old key material (1 test)

### Level 3 - Security
- [x] L3.01 No secrets exposed
- [x] L3.02 No scope creep
- [x] L3.03 No regression
