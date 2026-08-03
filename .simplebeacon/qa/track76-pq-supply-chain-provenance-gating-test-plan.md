# Track 76: Post-Quantum Zero-Knowledge Cross-Chain Multi-Party Decentralized Supply Chain Provenance Verification and Component Lineage Gating Matrix — Test Plan

## Objective

Establish a privacy-preserving decentralized supply chain provenance verification and component lineage gating layer that scales cross-chain. Track 76 enforces non-repudiable component ancestry validation boundaries across shared networks while completely preventing supplier profiling and bill-of-materials harvesting loops. Combines lattice-based verifiable credentials with homomorphically split Pedersen commitments over component lineage records, supplier identity hashes, and manufacturing metric commitments. This architecture enables sovereign customs authorities, manufacturers, and logistics providers to verify hidden provenance claims (origin thresholds, supplier accreditation status, manufacturing quality metrics) via non-interactive zero-knowledge range proofs without exposing raw component bills-of-materials, supplier PII, or cross-organization supply chain tracking indices.

## Scope

### Core primitives

- **PqcSupplyChainProvenanceGatingHub** — interlocking supply chain provenance coordinator that instantiates multi-party supplier checkpoint verification pools using homomorphically split Pedersen commitments over component lineage records, supplier identity hashes, and manufacturing metric commitments.
- **ZkProvenanceClaimValidator** — succinct provenance verifier that processes non-interactive zero-knowledge range and origin proofs, ensuring that an entity's hidden provenance claim status strictly satisfies policy-defined thresholds without disclosing individual supplier or manufacturing attributes.
- **Supply Chain Gating Lifecycle Telemetry** — emits `SUPPLY_CHAIN_GATING_POOL_INITIALIZED`, `ZK_PROVENANCE_CLAIM_VERIFIED`, and `COMPONENT_LINEAGE_ACCREDITATION_COMPLETED` into the Track 29 ZK-rollup accumulator.

### Canonical supply chain gating pool initialization payload wire layout

```
SUPPLYGATE:<poolId>:<sourceTenantId>:<targetChainId>:<blindedLineageCommitment>:<blindedSupplierHashCommitment>:<blindedManufacturingMetricCommitment>:<transitExpirationSeconds>:<componentLineageDepth>:<pqcSignatureScheme>:<factoryEndpointInitializerAttestationHash>:<committeeSignature>
```

### Canonical provenance claim verification payload wire layout

```
SUPPLYCLAIM:<claimId>:<poolId>:<blindedSupplierHashCommitment>:<blindedClaimValueCommitment>:<zkProvenanceRangeProofHash>:<clearingCommitteeAttestationHash>:<partialSignature>
```

### Canonical component lineage accreditation completion payload wire layout

```
SUPPLYCOMPLETE:<completionId>:<poolId>:<claimSignatureCount>:<pqcSignatureScheme>:<committeeSignatures>
```

### Policy schema additions

- `pqSupplyChainGating`:
  - `minSupplierCheckpointQuorum`: 3
  - `maxTransitExpirationSeconds`: 7776000
  - `maxComponentLineageDepth`: 64
  - `allowedPqcSignatureSchemes`: `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`
  - `requireFactoryEndpointInitializerAttestation`: true
  - `requireClearingCommitteeAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banMalformedOrOutOfOrderProvenanceClaims`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All decentralized supply chain gating criteria—including minimum supplier checkpoint quorums, maximum transit expiration lifetime bounds, allowed component lineage depth parameters, and post-quantum signature schemes—are managed dynamically via the dedicated `pqSupplyChainGating` stanza in the active `CryptoPolicyEngine` schema.
- Both the factory-endpoint-initializing endpoint and the processing clearing committee relays must pass `EnclaveAttestationClient.verify()` before a state transition can be signed (Track 41 integration).
- The `PqcSupplyChainProvenanceGatingHub` instantiates multi-party supplier checkpoint verification pools using homomorphically split Pedersen commitments over component lineage records, supplier identity hashes, and manufacturing metric commitments, preventing supplier profiling and bill-of-materials harvesting loops.
- The `ZkProvenanceClaimValidator` processes non-interactive zero-knowledge range and origin proofs, ensuring that an entity's hidden provenance claim status strictly satisfies policy-defined thresholds without disclosing individual supplier or manufacturing attributes.
- Peers broadcasting malformed or out-of-order provenance claims are automatically banned when `banMalformedOrOutOfOrderProvenanceClaims` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `PqcSupplyChainProvenanceGatingHub` initializes a supply chain gating pool and emits `SUPPLY_CHAIN_GATING_POOL_INITIALIZED`.
- [ ] `ZkProvenanceClaimValidator` verifies a provenance claim and emits `ZK_PROVENANCE_CLAIM_VERIFIED`.
- [ ] `PqcSupplyChainProvenanceGatingHub` completes component lineage accreditation after quorum and emits `COMPONENT_LINEAGE_ACCREDITATION_COMPLETED`.
- [ ] `CryptoPolicyEngine` validates a compliant `pqSupplyChainGating` configuration.

### Security / edge cases

- [ ] Reject supplier checkpoint quorum below `minSupplierCheckpointQuorum`.
- [ ] Reject transit expiration seconds exceeding `maxTransitExpirationSeconds`.
- [ ] Reject component lineage depth exceeding `maxComponentLineageDepth`.
- [ ] Reject PQC signature scheme not in `allowedPqcSignatureSchemes`.
- [ ] Reject un-attested factory endpoint initializer.
- [ ] Reject un-attested clearing committee.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject provenance claims exceeding the transit expiration window.
- [ ] Reject malformed provenance claims (missing zkProvenanceRangeProofHash, missing partialSignature).
- [ ] Reject duplicate pool initializations.
- [ ] Reject component lineage accreditation completion before provenance claim verification.
- [ ] Reject component lineage accreditation completion with insufficient quorum.
- [ ] Automatically ban peers broadcasting malformed or out-of-order provenance claims.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqSupplyChainGating` for `operation === 'pqSupplyChainGating'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pq-supply-chain-provenance-gating` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pq-supply-chain-provenance-gating`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a three-signer supplier checkpoint quorum with attested factory endpoint initializer and clearing committee relay, verify provenance claim authentication and component lineage accreditation completion after quorum.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-supply-chain-provenance-gating-hub.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-provenance-claim-validator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-supply-chain-provenance-gating.test.cjs` *(new)*

## Approval

Pending Validator review.
