# Test Plan — Track 38: Encrypted P2P Routing

**Branch:** `feature/track38-encrypted-p2p-routing`
**Date:** 2026-08-02
**Status:** Active

## Objective

Implement an encrypted peer-to-peer routing engine that manages secure multi-node communication topologies with onion-style encryption, BFS route discovery, relay nodes, and anti-replay protection.

## Change Set

| File | Change |
|------|--------|
| `server/lib/hsm-adapter/encrypted-p2p-routing-engine.cjs` | **New** — Encrypted P2P routing engine |
| `server/lib/hsm-adapter/__tests__/encrypted-p2p-routing.test.cjs` | **New** — Test suite (41 tests) |
| `server/lib/hsm-adapter/crypto-policy-engine.cjs` | Add `encryptedP2PRouting` policy block |
| `server/lib/hsm-adapter/hsm-metrics.cjs` | Add P2P routing counters/gauges |

## Check Items

### Level 1 — Deterministic

- [x] L1.1 `node -c encrypted-p2p-routing-engine.cjs` — PASS
- [x] L1.2 `node -c encrypted-p2p-routing.test.cjs` — PASS
- [x] L1.3 `node -c crypto-policy-engine.cjs` — PASS
- [x] L1.4 `node -c hsm-metrics.cjs` — PASS
- [x] L1.5 Encrypted P2P routing test suite (41 tests) — PASS
- [x] L1.6 Policy engine test suite (16 tests) — PASS (no regression)
- [x] L1.7 No new dependencies added

### Level 2 — Functional Operations

- [x] L2.01 Full happy-path: discover route → establish → encrypt → relay → deliver
- [x] L2.02 RouteTable builds adjacency graph and finds shortest path via BFS
- [x] L2.03 Onion encryption wraps message with per-hop layers
- [x] L2.04 Relay nodes forward without seeing inner payload
- [x] L2.05 Route state machine enforces valid transitions
- [x] L2.06 Policy validation: encryptedP2PRouting block present, tenant overrides work
- [x] L2.07 Multi-hop routing across 3+ nodes
- [x] L2.08 Peer join/leave updates topology dynamically

### Level 3 — Security Engineering

- [x] L3.01 Anti-replay: nonce + timestamp validation rejects replayed messages
- [x] L3.02 Tampered message rejected (hash mismatch)
- [x] L3.03 Route revocation blocks compromised peers
- [x] L3.04 Cannot relay without established route
- [x] L3.05 No scope creep — only engine + policy + metrics + tests
- [x] L3.06 No ghost files or hallucinated API paths
- [x] L3.07 All existing tests still pass (no regression)
