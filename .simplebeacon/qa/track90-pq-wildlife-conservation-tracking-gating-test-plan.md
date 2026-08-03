# Track 90: Post-Quantum Zero-Knowledge Cross-Chain Multi-Party Decentralized Wildlife Conservation Tracking and Biodiversity Monitoring Gating Matrix — Test Plan

## Objective

Establish a privacy-preserving decentralized wildlife conservation tracking and biodiversity monitoring gating layer that scales cross-chain. Track 90 enforces non-repudiable IUCN conservation authority endpoint attestation boundaries across shared networks while completely preventing species telemetry stream profiling and ranger identity harvesting loops. Combines lattice-based linkable ring signatures with homomorphically split Pedersen commitments over species population telemetry hashes, habitat boundary measurements, and conservation officer identity hashes. This architecture enables IUCN conservation authorities, national park services, and wildlife protection organizations to verify hidden conservation claims (population threshold bounds, habitat quorum metrics, conservation accreditation status) via non-interactive zero-knowledge range proofs without exposing raw telemetry data, habitat locations, or conservation officer identities.

## Scope

### Core primitives

- **PqcWildlifeConservationTrackingGatingHub** — interlocking IUCN conservation authority endpoint coordinator that instantiates multi-party conservation verification pools using homomorphically split Pedersen commitments over species population telemetry hashes, habitat boundary measurements, and conservation officer identity hashes.
- **ZkConservationClaimValidator** — succinct conservation claim verifier that processes non-interactive zero-knowledge range and telemetry proofs with linkable ring signature verification, ensuring that an entity's hidden conservation claim status strictly satisfies policy-defined thresholds without disclosing individual species or ranger attributes.
- **Wildlife Gating Lifecycle Telemetry** — emits `WILDLIFE_GATING_POOL_INITIALIZED`, `ZK_CONSERVATION_CLAIM_VERIFIED`, and `BIODIVERSITY_ACCREDITATION_COMPLETED` into the Track 29 ZK-rollup accumulator.

### Canonical wildlife gating pool initialization payload wire layout

```
WILDLIFEGATE:<poolId>:<sourceTenantId>:<targetChainId>:<blindedSpeciesTelemetryCommitment>:<blindedHabitatBoundaryCommitment>:<blindedRangerIdentityCommitment>:<monitoringWindowSeconds>:<telemetryChainDepth>:<pqcSignatureScheme>:<conservationAuthorityInitializerAttestationHash>:<committeeSignature>
```

### Canonical conservation claim verification payload wire layout

```
WILDLIFECLAIM:<claimId>:<poolId>:<blindedHabitatBoundaryCommitment>:<blindedClaimValueCommitment>:<zkConservationRangeProofHash>:<biodiversityOversightCommitteeAttestationHash>:<linkableRingSignature>:<linkabilityTag>
```

### Canonical biodiversity accreditation completion payload wire layout

```
WILDLIFECOMPLETE:<completionId>:<poolId>:<claimSignatureCount>:<pqcSignatureScheme>:<committeeSignatures>
```

### Policy schema additions

- `pqWildlifeGating`:
  - `minConservationQuorum`: 4
  - `maxMonitoringWindowSeconds`: 2592000
  - `maxTelemetryChainDepth`: 14
  - `allowedPqcSignatureSchemes`: `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`
  - `requireConservationAuthorityInitializerAttestation`: true
  - `requireBiodiversityOversightCommitteeAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banMalformedOrOutOfOrderConservationClaims`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All decentralized wildlife conservation tracking criteria—including minimum conservation quorums, maximum monitoring window lifetime bounds, allowed telemetry chain depth parameters, and post-quantum signature schemes—are managed dynamically via the dedicated `pqWildlifeGating` stanza in the active `CryptoPolicyEngine` schema.
- Both the conservation-authority-initializing endpoint and the processing biodiversity oversight committee relays must pass `EnclaveAttestationClient.verify()` before a state transition can be signed (Track 41 integration).
- The `PqcWildlifeConservationTrackingGatingHub` instantiates multi-party IUCN conservation verification pools using homomorphically split Pedersen commitments over species population telemetry hashes, habitat boundary measurements, and conservation officer identity hashes, preventing species telemetry stream profiling and ranger identity harvesting loops.
- The `ZkConservationClaimValidator` processes non-interactive zero-knowledge range and telemetry proofs with linkable ring signature verification, ensuring that an entity's hidden conservation claim status strictly satisfies policy-defined thresholds without disclosing individual species or ranger attributes.
- Peers broadcasting malformed or out-of-order conservation claims are automatically banned when `banMalformedOrOutOfOrderConservationClaims` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.
- The quorum minimum of 4 reflects the multi-stakeholder nature of conservation monitoring (ranger, park authority, national agency, IUCN oversight).
- Linkable ring signatures combine the anonymity of ring signatures (T83) with cryptographic linkability tags that detect double-reporting without revealing ranger identity, a new primitive distinct from threshold ring signatures (T89) which lack linkability.

## Test checklist

### Positive paths

- [ ] `PqcWildlifeConservationTrackingGatingHub` initializes a wildlife gating pool and emits `WILDLIFE_GATING_POOL_INITIALIZED`.
- [ ] `ZkConservationClaimValidator` verifies a conservation claim and emits `ZK_CONSERVATION_CLAIM_VERIFIED`.
- [ ] `PqcWildlifeConservationTrackingGatingHub` completes biodiversity accreditation after quorum and emits `BIODIVERSITY_ACCREDITATION_COMPLETED`.
- [ ] `CryptoPolicyEngine` validates a compliant `pqWildlifeGating` configuration.

### Security / edge cases

- [ ] Reject conservation quorum below `minConservationQuorum` (4).
- [ ] Reject monitoring window seconds exceeding `maxMonitoringWindowSeconds`.
- [ ] Reject telemetry chain depth exceeding `maxTelemetryChainDepth`.
- [ ] Reject PQC signature scheme not in `allowedPqcSignatureSchemes`.
- [ ] Reject un-attested conservation authority initializer.
- [ ] Reject un-attested biodiversity oversight committee.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject conservation claims exceeding the monitoring window.
- [ ] Reject malformed conservation claims (missing zkConservationRangeProofHash, missing linkableRingSignature).
- [ ] Reject duplicate pool initializations.
- [ ] Reject biodiversity accreditation completion before conservation claim verification.
- [ ] Reject biodiversity accreditation completion with insufficient quorum.
- [ ] Automatically ban peers broadcasting malformed or out-of-order conservation claims.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqWildlifeGating` for `operation === 'pqWildlifeGating'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pq-wildlife-conservation-tracking-gating` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pq-wildlife-conservation-tracking-gating`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a four-signer conservation quorum with attested IUCN conservation authority initializer and biodiversity oversight committee relay, verify conservation claim authentication and biodiversity accreditation completion after quorum.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules, domain isolation (no existing track covers wildlife/conservation operations), primitive isolation (linkable ring signatures new to gating matrix).

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-wildlife-conservation-tracking-gating-hub.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-conservation-claim-validator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-wildlife-conservation-tracking-gating.test.cjs` *(new)*

## Approval

Pending Validator review.
