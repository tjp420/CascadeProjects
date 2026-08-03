# Track 69: Post-Quantum Zero-Knowledge Cross-Chain Multi-Party Real Estate Title Deed and Escrow Tokenization Pools — Test Plan

## Objective

Establish a privacy-preserving decentralized real-estate title deed and escrow tokenization layer that scales cross-chain. Track 69 enforces non-repudiable real-estate asset finality across shared networks while completely preventing land registry profiling and user tracking loops. Builds directly on the Track 50 cross-chain settlement engines and Track 68 supply chain escrow pool matrices, enabling enterprise tenants to tokenize and clear real-estate title assets across distinct network topologies. This architecture allows title transfers and fractional encumbrances to be executed using anonymous zero-knowledge position and value checks without disclosing actual appraisal bounds, participant corporate identities, or global ledger indices.

## Scope

### Core primitives

- **PqcRealEstateTokenizationHub** — interlocking title deed coordinator that instantiates multi-party asset pools using homomorphically split Pedersen commitments over real-estate values, encumbrance balances, and fractional share allocations.
- **ZkTitleDeedMilestoneValidator** — succinct ownership validator that processes non-interactive zero-knowledge range and partition proofs, ensuring that an asset's hidden encumbrance clearance strictly satisfies the policy-defined `maxLegalDisputeSeconds` threshold without disclosing line-item data.
- **Asset Tokenization Lifecycle Telemetry** — emits `REAL_ESTATE_POOL_INITIALIZED`, `ZK_ENCUMBRANCE_CLEARANCE_VERIFIED`, and `TITLE_DEED_TRANSFER_FINALIZED` into the Track 29 ZK-rollup accumulator.

### Canonical real-estate pool initialization payload wire layout

```
REPOOL:<poolId>:<sourceTenantId>:<targetChainId>:<blindedRealEstateValueCommitment>:<blindedEncumbranceBalanceCommitment>:<blindedFractionalShareCommitment>:<legalDisputeSeconds>:<assetValuationCap>:<pqcSignatureScheme>:<assetInitializerAttestationHash>:<committeeSignature>
```

### Canonical encumbrance clearance verification payload wire layout

```
ENCUMBRANCE:<clearanceId>:<poolId>:<blindedEncumbranceBalanceCommitment>:<blindedClearanceValueCommitment>:<zkEncumbranceRangeProofHash>:<clearingCommitteeAttestationHash>:<partialSignature>
```

### Canonical title deed transfer finalization payload wire layout

```
TITLETRANSFER:<transferId>:<poolId>:<coSignerSignatureCount>:<pqcSignatureScheme>:<committeeSignatures>
```

### Policy schema additions

- `pqRealEstateTokenization`:
  - `minCoSignerQuorum`: 3
  - `maxLegalDisputeSeconds`: 2592000
  - `maxAssetValuationCap`: 1000000000
  - `allowedPqcSignatureSchemes`: `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`
  - `requireAssetInitializerAttestation`: true
  - `requireClearingCommitteeAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banMalformedOrOutOfOrderTitleDeedAssertions`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All decentralized real-estate tokenization criteria—including minimum co-signer quorums, maximum legal dispute settlement windows, allowed asset valuation caps, and permitted post-quantum curve properties—are managed dynamically via the dedicated `pqRealEstateTokenization` stanza in the active `CryptoPolicyEngine` schema.
- Both the asset-initializing endpoint and the processing clearing committee relays must pass `EnclaveAttestationClient.verify()` before a state transition can be signed (Track 41 integration).
- The `PqcRealEstateTokenizationHub` instantiates multi-party asset pools using homomorphically split Pedersen commitments over real-estate values, encumbrance balances, and fractional share allocations, preventing land registry profiling and user tracking loops.
- The `ZkTitleDeedMilestoneValidator` processes non-interactive zero-knowledge range and partition proofs, ensuring that an asset's hidden encumbrance clearance strictly satisfies the policy-defined `maxLegalDisputeSeconds` threshold without disclosing line-item data.
- Peers broadcasting malformed or out-of-order title deed assertions are automatically banned when `banMalformedOrOutOfOrderTitleDeedAssertions` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `PqcRealEstateTokenizationHub` initializes a real-estate pool and emits `REAL_ESTATE_POOL_INITIALIZED`.
- [ ] `ZkTitleDeedMilestoneValidator` verifies encumbrance clearance and emits `ZK_ENCUMBRANCE_CLEARANCE_VERIFIED`.
- [ ] `PqcRealEstateTokenizationHub` finalizes a title deed transfer after quorum and emits `TITLE_DEED_TRANSFER_FINALIZED`.
- [ ] `CryptoPolicyEngine` validates a compliant `pqRealEstateTokenization` configuration.

### Security / edge cases

- [ ] Reject co-signer quorum below `minCoSignerQuorum`.
- [ ] Reject legal dispute seconds exceeding `maxLegalDisputeSeconds`.
- [ ] Reject asset valuation cap exceeding `maxAssetValuationCap`.
- [ ] Reject PQC signature scheme not in `allowedPqcSignatureSchemes`.
- [ ] Reject un-attested asset initializer.
- [ ] Reject un-attested clearing committee.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject encumbrance clearance proofs exceeding the legal dispute window.
- [ ] Reject malformed encumbrance proofs (missing zkEncumbranceRangeProofHash, missing partialSignature).
- [ ] Reject duplicate pool initializations.
- [ ] Reject title deed transfer before encumbrance clearance verification.
- [ ] Reject title deed transfer with insufficient quorum.
- [ ] Automatically ban peers broadcasting malformed or out-of-order title deed assertions.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqRealEstateTokenization` for `operation === 'pqRealEstateTokenization'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pq-real-estate-tokenization` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pq-real-estate-tokenization`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a three-signer co-signer quorum with attested asset initializer and clearing committee relay, verify encumbrance clearance authentication and title deed transfer finalization after quorum.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-real-estate-tokenization-hub.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-title-deed-milestone-validator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-real-estate-tokenization.test.cjs` *(new)*

## Extension scope (Track 69 Phase 2)

### New capabilities added

- **Valuation rebalancing** — rebalance asset valuation caps with increase/decrease directions, epoch tracking, and optional new valuation cap updates.
- **Batch pool initialization** — initialize multiple real-estate tokenization pools in a single batch call with per-pool results.
- **Committee signature aggregation** — BLS-style aggregate signature from partial committee signatures.
- **Pool cancellation** — cancel open pools (rejects if finalized/settled).
- **Cross-chain settlement coordination** — settle finalized pools on the target chain with settlement proof hashes.
- **Hardware-accelerated SNARK proof generation** — generate Groth16 SNARK proofs with configurable HW acceleration (GPU CUDA, FPGA, ASIC, simulated).
- **Batch clearance verification** — verify multiple encumbrance clearance proofs in a single batch call with per-clearance results.
- **Partial signature aggregation** — aggregate partial signatures from clearing committee members with banned-peer rejection.
- **Slashing window validation** — validate clearance timestamps within configurable slashing window.
- **Slashing event recording** — record slash events with reason codes (malformed_clearance, duplicate_clearance, dispute_window_out_of_bounds, pool_not_found, banned_peer, out_of_window).
- **Summary statistics** — both hub and validator expose `getStats()` methods.

### Extension test checklist

#### Positive paths

- [x] Valuation rebalance with increase direction.
- [x] Valuation rebalance with decrease direction.
- [x] Asset valuation cap updates on rebalance.
- [x] Batch initialization creates multiple pools.
- [x] Cross-chain settlement works for finalized pools.
- [x] Committee signatures can be aggregated.
- [x] Pools can be cancelled.
- [x] HW-SNARK proof generation produces Groth16 proofs.
- [x] Batch clearance verification processes multiple proofs.
- [x] Partial signatures can be aggregated.
- [x] Slashing window validation works for in-window clearances.
- [x] Full init → rebalance → clearance → transfer → settle flow works end-to-end.

#### Security / edge cases

- [x] Reject rebalance with invalid direction.
- [x] Reject rebalance with non-positive amount.
- [x] Reject rebalance with missing poolId.
- [x] Reject rebalance on finalized pool.
- [x] Reject batch init with empty array.
- [x] Reject batch init exceeding max size.
- [x] Reject settlement of non-finalized pool.
- [x] Reject settlement with mismatched chain.
- [x] Reject settlement with missing poolId.
- [x] Reject settlement with missing targetChainId.
- [x] Reject committee aggregation with insufficient signatures.
- [x] Reject committee aggregation with no signatures.
- [x] Reject committee aggregation for unknown pool.
- [x] Reject cancelling finalized pool.
- [x] Reject double cancellation.
- [x] Reject cancelling unknown pool.
- [x] Reject HW-SNARK proof generation with missing poolId.
- [x] Reject HW-SNARK proof generation with missing values.
- [x] Reject HW-SNARK proof generation for unknown pool.
- [x] Reject empty batch clearance verification.
- [x] Reject batch clearance verification exceeding max size.
- [x] Reject partial signature aggregation with banned peer.
- [x] Reject partial signature aggregation with insufficient signatures.
- [x] Reject partial signature aggregation with missing poolId.
- [x] Detect clearance outside slashing window.
- [x] Reject slashing window validation for unknown pool.
- [x] Reject slashing window validation with invalid timestamp.
- [x] Reject slashing window validation with missing poolId.
- [x] Record slashes for malformed clearances.
- [x] Record slashes for out-of-bounds dispute window.
- [x] Record slashes for duplicate clearances.
- [x] CLEARANCE_STATUS, SLASH_REASON, HW_ACCEL_TYPES, POOL_STATUS, REBALANCE_DIRECTION constants exported.

## Files changed (Phase 2 extension)

- `ai-platform/server/lib/hsm-adapter/pqc-real-estate-tokenization-hub.cjs` *(extended)*
- `ai-platform/server/lib/hsm-adapter/zk-title-deed-milestone-validator.cjs` *(extended)*
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs` *(14 new counters + 14 missing Track 68 counters)*
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-real-estate-tokenization-extensions.test.cjs` *(new, 54 tests)*

## Approval

Phase 1: Approved and merged (15 tests).
Phase 2: Pending Validator review.
