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

## Extension scope (Track 73 Phase 2)

### New capabilities added

- **Credential depth rebalancing** — rebalance credential depth with increase/decrease directions, epoch tracking, and optional new credential depth updates.
- **Batch pool initialization** — initialize multiple education credential gating pools in a single batch call with per-pool results.
- **Committee signature aggregation** — BLS-style aggregate signature from partial committee signatures.
- **Pool cancellation** — cancel open pools (rejects if accredited/settled).
- **Cross-chain settlement coordination** — settle accredited pools on the target chain with settlement proof hashes.
- **Hardware-accelerated SNARK proof generation** — generate Groth16 SNARK proofs with configurable HW acceleration (GPU CUDA, FPGA, ASIC, simulated).
- **Batch academic claim verification** — verify multiple academic claims in a single batch call with per-claim results.
- **Partial signature aggregation** — aggregate partial signatures from clearing committee members with banned-peer rejection.
- **Slashing window validation** — validate claim timestamps within configurable slashing window.
- **Slashing event recording** — record slash events with reason codes (malformed_claim, duplicate_claim, transcript_expiration_out_of_bounds, pool_not_found, banned_peer, out_of_window).
- **Summary statistics** — both hub and validator expose `getStats()` methods.

### Extension test checklist

#### Positive paths

- [x] Credential depth rebalance with increase direction.
- [x] Credential depth rebalance with decrease direction.
- [x] Credential depth updates on rebalance.
- [x] Batch initialization creates multiple pools.
- [x] Cross-chain settlement works for accredited pools.
- [x] Committee signatures can be aggregated.
- [x] Pools can be cancelled.
- [x] HW-SNARK proof generation produces Groth16 proofs.
- [x] Batch academic claim verification processes multiple proofs.
- [x] Partial signatures can be aggregated.
- [x] Slashing window validation works for in-window claims.
- [x] Full init → rebalance → claim → accredit → settle flow works end-to-end.

#### Security / edge cases

- [x] Reject rebalance with invalid direction.
- [x] Reject rebalance with non-positive amount.
- [x] Reject rebalance with missing poolId.
- [x] Reject rebalance on accredited pool.
- [x] Reject batch init with empty array.
- [x] Reject batch init exceeding max size.
- [x] Reject settlement of non-accredited pool.
- [x] Reject settlement with mismatched chain.
- [x] Reject settlement with missing poolId.
- [x] Reject settlement with missing targetChainId.
- [x] Reject committee aggregation with insufficient signatures.
- [x] Reject committee aggregation with no signatures.
- [x] Reject committee aggregation for unknown pool.
- [x] Reject cancelling accredited pool.
- [x] Reject double cancellation.
- [x] Reject cancelling unknown pool.
- [x] Reject HW-SNARK proof generation with missing poolId.
- [x] Reject HW-SNARK proof generation with missing values.
- [x] Reject HW-SNARK proof generation for unknown pool.
- [x] Reject empty batch academic claim verification.
- [x] Reject batch academic claim verification exceeding max size.
- [x] Reject partial signature aggregation with banned peer.
- [x] Reject partial signature aggregation with insufficient signatures.
- [x] Reject partial signature aggregation with missing poolId.
- [x] Detect claim outside slashing window.
- [x] Reject slashing window validation for unknown pool.
- [x] Reject slashing window validation with invalid timestamp.
- [x] Reject slashing window validation with missing poolId.
- [x] Record slashes for malformed claims.
- [x] Record slashes for out-of-bounds transcript expiration.
- [x] Record slashes for duplicate claims.
- [x] CLAIM_STATUS, SLASH_REASON, HW_ACCEL_TYPES, POOL_STATUS, REBALANCE_DIRECTION constants exported.

## Files changed (Phase 2 extension)

- `ai-platform/server/lib/hsm-adapter/pqc-education-credential-gating-hub.cjs` *(extended)*
- `ai-platform/server/lib/hsm-adapter/zk-academic-credential-validator.cjs` *(extended)*
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs` *(14 new counters)*
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-education-credential-gating-extensions.test.cjs` *(new, 54 tests)*

## Approval

Phase 1: Approved and merged (15 tests).
Phase 2: Pending Validator review.
