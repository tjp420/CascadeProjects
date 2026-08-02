# Test Plan — Track 34 Phase 4: Signature Replay Protection

**Branch:** `feature/track34-phase4-replay-protection`
**Date:** 2026-08-02
**Status:** Retroactive (hotfix per QA framework — code already implemented, documenting then re-validating)

## Objective

Inject monotonic nonces and timestamps into Ed25519-signed RPC frames to prevent replay attacks. Inbound frames with expired timestamps or non-monotonic nonces are rejected.

## Change Set

| File | Change |
|------|--------|
| `server/lib/hsm-adapter/cluster-consensus-engine.cjs` | Added nonce/timestamp injection in `signRpcFrame()`, replay validation in `verifyRpcFrame()`, `_lastSeenNonce` Map, `_localNonce` counter, `replayWindowMs`/`enableReplayProtection` options |
| `server/lib/hsm-adapter/crypto-policy-engine.cjs` | Added `enableReplayProtection`, `replayWindowMs` to consensus policy + `_validateConsensus()` |
| `server/lib/hsm-adapter/hsm-metrics.cjs` | 3 new counters: `replay_detected_total`, `nonce_stale_total`, `timestamp_expired_total` |
| `server/lib/hsm-adapter/__tests__/cluster-consensus-replay.test.cjs` | 24 new tests |
| `server/lib/hsm-adapter/__tests__/cluster-consensus-byzantine.test.cjs` | Updated `signRpcFrame` test for new return type |

## Check Items

### Level 1 — Deterministic (required)

- [x] **L1.1** `node -c cluster-consensus-engine.cjs` — syntax pass
- [x] **L1.2** `node -c crypto-policy-engine.cjs` — syntax pass
- [x] **L1.3** `node -c hsm-metrics.cjs` — syntax pass
- [x] **L1.4** `node -c cluster-consensus-replay.test.cjs` — syntax pass
- [x] **L1.5** `npm test` (ai-platform) — 237 suites pass, 2571 tests pass
- [x] **L1.6** No new dependencies added
- [x] **L1.7** No secrets/keys committed (test key pairs generated at runtime)

### Level 2 — Behavioral

- [x] **L2.1** `signRpcFrame()` injects monotonic nonce (incrementing) and timestamp
- [x] **L2.2** `verifyRpcFrame()` rejects expired timestamp (age > replayWindowMs)
- [x] **L2.3** `verifyRpcFrame()` rejects future timestamp (beyond tolerance)
- [x] **L2.4** `verifyRpcFrame()` accepts fresh timestamp within window
- [x] **L2.5** `verifyRpcFrame()` rejects replayed nonce (same nonce)
- [x] **L2.6** `verifyRpcFrame()` rejects lower nonce (going backwards)
- [x] **L2.7** `verifyRpcFrame()` accepts increasing nonce sequence
- [x] **L2.8** Nonce tracking is per-sender (different senders independent)
- [x] **L2.9** Replay protection can be disabled via `enableReplayProtection: false`
- [x] **L2.10** Frames without nonce/timestamp pass (backward compat with Stage 3)
- [x] **L2.11** `requestVote` rejects replayed frame
- [x] **L2.12** `appendEntries` rejects replayed frame
- [x] **L2.13** `TIMESTAMP_EXPIRED` audit event emitted
- [x] **L2.14** `NONCE_STALE` audit event emitted

### Level 3 — Self-review / drift

- [x] **L3.1** No scope creep — only replay protection added
- [x] **L3.2** No ghost files — all referenced files exist
- [x] **L3.3** Existing 65 Track 34 tests still pass (no regression)
- [x] **L3.4** Policy validation covers `enableReplayProtection`, `replayWindowMs` (upper/lower bounds)
- [x] **L3.5** Prometheus metrics increment correctly for replay/stale/expired events
- [x] **L3.6** Tenant override for `replayWindowMs` works correctly

## Pre-existing Failures (not caused by this change)

| Suite | Cause |
|-------|-------|
| `hsm-vault-throttle.test.cjs` | Pre-existing |
| `hub-smoke.test.js` | Pre-existing server health |
| `dashboard-auth.test.cjs` | Pre-existing audit init TypeError |
