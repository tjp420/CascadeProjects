# Track 74: Post-Quantum Zero-Knowledge Cross-Chain Multi-Party Decentralized Intellectual Property Patent Verification and Licensing Gating Matrix — Test Plan

## Objective

Establish a privacy-preserving decentralized intellectual property patent verification and licensing gating layer that scales cross-chain. Track 74 enforces non-repudiable patent claim validation boundaries across shared networks while completely preventing inventor profiling and patent harvesting loops. Combines lattice-based blind signatures with homomorphically split Pedersen commitments over patent claims, licensing metrics, and inventor identity hashes. This architecture enables sovereign patent offices and licensing authorities to verify hidden patent claims (priority dates, claim scope thresholds, inventor attribution) via non-interactive zero-knowledge range proofs without exposing raw patent filings, inventor PII, or cross-organization licensing tracking indices.

## Scope

### Core primitives

- **PqcPatentVerificationGatingHub** — interlocking patent verification coordinator that instantiates multi-party licensing verification pools using homomorphically split Pedersen commitments over patent claims, licensing metrics, and inventor identity hashes.
- **ZkPatentClaimValidator** — succinct patent verifier that processes non-interactive zero-knowledge range and priority proofs, ensuring that an entity's hidden patent claim status strictly satisfies policy-defined thresholds without disclosing individual patent attributes.
- **Patent Gating Lifecycle Telemetry** — emits `PATENT_GATING_POOL_INITIALIZED`, `ZK_PATENT_CLAIM_VERIFIED`, and `PATENT_LICENSE_ACCREDITATION_COMPLETED` into the Track 29 ZK-rollup accumulator.

### Canonical patent gating pool initialization payload wire layout

```
PATENTGATE:<poolId>:<sourceTenantId>:<targetChainId>:<blindedPatentClaimCommitment>:<blindedLicensingMetricCommitment>:<blindedInventorHashCommitment>:<patentExpirationSeconds>:<claimScopeDepth>:<pqcSignatureScheme>:<patentOfficeInitializerAttestationHash>:<committeeSignature>
```

### Canonical patent claim verification payload wire layout

```
PATENTCLAIM:<claimId>:<poolId>:<blindedLicensingMetricCommitment>:<blindedClaimValueCommitment>:<zkPatentRangeProofHash>:<clearingCommitteeAttestationHash>:<partialSignature>
```

### Canonical patent license accreditation completion payload wire layout

```
PATENTCOMPLETE:<completionId>:<poolId>:<claimSignatureCount>:<pqcSignatureScheme>:<committeeSignatures>
```

### Policy schema additions

- `pqPatentGating`:
  - `minLicensingQuorum`: 3
  - `maxPatentExpirationSeconds`: 47304000
  - `maxClaimScopeDepth`: 32
  - `allowedPqcSignatureSchemes`: `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`
  - `requirePatentOfficeInitializerAttestation`: true
  - `requireClearingCommitteeAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banMalformedOrOutOfOrderPatentClaims`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All decentralized patent gating criteria—including minimum licensing quorums, maximum patent expiration lifetime bounds, allowed claim scope depth parameters, and post-quantum signature schemes—are managed dynamically via the dedicated `pqPatentGating` stanza in the active `CryptoPolicyEngine` schema.
- Both the patent-office-initializing endpoint and the processing clearing committee relays must pass `EnclaveAttestationClient.verify()` before a state transition can be signed (Track 41 integration).
- The `PqcPatentVerificationGatingHub` instantiates multi-party licensing verification pools using homomorphically split Pedersen commitments over patent claims, licensing metrics, and inventor identity hashes, preventing inventor profiling and patent harvesting loops.
- The `ZkPatentClaimValidator` processes non-interactive zero-knowledge range and priority proofs, ensuring that an entity's hidden patent claim status strictly satisfies policy-defined thresholds without disclosing individual patent attributes.
- Peers broadcasting malformed or out-of-order patent claims are automatically banned when `banMalformedOrOutOfOrderPatentClaims` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `PqcPatentVerificationGatingHub` initializes a patent gating pool and emits `PATENT_GATING_POOL_INITIALIZED`.
- [ ] `ZkPatentClaimValidator` verifies a patent claim and emits `ZK_PATENT_CLAIM_VERIFIED`.
- [ ] `PqcPatentVerificationGatingHub` completes patent license accreditation after quorum and emits `PATENT_LICENSE_ACCREDITATION_COMPLETED`.
- [ ] `CryptoPolicyEngine` validates a compliant `pqPatentGating` configuration.

### Security / edge cases

- [ ] Reject licensing quorum below `minLicensingQuorum`.
- [ ] Reject patent expiration seconds exceeding `maxPatentExpirationSeconds`.
- [ ] Reject claim scope depth exceeding `maxClaimScopeDepth`.
- [ ] Reject PQC signature scheme not in `allowedPqcSignatureSchemes`.
- [ ] Reject un-attested patent office initializer.
- [ ] Reject un-attested clearing committee.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject patent claims exceeding the patent expiration window.
- [ ] Reject malformed patent claims (missing zkPatentRangeProofHash, missing partialSignature).
- [ ] Reject duplicate pool initializations.
- [ ] Reject patent license accreditation completion before patent claim verification.
- [ ] Reject patent license accreditation completion with insufficient quorum.
- [ ] Automatically ban peers broadcasting malformed or out-of-order patent claims.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqPatentGating` for `operation === 'pqPatentGating'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pq-patent-verification-gating` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pq-patent-verification-gating`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a three-signer licensing quorum with attested patent office initializer and clearing committee relay, verify patent claim authentication and patent license accreditation completion after quorum.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-patent-verification-gating-hub.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-patent-claim-validator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-patent-verification-gating.test.cjs` *(new)*

## Approval

Pending Validator review.
