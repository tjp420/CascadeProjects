# Track 73: Post-Quantum Zero-Knowledge Cross-Chain Multi-Party Decentralized Education Credential Verification and Accreditation Gating Matrix — Test Plan

## Objective

Establish a privacy-preserving decentralized education credential verification and accreditation gating layer that scales cross-chain. Track 73 enforces non-repudiable academic credential validation boundaries across shared networks while completely preventing student profiling and transcript harvesting loops. Combines lattice-based ring signatures with homomorphically split Pedersen commitments over academic transcripts, accreditation metrics, and institution identity hashes. This architecture enables sovereign education authorities and accreditation bodies to verify hidden academic claims (degree completion, GPA thresholds, institution accreditation status) via non-interactive zero-knowledge range proofs without exposing raw transcript data, student PII, or cross-institution tracking indices.

## Scope

### Core primitives

- **PqcEducationCredentialGatingHub** — interlocking education credential coordinator that instantiates multi-party accreditation verification pools using homomorphically split Pedersen commitments over academic transcripts, accreditation metrics, and institution identity hashes.
- **ZkAcademicCredentialValidator** — succinct academic verifier that processes non-interactive zero-knowledge range and accreditation proofs, ensuring that an entity's hidden academic claim status strictly satisfies policy-defined thresholds without disclosing individual academic attributes.
- **Education Gating Lifecycle Telemetry** — emits `EDUCATION_GATING_POOL_INITIALIZED`, `ZK_ACADEMIC_CLAIM_VERIFIED`, and `CREDENTIAL_ACCREDITATION_COMPLETED` into the Track 29 ZK-rollup accumulator.

### Canonical education gating pool initialization payload wire layout

```
EDUGATE:<poolId>:<sourceTenantId>:<targetChainId>:<blindedTranscriptCommitment>:<blindedAccreditationMetricCommitment>:<blindedInstitutionHashCommitment>:<transcriptExpirationSeconds>:<credentialDepth>:<pqcSignatureScheme>:<institutionInitializerAttestationHash>:<committeeSignature>
```

### Canonical academic claim verification payload wire layout

```
EDUCLAIM:<claimId>:<poolId>:<blindedAccreditationMetricCommitment>:<blindedClaimValueCommitment>:<zkAcademicRangeProofHash>:<clearingCommitteeAttestationHash>:<partialSignature>
```

### Canonical credential accreditation completion payload wire layout

```
EDUGATECOMPLETE:<completionId>:<poolId>:<claimSignatureCount>:<pqcSignatureScheme>:<committeeSignatures>
```

### Policy schema additions

- `pqEducationGating`:
  - `minAccreditationQuorum`: 3
  - `maxTranscriptExpirationSeconds`: 31536000
  - `maxAcademicCredentialDepth`: 24
  - `allowedPqcSignatureSchemes`: `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`
  - `requireInstitutionInitializerAttestation`: true
  - `requireClearingCommitteeAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banMalformedOrOutOfOrderCredentialClaims`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All decentralized education gating criteria—including minimum accreditation quorums, maximum transcript expiration lifetime bounds, allowed academic credential depth parameters, and post-quantum signature schemes—are managed dynamically via the dedicated `pqEducationGating` stanza in the active `CryptoPolicyEngine` schema.
- Both the institution-initializing endpoint and the processing clearing committee relays must pass `EnclaveAttestationClient.verify()` before a state transition can be signed (Track 41 integration).
- The `PqcEducationCredentialGatingHub` instantiates multi-party accreditation verification pools using homomorphically split Pedersen commitments over academic transcripts, accreditation metrics, and institution identity hashes, preventing student profiling and transcript harvesting loops.
- The `ZkAcademicCredentialValidator` processes non-interactive zero-knowledge range and accreditation proofs, ensuring that an entity's hidden academic claim status strictly satisfies policy-defined thresholds without disclosing individual academic attributes.
- Peers broadcasting malformed or out-of-order credential claims are automatically banned when `banMalformedOrOutOfOrderCredentialClaims` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `PqcEducationCredentialGatingHub` initializes an education gating pool and emits `EDUCATION_GATING_POOL_INITIALIZED`.
- [ ] `ZkAcademicCredentialValidator` verifies an academic claim and emits `ZK_ACADEMIC_CLAIM_VERIFIED`.
- [ ] `PqcEducationCredentialGatingHub` completes credential accreditation after quorum and emits `CREDENTIAL_ACCREDITATION_COMPLETED`.
- [ ] `CryptoPolicyEngine` validates a compliant `pqEducationGating` configuration.

### Security / edge cases

- [ ] Reject accreditation quorum below `minAccreditationQuorum`.
- [ ] Reject transcript expiration seconds exceeding `maxTranscriptExpirationSeconds`.
- [ ] Reject academic credential depth exceeding `maxAcademicCredentialDepth`.
- [ ] Reject PQC signature scheme not in `allowedPqcSignatureSchemes`.
- [ ] Reject un-attested institution initializer.
- [ ] Reject un-attested clearing committee.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject academic claims exceeding the transcript expiration window.
- [ ] Reject malformed academic claims (missing zkAcademicRangeProofHash, missing partialSignature).
- [ ] Reject duplicate pool initializations.
- [ ] Reject credential accreditation completion before academic claim verification.
- [ ] Reject credential accreditation completion with insufficient quorum.
- [ ] Automatically ban peers broadcasting malformed or out-of-order credential claims.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqEducationGating` for `operation === 'pqEducationGating'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pq-education-credential-gating` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pq-education-credential-gating`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a three-signer accreditation quorum with attested institution initializer and clearing committee relay, verify academic claim authentication and credential accreditation completion after quorum.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-education-credential-gating-hub.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-academic-credential-validator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-education-credential-gating.test.cjs` *(new)*

## Approval

Pending Validator review.
