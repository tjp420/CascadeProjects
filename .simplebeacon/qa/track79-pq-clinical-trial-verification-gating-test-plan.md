# Track 79: Post-Quantum Zero-Knowledge Cross-Chain Multi-Party Decentralized Clinical Trial Verification and Patient Cohort Gating Matrix — Test Plan

## Objective

Establish a privacy-preserving decentralized clinical trial verification and patient cohort gating layer that scales cross-chain. Track 79 enforces non-repudiable clinical trial protocol attestation boundaries across shared networks while completely preventing patient profiling and investigator PII harvesting loops. Combines lattice-based verifiable credentials with homomorphically split Pedersen commitments over clinical trial protocol hashes, patient cohort metrics, and investigator identity hashes. This architecture enables sovereign health authorities, institutional review boards (IRBs), and clinical research organizations (CROs) to verify hidden clinical trial claims (cohort size thresholds, adverse event rates, endpoint efficacy metrics) via non-interactive zero-knowledge range proofs without exposing raw patient records, investigator PII, or cross-organization trial tracking indices.

## Scope

### Core primitives

- **PqcClinicalTrialVerificationGatingHub** — interlocking clinical trial coordinator that instantiates multi-party trial oversight verification pools using homomorphically split Pedersen commitments over clinical trial protocol hashes, patient cohort metrics, and investigator identity hashes.
- **ZkTrialClaimValidator** — succinct trial verifier that processes non-interactive zero-knowledge range and cohort proofs, ensuring that an entity's hidden clinical trial claim status strictly satisfies policy-defined thresholds without disclosing individual patient or investigator attributes.
- **Clinical Trial Gating Lifecycle Telemetry** — emits `CLINICAL_TRIAL_GATING_POOL_INITIALIZED`, `ZK_TRIAL_CLAIM_VERIFIED`, and `COHORT_ACCREDITATION_COMPLETED` into the Track 29 ZK-rollup accumulator.

### Canonical clinical trial gating pool initialization payload wire layout

```
TRIALGATE:<poolId>:<sourceTenantId>:<targetChainId>:<blindedProtocolHashCommitment>:<blindedCohortMetricCommitment>:<blindedInvestigatorHashCommitment>:<trialDurationSeconds>:<cohortMetricDepth>:<pqcSignatureScheme>:<trialOversightInitializerAttestationHash>:<committeeSignature>
```

### Canonical clinical trial claim verification payload wire layout

```
TRIALCLAIM:<claimId>:<poolId>:<blindedCohortMetricCommitment>:<blindedClaimValueCommitment>:<zkTrialRangeProofHash>:<clearingCommitteeAttestationHash>:<partialSignature>
```

### Canonical cohort accreditation completion payload wire layout

```
TRIALCOMPLETE:<completionId>:<poolId>:<claimSignatureCount>:<pqcSignatureScheme>:<committeeSignatures>
```

### Policy schema additions

- `pqClinicalTrialGating`:
  - `minTrialOversightQuorum`: 3
  - `maxTrialDurationSeconds`: 94608000
  - `maxCohortMetricDepth`: 24
  - `allowedPqcSignatureSchemes`: `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`
  - `requireTrialOversightInitializerAttestation`: true
  - `requireClearingCommitteeAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banMalformedOrOutOfOrderTrialClaims`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All decentralized clinical trial gating criteria—including minimum trial oversight quorums, maximum trial duration lifetime bounds, allowed cohort metric depth parameters, and post-quantum signature schemes—are managed dynamically via the dedicated `pqClinicalTrialGating` stanza in the active `CryptoPolicyEngine` schema.
- Both the trial-oversight-initializing endpoint and the processing clearing committee relays must pass `EnclaveAttestationClient.verify()` before a state transition can be signed (Track 41 integration).
- The `PqcClinicalTrialVerificationGatingHub` instantiates multi-party trial oversight verification pools using homomorphically split Pedersen commitments over clinical trial protocol hashes, patient cohort metrics, and investigator identity hashes, preventing patient profiling and investigator PII harvesting loops.
- The `ZkTrialClaimValidator` processes non-interactive zero-knowledge range and cohort proofs, ensuring that an entity's hidden clinical trial claim status strictly satisfies policy-defined thresholds without disclosing individual patient or investigator attributes.
- Peers broadcasting malformed or out-of-order trial claims are automatically banned when `banMalformedOrOutOfOrderTrialClaims` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `PqcClinicalTrialVerificationGatingHub` initializes a clinical trial gating pool and emits `CLINICAL_TRIAL_GATING_POOL_INITIALIZED`.
- [ ] `ZkTrialClaimValidator` verifies a clinical trial claim and emits `ZK_TRIAL_CLAIM_VERIFIED`.
- [ ] `PqcClinicalTrialVerificationGatingHub` completes cohort accreditation after quorum and emits `COHORT_ACCREDITATION_COMPLETED`.
- [ ] `CryptoPolicyEngine` validates a compliant `pqClinicalTrialGating` configuration.

### Security / edge cases

- [ ] Reject trial oversight quorum below `minTrialOversightQuorum`.
- [ ] Reject trial duration seconds exceeding `maxTrialDurationSeconds`.
- [ ] Reject cohort metric depth exceeding `maxCohortMetricDepth`.
- [ ] Reject PQC signature scheme not in `allowedPqcSignatureSchemes`.
- [ ] Reject un-attested trial oversight initializer.
- [ ] Reject un-attested clearing committee.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject trial claims exceeding the trial duration window.
- [ ] Reject malformed trial claims (missing zkTrialRangeProofHash, missing partialSignature).
- [ ] Reject duplicate pool initializations.
- [ ] Reject cohort accreditation completion before trial claim verification.
- [ ] Reject cohort accreditation completion with insufficient quorum.
- [ ] Automatically ban peers broadcasting malformed or out-of-order trial claims.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqClinicalTrialGating` for `operation === 'pqClinicalTrialGating'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pq-clinical-trial-verification-gating` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pq-clinical-trial-verification-gating`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a three-signer trial oversight quorum with attested trial oversight initializer and clearing committee relay, verify trial claim authentication and cohort accreditation completion after quorum.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-clinical-trial-verification-gating-hub.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-trial-claim-validator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-clinical-trial-verification-gating.test.cjs` *(new)*

## Approval

Pending Validator review.
