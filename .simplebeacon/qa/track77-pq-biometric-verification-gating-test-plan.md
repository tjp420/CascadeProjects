# Track 77: Post-Quantum Zero-Knowledge Cross-Chain Multi-Party Decentralized Biometric Identity Verification and Liveness Attestation Gating Matrix — Test Plan

## Objective

Establish a privacy-preserving decentralized biometric identity verification and liveness attestation gating layer that scales cross-chain. Track 77 enforces non-repudiable biometric template protection boundaries across shared networks while completely preventing biometric template harvesting and subject profiling loops. Combines multi-party biometric verification with threshold fully homomorphic encryption (tFHE) over encrypted biometric templates combined with homomorphically split Pedersen commitments over biometric template hashes, liveness detection metrics, and subject identity hashes. This architecture enables sovereign identity providers and biometric attestation authorities to verify hidden biometric claims (liveness thresholds, template match scores, enrollment quality metrics) via non-interactive zero-knowledge range proofs without exposing raw biometric templates, subject PII, or cross-organization biometric tracking indices.

## Scope

### Core primitives

- **PqcBiometricVerificationGatingHub** — interlocking biometric verification coordinator that instantiates multi-party biometric authority verification pools using homomorphically split Pedersen commitments over biometric template hashes, liveness detection metrics, and subject identity hashes.
- **ZkBiometricClaimValidator** — succinct biometric verifier that processes non-interactive zero-knowledge range and liveness proofs, ensuring that an entity's hidden biometric claim status strictly satisfies policy-defined thresholds without disclosing individual biometric attributes.
- **Biometric Gating Lifecycle Telemetry** — emits `BIOMETRIC_GATING_POOL_INITIALIZED`, `ZK_BIOMETRIC_CLAIM_VERIFIED`, and `LIVENESS_ATTESTATION_ACCREDITATION_COMPLETED` into the Track 29 ZK-rollup accumulator.

### Canonical biometric gating pool initialization payload wire layout

```
BIOMETRICGATE:<poolId>:<sourceTenantId>:<targetChainId>:<blindedTemplateHashCommitment>:<blindedLivenessMetricCommitment>:<blindedSubjectHashCommitment>:<templateExpirationSeconds>:<livenessMetricDepth>:<pqcSignatureScheme>:<biometricAuthorityInitializerAttestationHash>:<committeeSignature>
```

### Canonical biometric claim verification payload wire layout

```
BIOMETRICCLAIM:<claimId>:<poolId>:<blindedLivenessMetricCommitment>:<blindedClaimValueCommitment>:<zkBiometricRangeProofHash>:<clearingCommitteeAttestationHash>:<partialSignature>
```

### Canonical liveness attestation accreditation completion payload wire layout

```
BIOMETRICCOMPLETE:<completionId>:<poolId>:<claimSignatureCount>:<pqcSignatureScheme>:<committeeSignatures>
```

### Policy schema additions

- `pqBiometricGating`:
  - `minBiometricAuthorityQuorum`: 3
  - `maxTemplateExpirationSeconds`: 15552000
  - `maxLivenessMetricDepth`: 16
  - `allowedPqcSignatureSchemes`: `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`
  - `requireBiometricAuthorityInitializerAttestation`: true
  - `requireClearingCommitteeAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banMalformedOrOutOfOrderBiometricClaims`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All decentralized biometric gating criteria—including minimum biometric authority quorums, maximum template expiration lifetime bounds, allowed liveness metric depth parameters, and post-quantum signature schemes—are managed dynamically via the dedicated `pqBiometricGating` stanza in the active `CryptoPolicyEngine` schema.
- Both the biometric-authority-initializing endpoint and the processing clearing committee relays must pass `EnclaveAttestationClient.verify()` before a state transition can be signed (Track 41 integration).
- The `PqcBiometricVerificationGatingHub` instantiates multi-party biometric authority verification pools using homomorphically split Pedersen commitments over biometric template hashes, liveness detection metrics, and subject identity hashes, preventing biometric template harvesting and subject profiling loops.
- The `ZkBiometricClaimValidator` processes non-interactive zero-knowledge range and liveness proofs, ensuring that an entity's hidden biometric claim status strictly satisfies policy-defined thresholds without disclosing individual biometric attributes.
- Peers broadcasting malformed or out-of-order biometric claims are automatically banned when `banMalformedOrOutOfOrderBiometricClaims` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `PqcBiometricVerificationGatingHub` initializes a biometric gating pool and emits `BIOMETRIC_GATING_POOL_INITIALIZED`.
- [ ] `ZkBiometricClaimValidator` verifies a biometric claim and emits `ZK_BIOMETRIC_CLAIM_VERIFIED`.
- [ ] `PqcBiometricVerificationGatingHub` completes liveness attestation accreditation after quorum and emits `LIVENESS_ATTESTATION_ACCREDITATION_COMPLETED`.
- [ ] `CryptoPolicyEngine` validates a compliant `pqBiometricGating` configuration.

### Security / edge cases

- [ ] Reject biometric authority quorum below `minBiometricAuthorityQuorum`.
- [ ] Reject template expiration seconds exceeding `maxTemplateExpirationSeconds`.
- [ ] Reject liveness metric depth exceeding `maxLivenessMetricDepth`.
- [ ] Reject PQC signature scheme not in `allowedPqcSignatureSchemes`.
- [ ] Reject un-attested biometric authority initializer.
- [ ] Reject un-attested clearing committee.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject biometric claims exceeding the template expiration window.
- [ ] Reject malformed biometric claims (missing zkBiometricRangeProofHash, missing partialSignature).
- [ ] Reject duplicate pool initializations.
- [ ] Reject liveness attestation accreditation completion before biometric claim verification.
- [ ] Reject liveness attestation accreditation completion with insufficient quorum.
- [ ] Automatically ban peers broadcasting malformed or out-of-order biometric claims.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqBiometricGating` for `operation === 'pqBiometricGating'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pq-biometric-verification-gating` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pq-biometric-verification-gating`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a three-signer biometric authority quorum with attested biometric authority initializer and clearing committee relay, verify biometric claim authentication and liveness attestation accreditation completion after quorum.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-biometric-verification-gating-hub.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-biometric-claim-validator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-biometric-verification-gating.test.cjs` *(new)*

## Approval

Pending Validator review.
