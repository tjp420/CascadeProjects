# Track 94: Post-Quantum Zero-Knowledge Cross-Chain Multi-Party Decentralized Ocean Fisheries Allocation and Marine Sanctuary Compliance Gating Matrix — Test Plan

## Objective

Establish a privacy-preserving decentralized ocean fisheries allocation and marine sanctuary compliance gating layer that scales cross-chain. Track 94 enforces non-repudiable RFMO authority endpoint attestation boundaries across shared networks while completely preventing vessel catch data profiling and maritime authority identity harvesting loops. Combines lattice-based proxy re-encryption with homomorphically split Pedersen commitments over vessel catch telemetry hashes, quota allocation digests, and maritime authority identity hashes. This architecture enables regional fisheries management organizations (RFMOs), national coast guards, marine sanctuary authorities, and international fisheries councils to verify hidden catch claims (quota threshold bounds, sanctuary zone compliance metrics, vessel telemetry chain integrity) via non-interactive zero-knowledge range proofs with proxy re-encryption key digest verification, without exposing raw vessel catch data, quota allocations, or vessel identities.

## Scope

### Core primitives

- **PqcOceanFisheriesAllocationGatingHub** — interlocking RFMO authority endpoint coordinator that instantiates multi-party fisheries verification pools using homomorphically split Pedersen commitments over vessel catch telemetry hashes, quota allocation digests, and maritime authority identity hashes.
- **ZkCatchClaimValidator** — succinct catch claim verifier that processes non-interactive zero-knowledge range and catch compliance proofs with proxy re-encryption key digest verification, ensuring that an entity's hidden catch claim status strictly satisfies policy-defined thresholds without disclosing individual vessel or authority attributes.
- **Fisheries Gating Lifecycle Telemetry** — emits `FISHERIES_GATING_POOL_INITIALIZED`, `ZK_CATCH_CLAIM_VERIFIED`, and `QUOTA_ACCREDITATION_COMPLETED` into the Track 29 ZK-rollup accumulator.

### Canonical fisheries gating pool initialization payload wire layout

```
FISHERIESGATE:<poolId>:<sourceTenantId>:<targetChainId>:<blindedCatchTelemetryCommitment>:<blindedQuotaAllocationCommitment>:<blindedMaritimeAuthorityIdentityCommitment>:<catchTrackingWindowSeconds>:<vesselTelemetryChainDepth>:<pqcSignatureScheme>:<rfmoAuthorityInitializerAttestationHash>:<committeeSignature>
```

### Canonical catch claim verification payload wire layout

```
FISHERIESCLAIM:<claimId>:<poolId>:<blindedQuotaAllocationCommitment>:<blindedClaimValueCommitment>:<zkCatchRangeProofHash>:<marineSanctuaryOversightCommitteeAttestationHash>:<proxyReEncryptionKeyDigest>
```

### Canonical quota accreditation completion payload wire layout

```
FISHERIESCOMPLETE:<completionId>:<poolId>:<claimSignatureCount>:<pqcSignatureScheme>:<committeeSignatures>
```

### Policy schema additions

- `pqFisheriesGating`:
  - `minMaritimeQuorum`: 5
  - `maxCatchTrackingWindowSeconds`: 2592000
  - `maxVesselTelemetryChainDepth`: 12
  - `allowedPqcSignatureSchemes`: `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`
  - `requireRfmoAuthorityInitializerAttestation`: true
  - `requireMarineSanctuaryOversightCommitteeAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banMalformedOrOutOfOrderCatchClaims`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All decentralized ocean fisheries allocation criteria—including minimum maritime quorums, maximum catch tracking window lifetime bounds, allowed vessel telemetry chain depth parameters, and post-quantum signature schemes—are managed dynamically via the dedicated `pqFisheriesGating` stanza in the active `CryptoPolicyEngine` schema.
- Both the RFMO-authority-initializing endpoint and the processing marine sanctuary oversight committee relays must pass `EnclaveAttestationClient.verify()` before a state transition can be signed (Track 41 integration).
- The `PqcOceanFisheriesAllocationGatingHub` instantiates multi-party RFMO authority verification pools using homomorphically split Pedersen commitments over vessel catch telemetry hashes, quota allocation digests, and maritime authority identity hashes, preventing vessel catch data profiling and maritime authority identity harvesting loops.
- The `ZkCatchClaimValidator` processes non-interactive zero-knowledge range and catch compliance proofs with proxy re-encryption key digest verification, ensuring that an entity's hidden catch claim status strictly satisfies policy-defined thresholds without disclosing individual vessel or authority attributes.
- Peers broadcasting malformed or out-of-order catch claims are automatically banned when `banMalformedOrOutOfOrderCatchClaims` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.
- The quorum minimum of 5 reflects the multi-stakeholder nature of ocean fisheries governance (RFMO, national coast guard, marine sanctuary authority, vessel registry, international fisheries council).
- Proxy re-encryption introduces a fundamentally new cryptographic paradigm to the gating matrix. Unlike FE (T92) which computes functions over encrypted data, PRE transforms who can decrypt the data. Unlike threshold signatures (T87) which distribute signing authority, PRE distributes decryption capability. The proxy (maritime registry) can re-encrypt catch logs for various authorities without ever seeing the plaintext. This enables multi-jurisdictional catch reporting where a vessel encrypts once and the proxy re-encrypts for each relevant authority.

## Test checklist

### Positive paths

- [ ] `PqcOceanFisheriesAllocationGatingHub` initializes a fisheries gating pool and emits `FISHERIES_GATING_POOL_INITIALIZED`.
- [ ] `ZkCatchClaimValidator` verifies a catch claim and emits `ZK_CATCH_CLAIM_VERIFIED`.
- [ ] `PqcOceanFisheriesAllocationGatingHub` completes quota accreditation after quorum and emits `QUOTA_ACCREDITATION_COMPLETED`.
- [ ] `CryptoPolicyEngine` validates a compliant `pqFisheriesGating` configuration.

### Security / edge cases

- [ ] Reject maritime quorum below `minMaritimeQuorum` (5).
- [ ] Reject catch tracking window seconds exceeding `maxCatchTrackingWindowSeconds`.
- [ ] Reject vessel telemetry chain depth exceeding `maxVesselTelemetryChainDepth`.
- [ ] Reject PQC signature scheme not in `allowedPqcSignatureSchemes`.
- [ ] Reject un-attested RFMO authority initializer.
- [ ] Reject un-attested marine sanctuary oversight committee.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject catch claims exceeding the tracking window.
- [ ] Reject malformed catch claims (missing zkCatchRangeProofHash, missing proxyReEncryptionKeyDigest).
- [ ] Reject duplicate pool initializations.
- [ ] Reject quota accreditation completion before catch claim verification.
- [ ] Reject quota accreditation completion with insufficient quorum.
- [ ] Automatically ban peers broadcasting malformed or out-of-order catch claims.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqFisheriesGating` for `operation === 'pqFisheriesGating'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pq-ocean-fisheries-allocation-gating` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pq-ocean-fisheries-allocation-gating`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a five-signer maritime quorum with attested RFMO authority initializer and marine sanctuary oversight committee relay, verify catch claim with proxy re-encryption key digest and quota accreditation completion after quorum.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules, domain isolation (no existing track covers ocean fisheries/marine sanctuary operations — distinct from T89 nuclear safeguards and T90 wildlife conservation), primitive isolation (proxy re-encryption new to gating matrix).

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-ocean-fisheries-allocation-gating-hub.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-catch-claim-validator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-ocean-fisheries-allocation-gating.test.cjs` *(new)*

## Approval

Pending Validator review.
