# test_plan.md

> Option G: HSM Adapter Orchestration for MuSig2 Signatures
> Bridge the software-only MuSig2/FROST math engine (`server/lib/mpc/schnorr/`)
> with the HSM adapter layer (`server/lib/hsm-adapter/`) via a new
> `Musig2HsmOrchestrator` class that wraps key share storage, nonce generation,
> and signing sessions behind the HSM KEK lifecycle — following the
> `DistributedConsensusCoordinator` orchestration pattern.

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | HSM Adapter Orchestration for MuSig2 Signatures |
| Author (Builder) | Devin |
| Date | 2026-08-03 |
| Branch | feat/musig2-hsm-adapter-orchestration |
| Packages touched | ai-platform |

## Scope

### Files in scope

**New files (2):**
- `server/lib/hsm-adapter/musig2-hsm-orchestrator.cjs` — Orchestrator class bridging MuSig2 math engine with HSM adapter layer
- `server/lib/hsm-adapter/__tests__/musig2-hsm-orchestrator.test.cjs` — Behavioral + edge case + security test suite

**Modified files (3):**
- `server/lib/hsm-adapter/base-adapter.cjs` — Add `registerMusig2Orchestrator`/`getMusig2Orchestrator` to module-level registry pattern (Track 62)
- `server/lib/hsm-adapter/hsm-metrics.cjs` — Add 4 new orchestrator-level counters (session, key-share-wrap, key-share-unwrap, nonce-seal)
- `server/routes/hsm-vault-routes.cjs` — Add 3 new REST endpoints for MuSig2 session management

**READ-ONLY files (NOT modified — zero drift):**
- `server/lib/mpc/schnorr/protocol.cjs` — MuSig2 math engine (SchnorrThresholdAggregator)
- `server/lib/mpc/schnorr/signature_share.cjs` — Partial share evaluator
- `server/lib/mpc/schnorr/nonce.cjs` — Nonce generator
- `server/lib/mpc/schnorr/field.cjs` — Prime field arithmetic
- `server/lib/hsm-adapter/distributed-consensus-coordinator.cjs` — Pattern reference only

### APIs / routes

- `POST /api/vault/musig2/session/create` — Create a new MuSig2 signing session
- `GET /api/vault/musig2/session/:sessionId/status` — Get session status
- `POST /api/vault/musig2/session/:sessionId/sign` — Execute signing round

### UI / IDE surfaces

- [ ] Sidebar webview
- [ ] Main dashboard iframe / address bar
- [ ] Welcome / main window panel
- [ ] Simple Browser / external browser

---

## Architectural Design

### Musig2HsmOrchestrator Class

Follows the `DistributedConsensusCoordinator` pattern (async/await state machine with metrics integration):

```
class Musig2HsmOrchestrator {
  constructor(options) {
    // options.hsmAdapter — BaseHsmAdapter instance (for KEK wrap/unwrap)
    // options.modulus — Prime field modulus for Schnorr math
    // options.maxSessions — Session limit (default 128)
    // options.sessionTimeoutMs — Idle session timeout (default 60000)
    // options.audit — Audit callback
  }

  // Session lifecycle
  async createSession({ tenantId, participantIds, quorum, messageHash }) → sessionId
  async getSessionStatus(sessionId) → { state, participants, phase }
  async destroySession(sessionId) → void

  // Signing flow (wraps math engine with HSM operations)
  async generateNonces(sessionId) → { publicCommitments[] }
  async aggregateKeys(sessionId) → { aggPublicKey }
  async computeBindingFactor(sessionId) → { bindingFactor }
  async evaluateShares(sessionId) → { partialShares[] }
  async assembleSignature(sessionId) → { R, s }
  async verifySignature(sessionId, signature) → { valid }

  // HSM-protected key share management
  async wrapKeyShare(tenantId, keyShare) → wrappedBlob
  async unwrapKeyShare(tenantId, wrappedBlob) → keyShare
  async sealNonce(tenantId, nonce) → sealedNonce
  async unsealNonce(tenantId, sealedNonce) → nonce
}
```

### Session States

```
CREATED → NONCES_GENERATED → KEYS_AGGREGATED → BINDING_COMPUTED → SHARES_EVALUATED → SIGNATURE_ASSEMBLED → VERIFIED
                                                                                    ↓
                                                                                FAILED
```

### Metrics Integration

4 new counters in `hsm-metrics.cjs`:
- `hsm_musig2_orch_session_created_total` — Sessions created
- `hsm_musig2_orch_session_completed_total` — Sessions completed successfully
- `hsm_musig2_orch_session_failed_total` — Sessions that failed
- `hsm_musig2_orch_key_share_wrapped_total` — Key shares wrapped via HSM

Plus instrumentation of the 7 existing MuSig2 counters (currently defined but NOT incremented):
- `hsm_musig2_challenge_computed_total`
- `hsm_musig2_binding_factor_computed_total`
- `hsm_musig2_key_aggregation_total`
- `hsm_musig2_nonce_aggregation_total`
- `hsm_musig2_signature_assembled_total`
- `hsm_musig2_signature_verified_total`
- `hsm_musig2_signature_verification_failed_total`

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on `musig2-hsm-orchestrator.cjs` | `node -c server/lib/hsm-adapter/musig2-hsm-orchestrator.cjs` | [ ] |
| L1-02 | Syntax on `musig2-hsm-orchestrator.test.cjs` | `node -c server/lib/hsm-adapter/__tests__/musig2-hsm-orchestrator.test.cjs` | [ ] |
| L1-03 | Syntax on modified `base-adapter.cjs` | `node -c server/lib/hsm-adapter/base-adapter.cjs` | [ ] |
| L1-04 | Syntax on modified `hsm-metrics.cjs` | `node -c server/lib/hsm-adapter/hsm-metrics.cjs` | [ ] |
| L1-05 | Syntax on modified `hsm-vault-routes.cjs` | `node -c server/routes/hsm-vault-routes.cjs` | [ ] |
| L1-06 | ai-platform tests | `cd ai-platform && npm test` | [ ] |
| L1-07 | Parallel orchestrator | `cd ai-platform && npm run test:parallel` | [ ] |
| L1-08 | SimpleBeacon gate (full) | `npx simplebeacon scan --full --gate --format json` | [ ] |
| L1-09 | No secrets in diff | Manual / gate token rules | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Create session with valid params | `createSession({ tenantId, participantIds: [1,2,3], quorum: [1,2,3], messageHash })` | Returns unique sessionId, state=CREATED, metrics counter incremented | [ ] |
| L2-02 | Generate nonces for session | `generateNonces(sessionId)` | Returns publicCommitments array, state=NONCES_GENERATED, `hsm_musig2_nonce_aggregation_total` not yet incremented | [ ] |
| L2-03 | Aggregate public keys | `aggregateKeys(sessionId)` | Returns aggPublicKey, state=KEYS_AGGREGATED, `hsm_musig2_key_aggregation_total` incremented | [ ] |
| L2-04 | Compute binding factor | `computeBindingFactor(sessionId)` | Returns bindingFactor, state=BINDING_COMPUTED, `hsm_musig2_binding_factor_computed_total` incremented | [ ] |
| L2-05 | Evaluate partial shares | `evaluateShares(sessionId)` | Returns partialShares array, state=SHARES_EVALUATED | [ ] |
| L2-06 | Assemble final signature | `assembleSignature(sessionId)` | Returns {R, s}, state=SIGNATURE_ASSEMBLED, `hsm_musig2_signature_assembled_total` incremented | [ ] |
| L2-07 | Verify assembled signature | `verifySignature(sessionId, signature)` | Returns {valid: true}, state=VERIFIED, `hsm_musig2_signature_verified_total` incremented | [ ] |
| L2-08 | Full round-trip signing (2-of-3) | Create → generateNonces → aggregateKeys → computeBindingFactor → evaluateShares → assembleSignature → verifySignature | All phases pass, signature verifies, all 7 MuSig2 counters incremented | [ ] |
| L2-09 | Full round-trip signing (3-of-5) | Same flow with 5 participants, quorum 3 | Signature verifies, counters incremented | [ ] |
| L2-10 | Wrap key share via HSM | `wrapKeyShare(tenantId, keyShare)` | Returns wrapped blob, `hsm_musig2_orch_key_share_wrapped_total` incremented | [ ] |
| L2-11 | Unwrap key share via HSM | `unwrapKeyShare(tenantId, wrappedBlob)` | Returns original keyShare value | [ ] |
| L2-12 | Seal nonce via HSM | `sealNonce(tenantId, nonce)` | Returns sealed nonce blob | [ ] |
| L2-13 | Unseal nonce via HSM | `unsealNonce(tenantId, sealedNonce)` | Returns original nonce value | [ ] |
| L2-14 | Get session status | `getSessionStatus(sessionId)` | Returns { state, participants, phase, createdAt } | [ ] |
| L2-15 | Destroy session | `destroySession(sessionId)` | Session removed from registry, subsequent calls throw | [ ] |
| L2-16 | Module-level registry | `registerMusig2Orchestrator(orch)` then `getMusig2Orchestrator()` | Returns registered instance | [ ] |
| L2-17 | Route: POST /session/create | POST to `/api/vault/musig2/session/create` with valid body | Returns 200 with sessionId | [ ] |
| L2-18 | Route: GET /session/:id/status | GET status for existing session | Returns 200 with session state | [ ] |
| L2-19 | Route: POST /session/:id/sign | POST sign for existing session | Returns 200 with signature | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Create session with missing tenantId | Throws HsmAdapterError with INVALID_INPUT code | [ ] |
| L3-02 | Create session with empty participantIds | Throws HsmAdapterError | [ ] |
| L3-03 | Create session with quorum larger than participants | Throws HsmAdapterError | [ ] |
| L3-04 | Generate nonces for non-existent session | Throws HsmAdapterError with SESSION_NOT_FOUND | [ ] |
| L3-05 | Aggregate keys out of order (before nonces) | Throws HsmAdapterError with INVALID_STATE | [ ] |
| L3-06 | Assemble signature before shares evaluated | Throws HsmAdapterError with INVALID_STATE | [ ] |
| L3-07 | Session timeout (idle > sessionTimeoutMs) | Session auto-destroyed, subsequent calls throw | [ ] |
| L3-08 | Max sessions exceeded | Throws HsmAdapterError with MAX_SESSIONS_EXCEEDED | [ ] |
| L3-09 | Wrap key share with null HSM adapter | Throws HsmAdapterError with NO_HSM_ADAPTER | [ ] |
| L3-10 | Unwrap corrupted key share blob | Throws HsmAdapterError with UNWRAP_FAILED | [ ] |
| L3-11 | Verify invalid signature | Returns {valid: false}, `hsm_musig2_signature_verification_failed_total` incremented | [ ] |
| L3-12 | Destroy already-destroyed session | Throws HsmAdapterError with SESSION_NOT_FOUND | [ ] |
| L3-13 | Existing schnorr tests still pass | `node --test server/lib/mpc/schnorr/__tests__/schnorr.test.cjs` — 32/32 pass | [ ] |
| L3-14 | Existing hsm-metrics tests still pass | `npx jest server/lib/__tests__/hsm-metrics-prometheus.test.cjs` — 24/24 pass | [ ] |
| L3-15 | Nonce zeroization after share evaluation | Secret nonces zeroed in memory after evaluateShares completes | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No credentials / PII in logs or commits | [ ] |
| S-02 | Key shares wrapped via HSM KEK before storage (never stored in plaintext) | [ ] |
| S-03 | Secret nonces zeroized after share evaluation | [ ] |
| S-04 | Session data cleared on destroy (no residual key material) | [ ] |
| S-05 | Tenant isolation: session tenantId scoped, cross-tenant access rejected | [ ] |
| S-06 | No private key material in route responses or metrics | [ ] |
| S-07 | Audit callback receives events without sensitive payload values | [ ] |

---

## Test Matrix Summary

| Level | Count |
|-------|-------|
| L1 (Deterministic) | 9 |
| L2 (Behavioral) | 19 |
| L3 (Edge cases) | 15 |
| Security | 7 |
| **Total** | **50** |

---

## Implementation Notes

### Broom Strategy Compliance
- **1 new production file**: `musig2-hsm-orchestrator.cjs` (orchestrator class)
- **1 new test file**: `musig2-hsm-orchestrator.test.cjs`
- **3 modified files**: `base-adapter.cjs` (registry), `hsm-metrics.cjs` (counters), `hsm-vault-routes.cjs` (routes)
- **5 READ-ONLY files**: All schnorr math engine files remain untouched
- **Zero new dependencies**: Uses existing `BaseHsmAdapter`, `SchnorrThresholdAggregator`, `SchnorrShareEvaluator`, `Musig2NonceGenerator`

### Pattern Adherence
- Follows `DistributedConsensusCoordinator` orchestration pattern (async/await state machine)
- Uses `HsmAdapterError` for typed errors (consistent with existing adapter layer)
- Uses `hsmMetrics.incrementCounter()` for telemetry (consistent with 41+ existing files)
- Uses module-level registry pattern (`registerMusig2Orchestrator`/`getMusig2Orchestrator`)
- Uses `node:test` + `node:assert` for tests (consistent with hsm-adapter test suite)

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________
