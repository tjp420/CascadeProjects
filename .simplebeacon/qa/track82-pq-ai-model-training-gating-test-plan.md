# Track 82: Post-Quantum Zero-Knowledge Cross-Chain Multi-Party Decentralized AI Model Training Verification and Dataset Provenance Gating Matrix — Test Plan

## Objective

Establish a privacy-preserving decentralized AI model training verification and dataset provenance gating layer that scales cross-chain. Track 82 enforces non-repudiable training authority attestation boundaries across shared networks while completely preventing model weight profiling and dataset content harvesting loops. Combines lattice-based verifiable credentials with homomorphically split Pedersen commitments over model weight commitment hashes, dataset provenance hashes, and training metric proofs. This architecture enables sovereign AI safety authorities, model audit committees, and dataset providers to verify hidden training claims (dataset integrity thresholds, training round bounds, model parameter accreditation metrics) via non-interactive zero-knowledge range proofs without exposing raw model weights, dataset contents, or cross-organization training tracking indices.

## Scope

### Core primitives

- **PqcAiModelTrainingGatingHub** — interlocking training authority coordinator that instantiates multi-party training oversight verification pools using homomorphically split Pedersen commitments over model weight commitment hashes, dataset provenance hashes, and training metric proofs.
- **ZkTrainingClaimValidator** — succinct training verifier that processes non-interactive zero-knowledge range and provenance proofs, ensuring that an entity's hidden training claim status strictly satisfies policy-defined thresholds without disclosing individual model or dataset attributes.
- **Training Gating Lifecycle Telemetry** — emits `TRAINING_GATING_POOL_INITIALIZED`, `ZK_TRAINING_CLAIM_VERIFIED`, and `MODEL_ACCREDITATION_COMPLETED` into the Track 29 ZK-rollup accumulator.

### Canonical training gating pool initialization payload wire layout

```
TRAINGATE:<poolId>:<sourceTenantId>:<targetChainId>:<blindedModelWeightCommitment>:<blindedDatasetProvenanceCommitment>:<blindedTrainingMetricCommitment>:<trainingWindowSeconds>:<provenanceDepth>:<pqcSignatureScheme>:<trainingAuthorityInitializerAttestationHash>:<committeeSignature>
```

### Canonical training claim verification payload wire layout

```
TRAINCLAIM:<claimId>:<poolId>:<blindedDatasetProvenanceCommitment>:<blindedClaimValueCommitment>:<zkTrainingRangeProofHash>:<modelAuditCommitteeAttestationHash>:<partialSignature>
```

### Canonical model accreditation completion payload wire layout

```
TRAINCOMPLETE:<completionId>:<poolId>:<claimSignatureCount>:<pqcSignatureScheme>:<committeeSignatures>
```

### Policy schema additions

- `pqTrainingGating`:
  - `minTrainingOversightQuorum`: 3
  - `maxTrainingWindowSeconds`: 63072000
  - `maxProvenanceDepth`: 64
  - `allowedPqcSignatureSchemes`: `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`
  - `requireTrainingAuthorityInitializerAttestation`: true
  - `requireModelAuditCommitteeAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banMalformedOrOutOfOrderTrainingClaims`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All decentralized training gating criteria—including minimum training oversight quorums, maximum training window lifetime bounds, allowed provenance depth parameters, and post-quantum signature schemes—are managed dynamically via the dedicated `pqTrainingGating` stanza in the active `CryptoPolicyEngine` schema.
- Both the training-authority-initializing endpoint and the processing model audit committee relays must pass `EnclaveAttestationClient.verify()` before a state transition can be signed (Track 41 integration).
- The `PqcAiModelTrainingGatingHub` instantiates multi-party training oversight verification pools using homomorphically split Pedersen commitments over model weight commitment hashes, dataset provenance hashes, and training metric proofs, preventing model weight profiling and dataset content harvesting loops.
- The `ZkTrainingClaimValidator` processes non-interactive zero-knowledge range and provenance proofs, ensuring that an entity's hidden training claim status strictly satisfies policy-defined thresholds without disclosing individual model or dataset attributes.
- Peers broadcasting malformed or out-of-order training claims are automatically banned when `banMalformedOrOutOfOrderTrainingClaims` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `PqcAiModelTrainingGatingHub` initializes a training gating pool and emits `TRAINING_GATING_POOL_INITIALIZED`.
- [ ] `ZkTrainingClaimValidator` verifies a training claim and emits `ZK_TRAINING_CLAIM_VERIFIED`.
- [ ] `PqcAiModelTrainingGatingHub` completes model accreditation after quorum and emits `MODEL_ACCREDITATION_COMPLETED`.
- [ ] `CryptoPolicyEngine` validates a compliant `pqTrainingGating` configuration.

### Security / edge cases

- [ ] Reject training oversight quorum below `minTrainingOversightQuorum`.
- [ ] Reject training window seconds exceeding `maxTrainingWindowSeconds`.
- [ ] Reject provenance depth exceeding `maxProvenanceDepth`.
- [ ] Reject PQC signature scheme not in `allowedPqcSignatureSchemes`.
- [ ] Reject un-attested training authority initializer.
- [ ] Reject un-attested model audit committee.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject training claims exceeding the training window.
- [ ] Reject malformed training claims (missing zkTrainingRangeProofHash, missing partialSignature).
- [ ] Reject duplicate pool initializations.
- [ ] Reject model accreditation completion before training claim verification.
- [ ] Reject model accreditation completion with insufficient quorum.
- [ ] Automatically ban peers broadcasting malformed or out-of-order training claims.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqTrainingGating` for `operation === 'pqTrainingGating'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pq-ai-model-training-gating` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pq-ai-model-training-gating`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a three-signer training oversight quorum with attested training authority initializer and model audit committee relay, verify training claim authentication and model accreditation completion after quorum.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-ai-model-training-gating-hub.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-training-claim-validator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-ai-model-training-gating.test.cjs` *(new)*

## Approval

Pending Validator review.
