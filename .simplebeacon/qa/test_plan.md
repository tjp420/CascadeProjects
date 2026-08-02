# Test Plan — Track 34 Phase 5: Peer Key Rotation

**Branch:** `feature/track34-phase5-key-rotation`
**Date:** 2026-08-02
**Status:** Retroactive (hotfix per QA framework)

## Objective

Enable dynamic peer public key rotation at runtime via quorum-gated consensus transactions, without requiring process restarts or cluster-wide outage.

## Change Set

| File | Change |
|------|--------|
| `server/lib/hsm-adapter/cluster-consensus-engine.cjs` | Added `addPeerKey()`, `revokePeerKey()`, `getRegisteredPeers()`, `hasPeerKey()`, `_applyConsensusCommand()`. Extended `_applyCommittedEntries()` to execute rotation commands. |
| `server/lib/hsm-adapter/crypto-policy-engine.cjs` | Added `enablePeerKeyRotation`, `maxPeerKeyRotationRateMs` to consensus policy + `_validateConsensus()` |
| `server/lib/hsm-adapter/hsm-metrics.cjs` | 3 new counters: `peer_key_added_total`, `peer_key_revoked_total`, `peer_key_rotation_blocked_total` |
| `server/lib/hsm-adapter/__tests__/cluster-consensus-rotation.test.cjs` | 22 new tests |

## Check Items

### Level 1 — Deterministic (required)

- [x] **L1.1** `node -c cluster-consensus-engine.cjs` — syntax pass
- [x] **L1.2** `node -c crypto-policy-engine.cjs` — syntax pass
- [x] **L1.3** `node -c hsm-metrics.cjs` — syntax pass
- [x] **L1.4** `node -c cluster-consensus-rotation.test.cjs` — syntax pass
- [x] **L1.5** `npm test` (ai-platform) — 239 suites pass, 2601 tests pass
- [x] **L1.6** No new dependencies added
- [x] **L1.7** No secrets/keys committed

### Level 2 — Behavioral

- [x] **L2.1** Leader can add a new peer key via quorum-gated consensus
- [x] **L2.2** Follower cannot add a peer key (CONSENSUS_NOT_LEADER)
- [x] **L2.3** addPeerKey rejects invalid inputs (empty nodeId, null publicKey)
- [x] **L2.4** addPeerKey updates existing key (rotation scenario — old key fails, new key works)
- [x] **L2.5** Leader can revoke a peer key via quorum-gated consensus
- [x] **L2.6** Follower cannot revoke a peer key
- [x] **L2.7** revokePeerKey rejects unknown peer (PEER_KEY_NOT_FOUND)
- [x] **L2.8** revokePeerKey rejects invalid inputs
- [x] **L2.9** Revoked peer RPCs are rejected after revocation
- [x] **L2.10** getRegisteredPeers returns list of registered peer IDs
- [x] **L2.11** hasPeerKey returns false for unregistered peer
- [x] **L2.12** _applyConsensusCommand applies addPeerKey from committed log entry
- [x] **L2.13** _applyConsensusCommand applies revokePeerKey from committed log entry
- [x] **L2.14** _applyConsensusCommand ignores non-rotation commands

### Level 3 — Self-review / drift

- [x] **L3.1** No scope creep — only peer key rotation added
- [x] **L3.2** No ghost files
- [x] **L3.3** Existing 89 Track 34 tests still pass (no regression)
- [x] **L3.4** Policy validation covers `enablePeerKeyRotation`, `maxPeerKeyRotationRateMs`
- [x] **L3.5** Prometheus metrics increment correctly for added/revoked/blocked events
- [x] **L3.6** Audit events: PEER_KEY_ADDED, PEER_KEY_REVOKED, PEER_KEY_ROTATION_BLOCKED

## Pre-existing Failures (not caused by this change)

| Suite | Cause |
|-------|-------|
| `hsm-vault-throttle.test.cjs` | Pre-existing |
| `hub-smoke.test.js` | Pre-existing |
| `dashboard-auth.test.cjs` | Pre-existing |
