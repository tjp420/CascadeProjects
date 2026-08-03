# Track 62: Post-Quantum Time-Locked Zero-Knowledge Encryption Matrix Hubs — Test Plan

## Objective

Establish a privacy-preserving time-capsule encryption layer that scales cross-chain. Track 62 enforces immutable, verifiable time-release encryption boundaries across shared networks without intermediate metadata disclosure. Builds directly upon the Track 39 time-locked recovery engine and Track 58 asset vesting locks, enabling nodes to lock encrypted matrices that can only be decrypted after a verified temporal duration passes and an M-of-N threshold committee certifies the temporal anchor validity, neutralizing single-node clock spoofing or premature data extraction.

## Scope

### Core primitives

- **PqcTimeLockedMatrixRouter** — time-locked payload manager that encapsulates encrypted data arrays behind verifiable delay functions (VDF) and post-quantum ML-KEM encapsulation envelopes.
- **MpcTemporalValidityVerifier** — multi-party validation engine that validates zero-knowledge proofs of elapsed duration, tying decryption cycles directly to verified Track 22 TimeAnchorEngine ticks.
- **Time-Lock Telemetry** — emits `TIME_LOCK_MATRIX_INITIALIZED` and `TEMPORAL_DECRYPTION_PROVE_VERIFIED` into the Track 29 ZK-rollup accumulator.

### Canonical time-locked matrix initialization payload wire layout

```
TIMELOCK:<matrixId>:<sourceTenantId>:<encryptedPayloadHash>:<vdfDifficulty>:<releaseTimestamp>:<pqcSignatureScheme>:<submitterAttestationHash>:<committeeSignature>
```

### Canonical temporal decryption proof payload wire layout

```
TIMEPROOF:<proofId>:<matrixId>:<elapsedDurationSeconds>:<timeAnchorTick>:<zkProofHash>:<verifierRelayAttestationHash>:<partialSignature>
```

### Policy schema additions

- `pqTimeLockedMatrix`:
  - `minTimeDelaySeconds`: 3600
  - `minCommitteeQuorum`: 3
  - `maxPayloadBytes`: 1048576
  - `allowedPqcSignatureSchemes`: `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`
  - `requireSubmitterAttestation`: true
  - `requireVerifierRelayAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banPrematureOrMalformedProofs`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All time-locked matrix parameters—including minimum time delay seconds, minimum committee quorums, and max payload byte sizes—are managed dynamically via the dedicated `pqTimeLockedMatrix` stanza in the active `CryptoPolicyEngine` schema.
- Both the initializing submitter and the processing verifier node relays must pass `EnclaveAttestationClient.verify()` before a time-locked payload can be staged (Track 41 integration).
- The `PqcTimeLockedMatrixRouter` encapsulates encrypted data arrays behind verifiable delay functions (VDF) and post-quantum ML-KEM encapsulation envelopes, preventing premature data extraction.
- The `MpcTemporalValidityVerifier` validates zero-knowledge proofs of elapsed duration, tying decryption cycles directly to verified Track 22 TimeAnchorEngine ticks, neutralizing single-node clock spoofing.
- Peers broadcasting premature or malformed temporal decryption proofs are automatically banned when `banPrematureOrMalformedProofs` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `PqcTimeLockedMatrixRouter` initializes a time-locked matrix and emits `TIME_LOCK_MATRIX_INITIALIZED`.
- [ ] `MpcTemporalValidityVerifier` verifies a valid temporal decryption proof and emits `TEMPORAL_DECRYPTION_PROVE_VERIFIED`.
- [ ] `PqcTimeLockedMatrixRouter` releases payload after verified temporal duration passes.
- [ ] `CryptoPolicyEngine` validates a compliant `pqTimeLockedMatrix` configuration.

### Security / edge cases

- [ ] Reject time delay below `minTimeDelaySeconds`.
- [ ] Reject committee quorum below `minCommitteeQuorum`.
- [ ] Reject payload bytes exceeding `maxPayloadBytes`.
- [ ] Reject PQC signature scheme not in `allowedPqcSignatureSchemes`.
- [ ] Reject un-attested submitter.
- [ ] Reject un-attested verifier relay.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject premature decryption attempts before release timestamp.
- [ ] Reject malformed temporal proofs (missing zkProofHash, missing partialSignature).
- [ ] Reject duplicate matrix initializations.
- [ ] Automatically ban peers broadcasting premature or malformed temporal decryption proofs.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqTimeLockedMatrix` for `operation === 'pqTimeLockedMatrix'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pq-time-locked-matrix` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pq-time-locked-matrix`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a three-node committee with attested submitter and verifier relay, verify temporal decryption proof authentication after time anchor tick.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Extension scope (Track 62 Phase 2)

### New capabilities added

- **Lattice-based time-lock parameters** — each matrix now carries LWE-style lattice parameters (dimension, modulus, error bound, seed, lattice hash) for post-quantum time-lock difficulty.
- **ML-KEM encapsulation envelopes** — each matrix now carries an ML-KEM-768 encapsulated key and ciphertext, simulating post-quantum key encapsulation.
- **Matrix routing across time-lock nodes** — register routing nodes, route matrices through 3-node paths (auto-selected or explicit), track relay counts.
- **Committee signature aggregation** — BLS-style aggregate signature from partial committee signatures.
- **Lattice key pair generation** — generate and store lattice key pairs for ML-KEM operations.
- **Matrix expiration** — expire matrices that have passed their useful window.
- **Batch temporal verification** — verify multiple temporal proofs in a single batch call, with per-proof results and batch history tracking.
- **Partial signature aggregation** — aggregate partial signatures from committee members, with banned-peer rejection.
- **Slashing window validation** — validate that a proof timestamp falls within the slashing window (release timestamp + configurable window).
- **Slashing event recording** — record slash events with reason codes (premature, malformed, duplicate, insufficient duration).
- **Summary statistics** — both router and verifier expose `getStats()` methods.

### Extension test checklist

#### Positive paths

- [x] Matrix initialization includes lattice time-lock parameters.
- [x] Matrix initialization includes ML-KEM encapsulation envelope.
- [x] MATRIX_STATUS constants are exported.
- [x] Routing nodes can be registered.
- [x] Matrices can be routed through time-lock nodes (auto-selected path).
- [x] Matrices can be routed with explicit node path.
- [x] Committee signatures can be aggregated.
- [x] Lattice key pairs can be generated.
- [x] Matrices can be expired.
- [x] Batch verification processes multiple proofs.
- [x] Batch verification handles mixed valid/invalid proofs.
- [x] Partial signatures can be aggregated.
- [x] Slashing window validation works for in-window proofs.
- [x] Full init → route → aggregate → verify → batch flow works end-to-end.

#### Security / edge cases

- [x] Reject routing node with missing nodeId.
- [x] Reject duplicate routing node.
- [x] Reject routing node with missing enclaveId.
- [x] Reject routing unknown matrix.
- [x] Reject routing with insufficient nodes (< 2).
- [x] Reject routing with unavailable explicit node.
- [x] Reject routing already-routed matrix.
- [x] Reject signature aggregation with insufficient signatures.
- [x] Reject signature aggregation with no signatures.
- [x] Reject signature aggregation for unknown matrix.
- [x] Reject duplicate lattice key.
- [x] Reject expiring unknown matrix.
- [x] Reject double-expiring a matrix.
- [x] Reject empty batch.
- [x] Reject batch exceeding max size.
- [x] Reject partial signature aggregation with banned peer.
- [x] Reject partial signature aggregation with no signatures.
- [x] Reject partial signature aggregation with missing matrixId.
- [x] Detect proof outside slashing window.
- [x] Reject slashing window validation for unknown matrix.
- [x] Reject slashing window validation with invalid timestamp.
- [x] Record slashes for premature proofs.
- [x] PROOF_STATUS and SLASH_REASON constants are exported.

## Files changed (Phase 2 extension)

- `ai-platform/server/lib/hsm-adapter/pqc-time-locked-matrix-router.cjs` *(extended)*
- `ai-platform/server/lib/hsm-adapter/mpc-temporal-validity-verifier.cjs` *(extended)*
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs` *(12 new counters)*
- `ai-platform/server/lib/hsm-adapter/__tests__/pqc-time-locked-matrix-extensions.test.cjs` *(new, 46 tests)*

## Approval

Phase 1: Approved and merged (15 tests).
Phase 2: Pending Validator review.
