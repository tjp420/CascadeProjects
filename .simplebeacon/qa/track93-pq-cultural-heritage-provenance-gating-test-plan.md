# Track 93: Post-Quantum Zero-Knowledge Cross-Chain Multi-Party Decentralized Cultural Heritage Provenance and Fine Art Authentication Gating Matrix — Test Plan

## Objective

Establish a privacy-preserving decentralized cultural heritage provenance and fine art authentication gating layer that scales cross-chain. Track 93 enforces non-repudiable UNESCO authority endpoint attestation boundaries across shared networks while completely preventing artwork material composition profiling and collector identity harvesting loops. Combines lattice-based zero-knowledge verifiable fuzzy matching with homomorphically split Pedersen commitments over artwork material composition hashes, provenance chain ancestry digests, and collector identity hashes. This architecture enables UNESCO cultural heritage authorities, national museum associations, and art authentication committees to verify hidden authentication claims (material composition similarity bounds, provenance chain depth metrics, attribution accreditation status) via non-interactive zero-knowledge range proofs with fuzzy matching, without exposing raw artwork measurements, provenance chain details, or collector identities.

## Scope

### Core primitives

- **PqcCulturalHeritageProvenanceGatingHub** — interlocking UNESCO authority endpoint coordinator that instantiates multi-party cultural heritage verification pools using homomorphically split Pedersen commitments over artwork material composition hashes, provenance chain ancestry digests, and collector identity hashes.
- **ZkAuthenticationClaimValidator** — succinct authentication claim verifier that processes non-interactive zero-knowledge range and fuzzy matching proofs, ensuring that an entity's hidden authentication claim status strictly satisfies policy-defined thresholds without disclosing individual artwork or collector attributes.
- **Cultural Heritage Gating Lifecycle Telemetry** — emits `HERITAGE_GATING_POOL_INITIALIZED`, `ZK_AUTHENTICATION_CLAIM_VERIFIED`, and `PROVENANCE_ACCREDITATION_COMPLETED` into the Track 29 ZK-rollup accumulator.

### Canonical heritage gating pool initialization payload wire layout

```
HERITAGEGATE:<poolId>:<sourceTenantId>:<targetChainId>:<blindedMaterialCompositionCommitment>:<blindedProvenanceChainCommitment>:<blindedCollectorIdentityCommitment>:<authenticationWindowSeconds>:<provenanceChainDepth>:<pqcSignatureScheme>:<unescoAuthorityInitializerAttestationHash>:<committeeSignature>
```

### Canonical authentication claim verification payload wire layout

```
HERITAGECLAIM:<claimId>:<poolId>:<blindedProvenanceChainCommitment>:<blindedClaimValueCommitment>:<zkAuthenticationRangeProofHash>:<culturalHeritageOversightCommitteeAttestationHash>:<fuzzyMatchThreshold>:<fuzzyMatchProofHash>
```

### Canonical provenance accreditation completion payload wire layout

```
HERITAGECOMPLETE:<completionId>:<poolId>:<claimSignatureCount>:<pqcSignatureScheme>:<committeeSignatures>
```

### Policy schema additions

- `pqHeritageGating`:
  - `minAuthenticationQuorum`: 4
  - `maxAuthenticationWindowSeconds`: 15552000
  - `maxProvenanceChainDepth`: 20
  - `allowedPqcSignatureSchemes`: `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`
  - `requireUnescoAuthorityInitializerAttestation`: true
  - `requireCulturalHeritageOversightCommitteeAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banMalformedOrOutOfOrderAuthenticationClaims`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All decentralized cultural heritage authentication criteria—including minimum authentication quorums, maximum authentication window lifetime bounds, allowed provenance chain depth parameters, and post-quantum signature schemes—are managed dynamically via the dedicated `pqHeritageGating` stanza in the active `CryptoPolicyEngine` schema.
- Both the UNESCO-authority-initializing endpoint and the processing cultural heritage oversight committee relays must pass `EnclaveAttestationClient.verify()` before a state transition can be signed (Track 41 integration).
- The `PqcCulturalHeritageProvenanceGatingHub` instantiates multi-party UNESCO authority verification pools using homomorphically split Pedersen commitments over artwork material composition hashes, provenance chain ancestry digests, and collector identity hashes, preventing artwork material composition profiling and collector identity harvesting loops.
- The `ZkAuthenticationClaimValidator` processes non-interactive zero-knowledge range and fuzzy matching proofs, ensuring that an entity's hidden authentication claim status strictly satisfies policy-defined thresholds without disclosing individual artwork or collector attributes.
- Peers broadcasting malformed or out-of-order authentication claims are automatically banned when `banMalformedOrOutOfOrderAuthenticationClaims` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.
- The quorum minimum of 4 reflects the multi-stakeholder nature of art authentication (art historian, material scientist, provenance researcher, UNESCO oversight).
- Zero-knowledge verifiable fuzzy matching introduces a fundamentally new cryptographic paradigm to the gating matrix. All prior primitives require exact cryptographic equality. Fuzzy matching enables approximate verification — proving that a hidden value falls within a similarity threshold of a reference value, without revealing either. This is critical for cultural heritage because material compositions, stylistic features, and provenance chain continuity all involve approximate similarity rather than exact matches.

## Test checklist

### Positive paths

- [ ] `PqcCulturalHeritageProvenanceGatingHub` initializes a heritage gating pool and emits `HERITAGE_GATING_POOL_INITIALIZED`.
- [ ] `ZkAuthenticationClaimValidator` verifies an authentication claim and emits `ZK_AUTHENTICATION_CLAIM_VERIFIED`.
- [ ] `PqcCulturalHeritageProvenanceGatingHub` completes provenance accreditation after quorum and emits `PROVENANCE_ACCREDITATION_COMPLETED`.
- [ ] `CryptoPolicyEngine` validates a compliant `pqHeritageGating` configuration.

### Security / edge cases

- [ ] Reject authentication quorum below `minAuthenticationQuorum` (4).
- [ ] Reject authentication window seconds exceeding `maxAuthenticationWindowSeconds`.
- [ ] Reject provenance chain depth exceeding `maxProvenanceChainDepth`.
- [ ] Reject PQC signature scheme not in `allowedPqcSignatureSchemes`.
- [ ] Reject un-attested UNESCO authority initializer.
- [ ] Reject un-attested cultural heritage oversight committee.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject authentication claims exceeding the authentication window.
- [ ] Reject malformed authentication claims (missing zkAuthenticationRangeProofHash, missing fuzzyMatchProofHash).
- [ ] Reject duplicate pool initializations.
- [ ] Reject provenance accreditation completion before authentication claim verification.
- [ ] Reject provenance accreditation completion with insufficient quorum.
- [ ] Automatically ban peers broadcasting malformed or out-of-order authentication claims.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqHeritageGating` for `operation === 'pqHeritageGating'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pq-cultural-heritage-provenance-gating` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pq-cultural-heritage-provenance-gating`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a four-signer authentication quorum with attested UNESCO authority initializer and cultural heritage oversight committee relay, verify authentication claim with fuzzy matching and provenance accreditation completion after quorum.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules, domain isolation (no existing track covers cultural heritage/art authentication operations), primitive isolation (ZK verifiable fuzzy matching new to gating matrix).

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-cultural-heritage-provenance-gating-hub.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-authentication-claim-validator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-cultural-heritage-provenance-gating.test.cjs` *(new)*

## Approval

Pending Validator review.
