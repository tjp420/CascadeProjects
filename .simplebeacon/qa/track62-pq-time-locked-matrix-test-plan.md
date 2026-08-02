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

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-time-locked-matrix-router.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/mpc-temporal-validity-verifier.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-time-locked-matrix.test.cjs` *(new)*

## Approval

Pending Validator review.
