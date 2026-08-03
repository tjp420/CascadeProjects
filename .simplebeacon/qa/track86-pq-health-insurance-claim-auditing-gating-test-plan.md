# Track 86: Post-Quantum Zero-Knowledge Cross-Chain Multi-Party Decentralized Health-Insurance Claim Auditing and Actuarial Risk Verification Gating Matrix — Test Plan

## Objective

Establish a privacy-preserving decentralized health-insurance claim auditing and actuarial risk verification gating layer that scales cross-chain. Track 86 enforces non-repudiable insurance authority endpoint attestation boundaries across shared networks while completely preventing diagnostic billing sequence profiling and actuarial risk code harvesting loops. Combines threshold fully homomorphic encryption (tFHE) with homomorphically split Pedersen commitments over encrypted diagnostic billing sequences, actuarial risk codes, and policy payout commitment hashes. This architecture enables sovereign insurance authorities, actuarial review committees, and claims auditors to verify hidden claim assertions (billing threshold bounds, risk code quorum metrics, payout accreditation status) via non-interactive zero-knowledge range proofs without exposing raw diagnostic billing sequences, actuarial risk profiles, or cross-organization claims tracking indices.

## Scope

### Core primitives

- **PqcHealthInsuranceClaimAuditingGatingHub** — interlocking insurance authority endpoint coordinator that instantiates multi-party insurance authority verification pools using homomorphically split Pedersen commitments over encrypted diagnostic billing sequences, actuarial risk codes, and policy payout commitment hashes.
- **ZkInsuranceClaimValidator** — succinct insurance claim verifier that processes non-interactive zero-knowledge range and billing proofs with tFHE verification, ensuring that an entity's hidden claim status strictly satisfies policy-defined thresholds without disclosing individual claim or actuarial attributes.
- **Insurance Gating Lifecycle Telemetry** — emits `INSURANCE_GATING_POOL_INITIALIZED`, `ZK_CLAIM_AUDIT_VERIFIED`, and `ACTUARIAL_ACCREDITATION_COMPLETED` into the Track 29 ZK-rollup accumulator.

### Canonical insurance gating pool initialization payload wire layout

```
INSURANCEGATE:<poolId>:<sourceTenantId>:<targetChainId>:<blindedDiagnosticBillingCommitment>:<blindedActuarialRiskCodeCommitment>:<blindedPayoutCommitment>:<claimWindowSeconds>:<billingSequenceDepth>:<pqcSignatureScheme>:<insuranceAuthorityInitializerAttestationHash>:<committeeSignature>
```

### Canonical insurance claim verification payload wire layout

```
INSURANCECLAIM:<claimId>:<poolId>:<blindedActuarialRiskCodeCommitment>:<blindedClaimValueCommitment>:<zkInsuranceRangeProofHash>:<actuarialCommitteeAttestationHash>:<tFheProof>
```

### Canonical actuarial accreditation completion payload wire layout

```
INSURANCECOMPLETE:<completionId>:<poolId>:<claimSignatureCount>:<pqcSignatureScheme>:<committeeSignatures>
```

### Policy schema additions

- `pqInsuranceGating`:
  - `minClaimsAuditQuorum`: 3
  - `maxClaimWindowSeconds`: 5184000
  - `maxBillingSequenceDepth`: 24
  - `allowedPqcSignatureSchemes`: `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`
  - `requireInsuranceAuthorityInitializerAttestation`: true
  - `requireActuarialCommitteeAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banMalformedOrOutOfOrderClaims`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All decentralized insurance claim auditing criteria—including minimum claims audit quorums, maximum claim window lifetime bounds, allowed billing sequence depth parameters, and post-quantum signature schemes—are managed dynamically via the dedicated `pqInsuranceGating` stanza in the active `CryptoPolicyEngine` schema.
- Both the insurance-authority-initializing endpoint and the processing actuarial committee relays must pass `EnclaveAttestationClient.verify()` before a state transition can be signed (Track 41 integration).
- The `PqcHealthInsuranceClaimAuditingGatingHub` instantiates multi-party insurance authority verification pools using homomorphically split Pedersen commitments over encrypted diagnostic billing sequences, actuarial risk codes, and policy payout commitment hashes, preventing diagnostic billing sequence profiling and actuarial risk code harvesting loops.
- The `ZkInsuranceClaimValidator` processes non-interactive zero-knowledge range and billing proofs with tFHE verification, ensuring that an entity's hidden claim status strictly satisfies policy-defined thresholds without disclosing individual claim or actuarial attributes.
- Peers broadcasting malformed or out-of-order insurance claims are automatically banned when `banMalformedOrOutOfOrderClaims` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.
- Domain isolation from Track 47 (`pqHealthDataGating`): Track 47 covers health data record access control (diagnostic observation depth, record expiration). Track 86 covers insurance claim financial auditing (billing sequences, actuarial risk codes, payout commitments). No overlap in primitives, telemetry events, or canonical payload prefixes.

## Test checklist

### Positive paths

- [ ] `PqcHealthInsuranceClaimAuditingGatingHub` initializes an insurance gating pool and emits `INSURANCE_GATING_POOL_INITIALIZED`.
- [ ] `ZkInsuranceClaimValidator` verifies an insurance claim and emits `ZK_CLAIM_AUDIT_VERIFIED`.
- [ ] `PqcHealthInsuranceClaimAuditingGatingHub` completes actuarial accreditation after quorum and emits `ACTUARIAL_ACCREDITATION_COMPLETED`.
- [ ] `CryptoPolicyEngine` validates a compliant `pqInsuranceGating` configuration.

### Security / edge cases

- [ ] Reject claims audit quorum below `minClaimsAuditQuorum`.
- [ ] Reject claim window seconds exceeding `maxClaimWindowSeconds`.
- [ ] Reject billing sequence depth exceeding `maxBillingSequenceDepth`.
- [ ] Reject PQC signature scheme not in `allowedPqcSignatureSchemes`.
- [ ] Reject un-attested insurance authority initializer.
- [ ] Reject un-attested actuarial committee.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject insurance claims exceeding the claim window.
- [ ] Reject malformed insurance claims (missing zkInsuranceRangeProofHash, missing tFheProof).
- [ ] Reject duplicate pool initializations.
- [ ] Reject actuarial accreditation completion before claim audit verification.
- [ ] Reject actuarial accreditation completion with insufficient quorum.
- [ ] Automatically ban peers broadcasting malformed or out-of-order insurance claims.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqInsuranceGating` for `operation === 'pqInsuranceGating'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pq-health-insurance-claim-auditing-gating` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pq-health-insurance-claim-auditing-gating`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a three-signer actuarial quorum with attested insurance authority initializer and actuarial committee relay, verify insurance claim authentication and actuarial accreditation completion after quorum.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules, domain isolation from Track 47.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-health-insurance-claim-auditing-gating-hub.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-insurance-claim-validator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-health-insurance-claim-auditing-gating.test.cjs` *(new)*

## Approval

Pending Validator review.
