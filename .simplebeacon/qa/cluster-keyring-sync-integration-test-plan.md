# Cluster Keyring Sync Integration Layer — Technical Specification Blueprint

> test_plan.md — Phase 1 Spec. No feature code until user approval.
> Per QA framework: Builder drafts spec → User approves → Builder implements → Validator grades.

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Cluster Keyring Sync Integration Layer for 18 primitive gates (Tracks 91-110) |
| Author (Builder) | Devin |
| Date | 2025-01-22 |
| Branch | (to be created on approval) |
| Packages touched | ai-platform |

## 1. Problem Statement

The 18 non-signature primitive gates (Tracks 91-110) each maintain isolated
verification pools with blinded Pedersen commitments, attestation gating,
and quorum-based accreditation. However, they currently have no path to
**authorize distributed node-to-node secret sharing** across the cluster.

The existing `cluster-keyring-sync.cjs` (server/lib/) handles TLS-based P2P
key sync, STEK rotation, and leader election — but it does not know about the
primitive gates' pool lifecycle (initialize → claim verified → accredited).

**The gap:** When a primitive gate completes accreditation for a pool, there
is no mechanism to (a) authorize the resulting key material for cluster-wide
node-to-node distribution, (b) enforce that only accredited pools' shares are
synced, or (c) prevent un-accredited or revoked pools from leaking shares
across nodes.

## 2. Existing Infrastructure (Grounding)

### Files already in the codebase

| File | Role | Reuse potential |
|------|------|-----------------|
| `server/lib/cluster-keyring-sync.cjs` | TLS P2P key sync, event timeline, leader election | **Extend** — add primitive gate authorization events |
| `server/lib/hsm-adapter/homomorphic-key-shard-disperser.cjs` | Track 53 — disperses key shards with dual attestation | **Reuse** — dispersal pattern for accredited pools |
| `server/lib/hsm-adapter/ephemeral-share-ratchet.cjs` | Track 42 — HKDF-SHA256 forward-secrecy ratchet | **Reuse** — ratchet shares on distribution |
| `server/lib/hsm-adapter/cross-enclave-state-sync.cjs` | Track 44 — vector-clock state sync | **Reuse** — pool state replication |
| `server/lib/hsm-adapter/cluster-key-reconciliation-engine.cjs` | Track 35 — divergence detection, epoch promotion | **Reuse** — detect share divergence |
| `server/lib/hsm-adapter/enclave-attestation-client.cjs` | Track 41 — attestation verification + `isNodeVerified` | **Reuse** — node attestation gating |
| `server/lib/hsm-adapter/group-reshard-engine.cjs` | Track 42 — threshold share expansion/contraction | **Reuse** — reshard on node join/leave |
| `server/lib/hsm-adapter/base-adapter.cjs` | Telemetry emit methods for all 18 gates | **Extend** — add sync authorization telemetry |
| `server/lib/hsm-adapter/crypto-policy-engine.cjs` | Policy validation for all gate configs | **Extend** — add sync authorization policy |
| `server/lib/hsm-adapter/hsm-metrics.cjs` | Prometheus counters | **Extend** — add sync authorization counters |

### Primitive gate pattern (all 18 gates, Tracks 91-110)

Every gate follows the same lifecycle:
```
initializePool(request) → pool.status='open'
  ↓
verifyXxxClaim(request) → pool.xxxClaimVerified=true
  ↓
completeAccreditation(request) → pool.status='accredited'
```

**Key insight:** The `completeAccreditation` step is the natural authorization
point — once a pool is accredited, its key material is cleared for cluster-wide
distribution. The integration layer hooks into this transition.

## 3. Proposed Design (Broom Strategy — minimal new files)

### 3a. New file: `server/lib/hsm-adapter/cluster-keyring-primitive-authorization.cjs`

**Justification for new file:** This is a bridge layer that coordinates 18
primitive gates with 5 existing cluster sync components. Adding this logic to
any single existing file would violate separation of concerns and create
circular dependencies (it imports from both `cluster-keyring-sync.cjs` and
all 18 `pqc-*-gating-hub.cjs` files). One new file is the minimum viable
addition.

**Class:** `ClusterKeyringPrimitiveAuthorization`

**Constructor:**
```javascript
constructor(options) {
  this.policy = options.policy || {};
  this._attestationClient = options.attestationClient || null;
  this._keyringSync = options.keyringSync || null;        // cluster-keyring-sync.cjs
  this._shardDisperser = options.shardDisperser || null;  // homomorphic-key-shard-disperser.cjs
  this._ratchet = options.ratchet || null;                // ephemeral-share-ratchet.cjs
  this._reconciler = options.reconciler || null;          // cluster-key-reconciliation-engine.cjs
  this._stateSync = options.stateSync || null;            // cross-enclave-state-sync.cjs
  this._audit = options.audit || null;
  this._gateRegistries = new Map();  // trackType → { hub, validator }
  this._authorizedPools = new Map(); // poolId → authorization record
}
```

**Key methods:**

```javascript
// Register a primitive gate hub + validator pair for a track type
registerGate(trackType, hub, validator) { ... }

// Called when a pool completes accreditation — authorizes shares for cluster sync
authorizeAccreditedPool(trackType, poolId, request) {
  // 1. Look up hub from _gateRegistries
  // 2. Verify pool exists and status === 'accredited'
  // 3. Verify attestation via _attestationClient.isNodeVerified()
  // 4. Ratchet the share material via _ratchet.evolveShare()
  // 5. Disperse to cluster nodes via _shardDisperser.disperse()
  // 6. Record authorization in _authorizedPools
  // 7. Emit KEY_PRIMITIVE_AUTHORIZED event via _keyringSync.recordTelemetry()
  // 8. Emit audit event
}

// Check if a pool is authorized for node-to-node sharing
isPoolAuthorized(poolId) { ... }

// Revoke authorization (e.g., on pool cancellation or node compromise)
revokeAuthorization(poolId, reason) { ... }

// Sync authorized pool state to a target enclave
syncAuthorizedPool(poolId, targetEnclaveId) {
  // 1. Check isPoolAuthorized
  // 2. Use _stateSync.syncState() to replicate
  // 3. Emit PRIMITIVE_POOL_SYNCED event
}

// Detect divergence in authorized pool shares across nodes
detectShareDivergence(poolId) {
  // 1. Use _reconciler.detectDivergence() pattern
  // 2. Return divergence severity
}

// Get authorization summary for monitoring
getAuthorizationSummary() { ... }
```

### 3b. Extend `base-adapter.cjs` — 3 telemetry methods

```javascript
emitPrimitivePoolAuthorized(info) {
  this._ensureInitialized();
  this._audit('PRIMITIVE_POOL_AUTHORIZED', info);
  try { require('./hsm-metrics.cjs').incrementCounter('hsm_primitive_pool_authorized_total'); } catch { }
}

emitPrimitivePoolSynced(info) {
  this._ensureInitialized();
  this._audit('PRIMITIVE_POOL_SYNCED', info);
  try { require('./hsm-metrics.cjs').incrementCounter('hsm_primitive_pool_synced_total'); } catch { }
}

emitPrimitiveAuthorizationRevoked(info) {
  this._ensureInitialized();
  this._audit('PRIMITIVE_AUTHORIZATION_REVOKED', info);
  try { require('./hsm-metrics.cjs').incrementCounter('hsm_primitive_authorization_revoked_total'); } catch { }
}
```

### 3c. Extend `hsm-metrics.cjs` — 3 counters × 2 locations

```javascript
// Init values
hsm_primitive_pool_authorized_total: 0,
hsm_primitive_pool_synced_total: 0,
hsm_primitive_authorization_revoked_total: 0,

// Metadata
hsm_primitive_pool_authorized_total: { help: 'Total primitive pools authorized for cluster keyring sync.', type: 'counter' },
hsm_primitive_pool_synced_total: { help: 'Total primitive pools synced across enclaves.', type: 'counter' },
hsm_primitive_authorization_revoked_total: { help: 'Total primitive pool authorizations revoked.', type: 'counter' },
```

### 3d. Extend `crypto-policy-engine.cjs` — 1 policy block + 1 validator + 1 dispatch

```javascript
// DEFAULT_POLICY block
clusterKeyringPrimitiveAuthorization: {
  minAuthorizationQuorum: 3,
  maxSyncWindowSeconds: 300,
  maxAuthorizedPoolRetentionSeconds: 86400,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireNodeAttestation: true,
  requireAccreditedPoolStatus: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banUnauthorizedShareDispersal: true,
  requireCanonicalPayloadLayout: true,
},

// Validator method
_validateClusterKeyringPrimitiveAuthorization(tenantPolicy, config) { ... }

// Dispatch entry
if (operation === 'clusterKeyringPrimitiveAuthorization') { ... }
```

### 3e. Extend `cluster-keyring-sync.cjs` — 3 event types

```javascript
// Add to EVENT_TYPES
PRIMITIVE_POOL_AUTHORIZED: 'primitive_pool_authorized',
PRIMITIVE_POOL_SYNCED: 'primitive_pool_synced',
PRIMITIVE_AUTHORIZATION_REVOKED: 'primitive_authorization_revoked',
```

### 3f. New test file: `__tests__/cluster-keyring-primitive-authorization.test.cjs`

15 tests covering:
1. Gate registration and lookup
2. Pool authorization after accreditation
3. Rejection of un-accredited pools
4. Rejection of un-attested nodes
5. Share ratcheting on authorization
6. Share dispersal to cluster nodes
7. Pool state sync to target enclave
8. Authorization revocation
9. Share divergence detection
10. Quorum enforcement
11. PQC signature scheme validation
12. Attestation authority validation
13. Sync window enforcement
14. Retention expiry
15. CryptoPolicyEngine validation

## 4. Authorization Flow (Sequence)

```
Primitive Gate (Track 91-110)
  │
  ├─ initializePool() → pool.status='open'
  ├─ verifyXxxClaim() → pool.xxxClaimVerified=true
  └─ completeAccreditation() → pool.status='accredited'
       │
       ↓
ClusterKeyringPrimitiveAuthorization.authorizeAccreditedPool(trackType, poolId)
       │
       ├─ Verify pool.status === 'accredited'
       ├─ Verify _attestationClient.isNodeVerified(nodeId)
       ├─ Ratchet share via _ratchet.evolveShare()
       ├─ Disperse via _shardDisperser.disperse()
       ├─ Record in _authorizedPools
       ├─ Emit PRIMITIVE_POOL_AUTHORIZED via _keyringSync.recordTelemetry()
       └─ Emit audit event
       │
       ↓
ClusterKeyringPrimitiveAuthorization.syncAuthorizedPool(poolId, targetEnclaveId)
       │
       ├─ Check isPoolAuthorized(poolId)
       ├─ _stateSync.syncState(shardId, targetEnclaveId)
       └─ Emit PRIMITIVE_POOL_SYNCED
```

## 5. Multi-Tenant Isolation

All authorization records are scoped by `tenantId` from the primitive gate's
pool. The policy engine enforces per-tenant authorization policies via the
existing `crypto-policy-engine.cjs` tenant merge pattern.

**Zero metadata bleeding guarantee:**
- Authorization records include `sourceTenantId` from the pool
- Share dispersal checks `sourceTenantId` matches destination tenant
- State sync enforces tenant-scoped shard IDs
- Reconciliation engine groups by tenant fingerprint

## 6. Files in scope

### New files (2)
- `server/lib/hsm-adapter/cluster-keyring-primitive-authorization.cjs`
- `server/lib/hsm-adapter/__tests__/cluster-keyring-primitive-authorization.test.cjs`

### Extended files (4)
- `server/lib/hsm-adapter/base-adapter.cjs` — 3 telemetry methods
- `server/lib/hsm-adapter/hsm-metrics.cjs` — 3 counters × 2 locations
- `server/lib/hsm-adapter/crypto-policy-engine.cjs` — 1 policy block + 1 validator + 1 dispatch
- `server/lib/cluster-keyring-sync.cjs` — 3 event types

### NOT touched (reuse only via imports)
- All 18 `pqc-*-gating-hub.cjs` files (read-only via `registerGate`)
- `homomorphic-key-shard-disperser.cjs` (called via `disperse()`)
- `ephemeral-share-ratchet.cjs` (called via `evolveShare()`)
- `cross-enclave-state-sync.cjs` (called via `syncState()`)
- `cluster-key-reconciliation-engine.cjs` (called via `detectDivergence()`)
- `enclave-attestation-client.cjs` (called via `isNodeVerified()`)

## 7. APIs / routes

No new REST routes. All interaction is via the programmatic API
(`ClusterKeyringPrimitiveAuthorization` class). The existing
`cluster-keyring-sync.cjs` event timeline gains 3 new event types
queryable via the existing `queryEvents()` API.

## 8. UI / IDE surfaces

- [ ] Not applicable — backend-only integration layer

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on new .cjs files | `node -c server/lib/hsm-adapter/cluster-keyring-primitive-authorization.cjs` | [ ] |
| L1-02 | Syntax on new test file | `node -c server/lib/hsm-adapter/__tests__/cluster-keyring-primitive-authorization.test.cjs` | [ ] |
| L1-03 | Syntax on extended files | `node -c` on base-adapter, hsm-metrics, crypto-policy-engine, cluster-keyring-sync | [ ] |
| L1-04 | JSON valid (schema) | `node -e "JSON.parse(require('fs').readFileSync('server/lib/hsm-adapter/crypto-policy-schema.json','utf8'))"` | [ ] |
| L1-05 | ai-platform tests | `cd ai-platform && npm test` | [ ] |
| L1-06 | SimpleBeacon gate (full) | `npx simplebeacon scan --full --gate --format json` | [ ] |
| L1-07 | No secrets in diff | Manual / gate token rules | [ ] |
| L1-08 | run-all-tracks pass | `node server/lib/hsm-adapter/__tests__/run-all-tracks.cjs` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Authorize accredited pool | Register gate → init pool → verify claim → complete accreditation → authorizeAccreditedPool | Authorization record created, PRIMITIVE_POOL_AUTHORIZED emitted | [ ] |
| L2-02 | Reject un-accredited pool | Register gate → init pool → authorizeAccreditedPool (skip accreditation) | Throws error, no authorization record | [ ] |
| L2-03 | Reject un-attested node | Register gate → init pool → verify claim → complete accreditation → authorizeAccreditedPool with un-attested node | Throws RESHARDING_UNATTESTED_NODE | [ ] |
| L2-04 | Sync authorized pool | Authorize pool → syncAuthorizedPool to target enclave | PRIMITIVE_POOL_SYNCED emitted, state replicated | [ ] |
| L2-05 | Revoke authorization | Authorize pool → revokeAuthorization | Authorization removed, PRIMITIVE_AUTHORIZATION_REVOKED emitted | [ ] |
| L2-06 | Detect share divergence | Authorize pool → detectShareDivergence | Returns divergence severity (none/minor/critical) | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Unregistered gate trackType | authorizeAccreditedPool throws GATE_NOT_REGISTERED | [ ] |
| L3-02 | Authorization retention expiry | After maxAuthorizedPoolRetentionSeconds, authorization auto-revoked | [ ] |
| L3-03 | Sync window exceeded | syncAuthorizedPool after maxSyncWindowSeconds throws SYNC_WINDOW_EXCEEDED | [ ] |
| L3-04 | Duplicate authorization | authorizeAccreditedPool twice throws DUPLICATE_AUTHORIZATION | [ ] |
| L3-05 | Revoked pool sync attempt | syncAuthorizedPool on revoked pool throws AUTHORIZATION_REVOKED | [ ] |
| L3-06 | Cross-tenant authorization | Pool with tenant-A cannot authorize for tenant-B node | [ ] |
| L3-07 | All 18 gate types register | Register all 18 primitive gates, verify getAuthorizationSummary shows 18 | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No credentials / PII in logs or commits | [ ] |
| S-02 | All share material ratcheted before dispersal | [ ] |
| S-03 | Attestation required for all node-to-node sync | [ ] |
| S-04 | Tenant isolation enforced (no cross-tenant share leakage) | [ ] |
| S-05 | Revoked pools cannot sync shares | [ ] |

---

## Error Codes

| Code | Meaning |
|------|---------|
| GATE_NOT_REGISTERED | trackType has no registered hub/validator pair |
| POOL_NOT_ACCREDITED | Pool status is not 'accredited' |
| POOL_NOT_FOUND | Pool ID does not exist in the gate's registry |
| NODE_UNATTESTED | Node has not been attested via EnclaveAttestationClient |
| DUPLICATE_AUTHORIZATION | Pool already authorized |
| AUTHORIZATION_REVOKED | Pool authorization was revoked |
| SYNC_WINDOW_EXCEEDED | Sync attempted after maxSyncWindowSeconds |
| RETENTION_EXPIRED | Authorization expired after maxAuthorizedPoolRetentionSeconds |
| QUORUM_INSUFFICIENT | Authorization quorum not met |
| CROSS_TENANT_VIOLATION | Attempted cross-tenant authorization |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________

---

## Implementation Notes (for Builder phase)

1. **Follow the Broom Strategy:** One new file + one test file + minimal
   extensions to 4 existing files. Do NOT refactor existing gates.
2. **Reuse patterns:** Mirror the existing `HomomorphicKeyShardDisperser`
   dual-attestation pattern and `EphemeralShareRatchet` HKDF pattern.
3. **Policy-first:** Add the policy block to `crypto-policy-engine.cjs`
   before implementing the authorization class.
4. **Test before extend:** Write the test file first, then implement
   the authorization class, then wire the telemetry/metrics/policy.
5. **Verify after each step:** `node -c` after every file change.
