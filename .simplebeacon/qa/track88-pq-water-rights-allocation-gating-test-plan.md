# Track 88: Post-Quantum Zero-Knowledge Cross-Chain Multi-Party Decentralized Water Rights Allocation and Watershed Flow Verification Gating Matrix — Test Plan

## Objective

Establish a privacy-preserving decentralized water rights allocation and watershed flow verification gating layer that scales cross-chain. Track 88 enforces non-repudiable water authority endpoint attestation boundaries across shared networks while completely preventing water consumption profiling and watershed topology harvesting loops. Combines lattice-based secure multi-party computation (MPC) with homomorphically split Pedersen commitments over water allocation volumes, watershed flow measurements, and riparian rights hashes. This architecture enables sovereign water authorities, watershed oversight committees, and riparian rights holders to verify hidden water claims (allocation threshold bounds, flow quorum metrics, rights accreditation status) via non-interactive zero-knowledge range proofs without exposing raw usage data, watershed topology, or cross-jurisdictional water tracking indices.

## Scope

### Core primitives

- **PqcWaterRightsAllocationGatingHub** — interlocking water authority endpoint coordinator that instantiates multi-party water authority verification pools using homomorphically split Pedersen commitments over water allocation volumes, watershed flow measurements, and riparian rights hashes.
- **ZkWaterRightsClaimValidator** — succinct water rights claim verifier that processes non-interactive zero-knowledge range and flow proofs with MPC verification, ensuring that an entity's hidden water claim status strictly satisfies policy-defined thresholds without disclosing individual water or watershed attributes.
- **Water Gating Lifecycle Telemetry** — emits `WATER_GATING_POOL_INITIALIZED`, `ZK_WATER_CLAIM_VERIFIED`, and `WATERSHED_ACCREDITATION_COMPLETED` into the Track 29 ZK-rollup accumulator.

### Canonical water gating pool initialization payload wire layout

```
WATERGATE:<poolId>:<sourceTenantId>:<targetChainId>:<blindedWaterAllocationCommitment>:<blindedWatershedFlowCommitment>:<blindedRiparianRightsCommitment>:<allocationWindowSeconds>:<flowChainDepth>:<pqcSignatureScheme>:<waterAuthorityInitializerAttestationHash>:<committeeSignature>
```

### Canonical water rights claim verification payload wire layout

```
WATERCLAIM:<claimId>:<poolId>:<blindedWatershedFlowCommitment>:<blindedClaimValueCommitment>:<zkWaterRangeProofHash>:<watershedOversightCommitteeAttestationHash>:<mpcProof>
```

### Canonical watershed accreditation completion payload wire layout

```
WATERCOMPLETE:<completionId>:<poolId>:<claimSignatureCount>:<pqcSignatureScheme>:<committeeSignatures>
```

### Policy schema additions

- `pqWaterGating`:
  - `minWatershedQuorum`: 4
  - `maxAllocationWindowSeconds`: 31536000
  - `maxFlowChainDepth`: 20
  - `allowedPqcSignatureSchemes`: `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`
  - `requireWaterAuthorityInitializerAttestation`: true
  - `requireWatershedOversightCommitteeAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banMalformedOrOutOfOrderWaterClaims`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All decentralized water rights allocation criteria—including minimum watershed quorums, maximum allocation window lifetime bounds, allowed flow chain depth parameters, and post-quantum signature schemes—are managed dynamically via the dedicated `pqWaterGating` stanza in the active `CryptoPolicyEngine` schema.
- Both the water-authority-initializing endpoint and the processing watershed oversight committee relays must pass `EnclaveAttestationClient.verify()` before a state transition can be signed (Track 41 integration).
- The `PqcWaterRightsAllocationGatingHub` instantiates multi-party water authority verification pools using homomorphically split Pedersen commitments over water allocation volumes, watershed flow measurements, and riparian rights hashes, preventing water consumption profiling and watershed topology harvesting loops.
- The `ZkWaterRightsClaimValidator` processes non-interactive zero-knowledge range and flow proofs with MPC verification, ensuring that an entity's hidden water claim status strictly satisfies policy-defined thresholds without disclosing individual water or watershed attributes.
- Peers broadcasting malformed or out-of-order water claims are automatically banned when `banMalformedOrOutOfOrderWaterClaims` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.
- The quorum minimum of 4 reflects the multi-stakeholder nature of watershed allocations (upstream, downstream, authority, environmental regulator).
- MPC primitive is distinct from threshold signatures (T87), tFHE (T81/T86), and all other gating matrix primitives.

## Test checklist

### Positive paths

- [ ] `PqcWaterRightsAllocationGatingHub` initializes a water gating pool and emits `WATER_GATING_POOL_INITIALIZED`.
- [ ] `ZkWaterRightsClaimValidator` verifies a water rights claim and emits `ZK_WATER_CLAIM_VERIFIED`.
- [ ] `PqcWaterRightsAllocationGatingHub` completes watershed accreditation after quorum and emits `WATERSHED_ACCREDITATION_COMPLETED`.
- [ ] `CryptoPolicyEngine` validates a compliant `pqWaterGating` configuration.

### Security / edge cases

- [ ] Reject watershed quorum below `minWatershedQuorum` (4).
- [ ] Reject allocation window seconds exceeding `maxAllocationWindowSeconds`.
- [ ] Reject flow chain depth exceeding `maxFlowChainDepth`.
- [ ] Reject PQC signature scheme not in `allowedPqcSignatureSchemes`.
- [ ] Reject un-attested water authority initializer.
- [ ] Reject un-attested watershed oversight committee.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject water claims exceeding the allocation window.
- [ ] Reject malformed water claims (missing zkWaterRangeProofHash, missing mpcProof).
- [ ] Reject duplicate pool initializations.
- [ ] Reject watershed accreditation completion before water claim verification.
- [ ] Reject watershed accreditation completion with insufficient quorum.
- [ ] Automatically ban peers broadcasting malformed or out-of-order water claims.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqWaterGating` for `operation === 'pqWaterGating'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pq-water-rights-allocation-gating` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pq-water-rights-allocation-gating`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a four-signer watershed quorum with attested water authority initializer and watershed oversight committee relay, verify water rights claim authentication and watershed accreditation completion after quorum.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules, domain isolation (no existing track covers water/watershed operations), primitive isolation (MPC new to gating matrix).

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-water-rights-allocation-gating-hub.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-water-rights-claim-validator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-water-rights-allocation-gating.test.cjs` *(new)*

## Approval

Pending Validator review.
