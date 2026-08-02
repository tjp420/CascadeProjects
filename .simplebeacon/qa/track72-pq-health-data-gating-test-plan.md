# Track 72: Post-Quantum Zero-Knowledge Decentralized Healthcare Record Anonymization Matrix — Test Plan

## Objective

Establish a privacy-preserving decentralized healthcare record anonymization and attestation proof gating layer that scales cross-chain. Track 72 enforces non-repudiable medical record attribute validation boundaries across shared networks while completely preventing patient profiling and data harvesting loops. Extends the Track 71 zero-knowledge gating architectures into high-compliance, zero-trust medical informatics. This architecture allows sovereign healthcare databases to initialize diagnostic attestation pools across independent networks, enabling healthcare providers and research entities to verify hidden patient diagnostic conditions and medical compliance thresholds via non-interactive zero-knowledge range and multi-attribute proofs without exposing raw Electronic Health Record (EHR) payload data, protected health identifiers (PHI), or cross-tenant patient tracking indices.

## Scope

### Core primitives

- **PqcHealthDataGatingHub** — interlocking health data coordinator that instantiates multi-party diagnostic verification pools using homomorphically split Pedersen commitments over raw medical records, diagnostic observation values, and patient identity hashes.
- **ZkHealthAttributeValidator** — succinct diagnostic verifier that processes non-interactive zero-knowledge range and condition proofs, ensuring that an entity's hidden medical claim status strictly satisfies policy-defined thresholds without disclosing individual health traits.
- **Medical Gating Lifecycle Telemetry** — emits `HEALTH_GATING_POOL_INITIALIZED`, `ZK_HEALTH_CLAIM_VERIFIED`, and `HEALTH_RECORD_GATING_COMPLETED` into the Track 29 ZK-rollup accumulator.

### Canonical health data pool initialization payload wire layout

```
HEALTHGATE:<poolId>:<sourceTenantId>:<targetChainId>:<blindedRawMedicalRecordCommitment>:<blindedDiagnosticObservationCommitment>:<blindedPatientIdentityHashCommitment>:<recordExpirationLifetimeSeconds>:<diagnosticObservationDepth>:<pqcSignatureScheme>:<recordInitializerAttestationHash>:<committeeSignature>
```

### Canonical health claim verification payload wire layout

```
HEALTHCLAIM:<claimId>:<poolId>:<blindedDiagnosticObservationCommitment>:<blindedClaimValueCommitment>:<zkHealthRangeProofHash>:<clearingCommitteeAttestationHash>:<partialSignature>
```

### Canonical health record gating completion payload wire layout

```
HEALTHGATECOMPLETE:<completionId>:<poolId>:<claimSignatureCount>:<pqcSignatureScheme>:<committeeSignatures>
```

### Policy schema additions

- `pqHealthDataGating`:
  - `minVerificationQuorum`: 3
  - `maxRecordExpirationLifetimeSeconds`: 7776000
  - `maxDiagnosticObservationDepth`: 32
  - `allowedPqcSignatureSchemes`: `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`
  - `requireRecordInitializerAttestation`: true
  - `requireClearingCommitteeAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banMalformedOrOutOfOrderHealthClaims`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All decentralized healthcare gating criteria—including minimum verification quorums, maximum record expiration lifetime bounds, allowed medical diagnostic observation depths, and post-quantum signature schemes—are managed dynamically via the dedicated `pqHealthDataGating` stanza in the active `CryptoPolicyEngine` schema.
- Both the record-initializing endpoint and the processing clearing committee relays must pass `EnclaveAttestationClient.verify()` before a state transition can be signed (Track 41 integration).
- The `PqcHealthDataGatingHub` instantiates multi-party diagnostic verification pools using homomorphically split Pedersen commitments over raw medical records, diagnostic observation values, and patient identity hashes, preventing patient profiling and data harvesting loops.
- The `ZkHealthAttributeValidator` processes non-interactive zero-knowledge range and condition proofs, ensuring that an entity's hidden medical claim status strictly satisfies policy-defined thresholds without disclosing individual health traits.
- Peers broadcasting malformed or out-of-order health attribute claims are automatically banned when `banMalformedOrOutOfOrderHealthClaims` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `PqcHealthDataGatingHub` initializes a health gating pool and emits `HEALTH_GATING_POOL_INITIALIZED`.
- [ ] `ZkHealthAttributeValidator` verifies a health claim and emits `ZK_HEALTH_CLAIM_VERIFIED`.
- [ ] `PqcHealthDataGatingHub` completes health record gating after quorum and emits `HEALTH_RECORD_GATING_COMPLETED`.
- [ ] `CryptoPolicyEngine` validates a compliant `pqHealthDataGating` configuration.

### Security / edge cases

- [ ] Reject verification quorum below `minVerificationQuorum`.
- [ ] Reject record expiration lifetime seconds exceeding `maxRecordExpirationLifetimeSeconds`.
- [ ] Reject diagnostic observation depth exceeding `maxDiagnosticObservationDepth`.
- [ ] Reject PQC signature scheme not in `allowedPqcSignatureSchemes`.
- [ ] Reject un-attested record initializer.
- [ ] Reject un-attested clearing committee.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject health claims exceeding the record expiration lifetime window.
- [ ] Reject malformed health claims (missing zkHealthRangeProofHash, missing partialSignature).
- [ ] Reject duplicate pool initializations.
- [ ] Reject health record gating completion before health claim verification.
- [ ] Reject health record gating completion with insufficient quorum.
- [ ] Automatically ban peers broadcasting malformed or out-of-order health claims.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqHealthDataGating` for `operation === 'pqHealthDataGating'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pq-health-data-gating` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pq-health-data-gating`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a three-signer verification quorum with attested record initializer and clearing committee relay, verify health claim authentication and health record gating completion after quorum.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-health-data-gating-hub.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-health-attribute-validator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-health-data-gating.test.cjs` *(new)*

## Approval

Pending Validator review.
