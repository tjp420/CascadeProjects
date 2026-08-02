# Test Plan — Track 34 Phase 7: Implicit Outbound Transport Signing

**Branch:** `feature/track34-phase7-implicit-signing`
**Date:** 2026-08-02
**Status:** Retroactive (hotfix per QA framework)

## Objective

Eliminate the risk of developers accidentally emitting unsigned RPC frames by auto-binding Ed25519 signatures directly into the outbound transport loops. The engine now intercepts all outbound payloads from `startElection()`, `sendHeartbeats()`, and `appendAndReplicate()`, routing them through `signRpcFrame()` automatically before firing the transport callbacks.

## Change Set

| File | Change |
|------|--------|
| `server/lib/hsm-adapter/cluster-consensus-engine.cjs` | Added `_signOutboundFrame()` helper. Updated `startElection`, `sendHeartbeats`, `appendAndReplicate` to auto-sign outbound payloads. New constructor option `autoSignOutbound` (default true). New events `OUTBOUND_SIGNED`, `OUTBOUND_SIGN_FAILED`. Deep-copy payload before signing to prevent post-signing mutations. |
| `server/lib/hsm-adapter/hsm-metrics.cjs` | 2 new counters: `outbound_signed_total`, `outbound_sign_failed_total` |
| `server/lib/hsm-adapter/__tests__/cluster-consensus-implicit.test.cjs` | 18 new tests |

## Check Items

### Level 1 — Deterministic (required)

- [x] **L1.1** `node -c cluster-consensus-engine.cjs` — syntax pass
- [x] **L1.2** `node -c hsm-metrics.cjs` — syntax pass
- [x] **L1.3** `node -c cluster-consensus-implicit.test.cjs` — syntax pass
- [x] **L1.4** `npm test` (ai-platform) — 245 suites pass, 2672 tests pass
- [x] **L1.5** No new dependencies added
- [x] **L1.6** No secrets/keys committed

### Level 2 — Behavioral

- [x] **L2.1** requestVote callback receives signed envelope with signature/nonce/timestamp
- [x] **L2.2** requestVote callback receives unsigned payload when no signing key configured
- [x] **L2.3** requestVote callback receives unsigned payload when autoSignOutbound is false
- [x] **L2.4** OUTBOUND_SIGNED audit event emitted during election
- [x] **L2.5** sendHeartbeat callback receives signed envelope
- [x] **L2.6** sendHeartbeat callback receives unsigned payload when no signing key
- [x] **L2.7** heartbeat envelopes have incrementing nonces
- [x] **L2.8** replicateLog callback receives signed envelope with entries
- [x] **L2.9** replicateLog callback receives unsigned payload when autoSignOutbound is false
- [x] **L2.10** replicateLog signed envelope can be verified by follower
- [x] **L2.11** Full election cycle with implicit signing — follower verifies leader frames
- [x] **L2.12** Follower rejects implicitly signed frame from wrong key
- [x] **L2.13** Outbound signed counter increments during election
- [x] **L2.14** Outbound signed counter increments during heartbeat
- [x] **L2.15** Outbound signed counter increments during replication
- [x] **L2.16** No outbound signed counter when autoSignOutbound is false
- [x] **L2.17** Callbacks still work when no signing key and autoSignOutbound is true
- [x] **L2.18** Existing tests with no callbacks still work (no signing key)

### Level 3 — Self-review / drift

- [x] **L3.1** No scope creep — only implicit signing added
- [x] **L3.2** No ghost files
- [x] **L3.3** All 144 existing Track 34 tests still pass (no regression)
- [x] **L3.4** Deep-copy prevents post-signing mutation invalidation (entry.committed bug)
- [x] **L3.5** Backward compatible — unsigned mode works when no signing key configured
- [x] **L3.6** autoSignOutbound=false opt-out works correctly

## Pre-existing Failures (not caused by this change)

| Suite | Cause |
|-------|-------|
| `hsm-vault-throttle.test.cjs` | Pre-existing |
| `hub-smoke.test.js` | Pre-existing |
| `dashboard-auth.test.cjs` | Pre-existing |
