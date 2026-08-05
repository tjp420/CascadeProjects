# Test Plan: Distributed Session Token Replication

> Extend the gossiped sync engine (SIEM_BUCKET_SYNC framework) to handle distributed,
> highly available crypto-token replication across the mesh to secure session persistence
> during node death.

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Session token replication engine, cluster gossip integration, token state recovery |
| Author (Builder) | Devin |
| Date | 2026-08-04 |
| Branch | feat/session-token-replication |
| Packages touched | ai-platform/server/lib, ai-platform/server/lib/siem, ai-platform/server/lib/cluster-keyring-sync.cjs |

## Problem

Session tokens are currently stored in-process `Map()` instances with optional fallback to file/PostgreSQL/Redis. When a cluster node dies:

1. **All in-memory session state is lost** — users on that node are forced to re-authenticate
2. **Token blocklist is not replicated** — revoked tokens may still be valid on other nodes
3. **Refresh token families are fragmented** — reuse detection fails across node boundaries
4. **SIEM distributed sync is not wired** — the gossip protocol exists but `enableDistributedSync()` is never called with a real `sendFn`
5. **No token state recovery** — on node restart, session state is empty with no cluster sync

## Objectives

### 1. Session Token Replication Engine (`server/lib/session-token-replication.cjs`)

New module that manages distributed session token state across cluster nodes:

- **SESS-REPL-01**: `SessionTokenReplicator` class with `init()`, `start()`, `stop()` lifecycle
- **SESS-REPL-02**: Local token store: Map of tokenId -> { tokenHash, userId, family, expiresAt, revoked, issuedAt, issuedBy }
- **SESS-REPL-03**: `issueToken(tokenData)` — stores locally and broadcasts `SESSION_TOKEN_ISSUE` to peers
- **SESS-REPL-04**: `revokeToken(tokenId)` — marks revoked locally and broadcasts `SESSION_TOKEN_REVOKE` to peers
- **SESS-REPL-05**: `revokeFamily(familyId)` — revokes all tokens in a family, broadcasts `SESSION_FAMILY_REVOKE`
- **SESS-REPL-06**: `isTokenRevoked(tokenId)` — checks local store (O(1) lookup)
- **SESS-REPL-07**: `getTokenState(tokenId)` — returns token metadata without sensitive data
- **SESS-REPL-08**: `handlePeerSync(msg)` — processes incoming `SESSION_TOKEN_SYNC` messages
- **SESS-REPL-09**: `handleTokenIssue(msg)` — applies remote token issuance to local store
- **SESS-REPL-10**: `handleTokenRevoke(msg)` — applies remote revocation to local store
- **SESS-REPL-11**: `handleFamilyRevoke(msg)` — applies remote family revocation
- **SESS-REPL-12**: `handleStateRequest(msg)` — responds with local token state for recovering node
- **SESS-REPL-13**: `requestStateFromPeers()` — new node requests full token state from cluster
- **SESS-REPL-14**: Periodic state sync broadcast (configurable interval, default 10s)
- **SESS-REPL-15**: Token expiry sweep — removes expired tokens from local store
- **SESS-REPL-16**: Metrics: tokens_replicated_total, tokens_revoked_total, sync_messages_sent_total, sync_messages_received_total
- **SESS-REPL-17**: Backward compatible — works standalone (no cluster) with local-only mode

### 2. Cluster Gossip Integration (`server/lib/cluster-keyring-sync.cjs`)

Extend the cluster messaging layer to route session token messages:

- **CLUSTER-SESS-01**: Add `SESSION_TOKEN_SYNC`, `SESSION_TOKEN_ISSUE`, `SESSION_TOKEN_REVOKE`, `SESSION_FAMILY_REVOKE`, `SESSION_STATE_REQUEST`, `SESSION_STATE_RESPONSE` to IPC_SCHEMAS
- **CLUSTER-SESS-02**: Route session token messages in `_handleMessage` to the replicator
- **CLUSTER-SESS-03**: Add `setSessionReplicator(replicator)` function to register the replicator
- **CLUSTER-SESS-04**: Wire `enableDistributedSync()` on the SIEM broker with `_broadcast` as the sendFn when cluster forms
- **CLUSTER-SESS-05**: On cluster formation (`CLUSTER_FORMED` event), trigger replicator state request
- **CLUSTER-SESS-06**: Tenant scope validation on session token messages (reuse `_validateTenantScope`)

### 3. SIEM Broker Production Wiring (`server/lib/siem/siem-broker.cjs`)

Wire the existing distributed sync protocol to production:

- **SIEM-WIRE-01**: Add `enableClusterSync(clusterSync)` method that wires `sendFn` to `clusterSync._broadcast`
- **SIEM-WIRE-02**: Auto-call `enableDistributedSync()` with correct nodeCount from cluster state
- **SIEM-WIRE-03**: Expose `getDistributedState()` for monitoring

### 4. Integration Tests

- **INT-01**: Session token replicator issues token and broadcasts to peers
- **INT-02**: Peer receives token issue and applies to local store
- **INT-03**: Token revocation propagates across cluster
- **INT-04**: Family revocation propagates across cluster
- **INT-05**: New node requests and receives state from peers
- **INT-06**: Token expiry sweep removes expired tokens
- **INT-07**: SIEM broker distributed sync is wired on cluster formation
- **INT-08**: IPC schema validation rejects malformed session token messages
- **INT-09**: Tenant scope validation on session token messages
- **INT-10**: Zero regressions — all existing tests pass

## Files to Touch

| File | Change | New? |
|------|--------|------|
| `server/lib/session-token-replication.cjs` | New replication engine | Yes |
| `server/lib/cluster-keyring-sync.cjs` | Add IPC schemas, routing, replicator integration | No |
| `server/lib/siem/siem-broker.cjs` | Add enableClusterSync method | No |
| `server/lib/__tests__/session-token-replication.test.cjs` | Unit tests for replicator | Yes |
| `server/lib/__tests__/cluster-session-integration.test.cjs` | Integration tests for cluster routing | Yes |
| `server/lib/siem/__tests__/siem-cluster-wiring.test.cjs` | Tests for SIEM broker production wiring | Yes |

## Level 1 Verification

```powershell
node -c server/lib/session-token-replication.cjs
node -c server/lib/cluster-keyring-sync.cjs
node -c server/lib/siem/siem-broker.cjs
cd ai-platform && npx jest server/lib/__tests__/session-token-replication.test.cjs --no-coverage
cd ai-platform && npx jest server/lib/__tests__/cluster-session-integration.test.cjs --no-coverage
cd ai-platform && npx jest server/lib/siem/__tests__/siem-cluster-wiring.test.cjs --no-coverage
```

## Security Invariants

1. **No sensitive data on the wire**: Token hashes only — never raw tokens or keys
2. **Idempotent operations**: Duplicate issue/revoke messages are safe
3. **Fail-safe revocation**: If in doubt, revoke (never fail-open on revocation)
4. **Tenant isolation**: Session token messages carry tenantId and are validated
5. **Backward compatible**: Works standalone without cluster (local-only mode)
6. **No token leakage**: `getTokenState()` returns metadata only, never token hashes
