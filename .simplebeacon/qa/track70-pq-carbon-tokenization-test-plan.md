# Track 70: Post-Quantum Zero-Knowledge Cross-Chain Multi-Party Decentralized Sovereign Carbon Credit Tokenization and Retirement Pool Matrix — Test Plan

## Objective

Establish a privacy-preserving decentralized sovereign carbon credit tokenization and retirement layer that scales cross-chain. Track 70 enforces non-repudiable environmental offset finality and retirement boundaries across shared networks while completely preventing carbon offset market profiling and user tracking loops. Integrates fractional custody vaults from Track 65 and real-estate tokenization matrices from Track 69, mapping abstract carbon offsets to physical environmental anchors. This architecture enables sovereign and corporate tenants to issue, match, and permanently retire carbon offsets across distinct network topologies using anonymous zero-knowledge quantity, provenance, and balance double-spend proofs without disclosing actual underlying offset volume trades, participant corporate identities, or project tracking parameters.

## Scope

### Core primitives

- **PqcCarbonCreditTokenizationHub** — interlocking environmental asset coordinator that instantiates multi-party offset pools using homomorphically split Pedersen commitments over carbon volumes, vintage certification metrics, and retired allocations.
- **ZkCarbonRetirementValidator** — succinct retirement validator that processes non-interactive zero-knowledge range and double-spend proofs, ensuring that a sovereign's hidden token retirement strictly satisfies the policy-defined `maxVintageAgeSeconds` threshold without disclosing line-item parameters.
- **Carbon Tokenization Lifecycle Telemetry** — emits `CARBON_POOL_INITIALIZED`, `ZK_RETIREMENT_PROOF_VERIFIED`, and `CARBON_CREDIT_RETIREMENT_FINALIZED` into the Track 29 ZK-rollup accumulator.

### Canonical carbon pool initialization payload wire layout

```
CARBONPOOL:<poolId>:<sourceTenantId>:<targetChainId>:<blindedCarbonVolumeCommitment>:<blindedVintageCertificationCommitment>:<blindedRetiredAllocationCommitment>:<vintageAgeSeconds>:<carbonTonnageCap>:<pqcSignatureScheme>:<assetInitializerAttestationHash>:<committeeSignature>
```

### Canonical retirement proof verification payload wire layout

```
RETIREPROOF:<retirementId>:<poolId>:<blindedRetiredAllocationCommitment>:<blindedRetirementQuantityCommitment>:<zkRetirementRangeProofHash>:<clearingCommitteeAttestationHash>:<partialSignature>
```

### Canonical carbon credit retirement finalization payload wire layout

```
CARBONRETIRE:<finalizationId>:<poolId>:<retirementSignatureCount>:<pqcSignatureScheme>:<committeeSignatures>
```

### Policy schema additions

- `pqCarbonTokenization`:
  - `minRetirementQuorum`: 3
  - `maxVintageAgeSeconds`: 63072000
  - `maxCarbonTonnageCap`: 1000000000
  - `allowedPqcSignatureSchemes`: `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`
  - `requireAssetInitializerAttestation`: true
  - `requireClearingCommitteeAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banMalformedOrOutOfOrderRetirementAssertions`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All decentralized carbon tokenization criteria—including minimum retirement quorums, maximum vintage certification age limits, allowed carbon tonnage ceilings, and post-quantum signature curve configurations—are managed dynamically via the dedicated `pqCarbonTokenization` stanza in the active `CryptoPolicyEngine` schema.
- Both the asset-initializing endpoint and the processing clearing committee relays must pass `EnclaveAttestationClient.verify()` before a state transition can be signed (Track 41 integration).
- The `PqcCarbonCreditTokenizationHub` instantiates multi-party offset pools using homomorphically split Pedersen commitments over carbon volumes, vintage certification metrics, and retired allocations, preventing carbon offset market profiling and user tracking loops.
- The `ZkCarbonRetirementValidator` processes non-interactive zero-knowledge range and double-spend proofs, ensuring that a sovereign's hidden token retirement strictly satisfies the policy-defined `maxVintageAgeSeconds` threshold without disclosing line-item parameters.
- Peers broadcasting malformed or out-of-order retirement assertions are automatically banned when `banMalformedOrOutOfOrderRetirementAssertions` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `PqcCarbonCreditTokenizationHub` initializes a carbon pool and emits `CARBON_POOL_INITIALIZED`.
- [ ] `ZkCarbonRetirementValidator` verifies a retirement proof and emits `ZK_RETIREMENT_PROOF_VERIFIED`.
- [ ] `PqcCarbonCreditTokenizationHub` finalizes a carbon credit retirement after quorum and emits `CARBON_CREDIT_RETIREMENT_FINALIZED`.
- [ ] `CryptoPolicyEngine` validates a compliant `pqCarbonTokenization` configuration.

### Security / edge cases

- [ ] Reject retirement quorum below `minRetirementQuorum`.
- [ ] Reject vintage age seconds exceeding `maxVintageAgeSeconds`.
- [ ] Reject carbon tonnage cap exceeding `maxCarbonTonnageCap`.
- [ ] Reject PQC signature scheme not in `allowedPqcSignatureSchemes`.
- [ ] Reject un-attested asset initializer.
- [ ] Reject un-attested clearing committee.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject retirement proofs exceeding the vintage age window.
- [ ] Reject malformed retirement proofs (missing zkRetirementRangeProofHash, missing partialSignature).
- [ ] Reject duplicate pool initializations.
- [ ] Reject carbon credit retirement finalization before retirement proof verification.
- [ ] Reject carbon credit retirement finalization with insufficient quorum.
- [ ] Automatically ban peers broadcasting malformed or out-of-order retirement assertions.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqCarbonTokenization` for `operation === 'pqCarbonTokenization'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pq-carbon-tokenization` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pq-carbon-tokenization`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a three-signer retirement quorum with attested asset initializer and clearing committee relay, verify retirement proof authentication and carbon credit retirement finalization after quorum.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-carbon-credit-tokenization-hub.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-carbon-retirement-validator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-carbon-tokenization.test.cjs` *(new)*

## Extension scope (Track 70 Phase 2)

### New capabilities added

- **Tonnage rebalancing** — rebalance carbon tonnage caps with increase/decrease directions, epoch tracking, and optional new tonnage cap updates.
- **Batch pool initialization** — initialize multiple carbon credit tokenization pools in a single batch call with per-pool results.
- **Committee signature aggregation** — BLS-style aggregate signature from partial committee signatures.
- **Pool cancellation** — cancel open pools (rejects if retired/settled).
- **Cross-chain settlement coordination** — settle retired pools on the target chain with settlement proof hashes.
- **Hardware-accelerated SNARK proof generation** — generate Groth16 SNARK proofs with configurable HW acceleration (GPU CUDA, FPGA, ASIC, simulated).
- **Batch retirement proof verification** — verify multiple retirement proofs in a single batch call with per-retirement results.
- **Partial signature aggregation** — aggregate partial signatures from clearing committee members with banned-peer rejection.
- **Slashing window validation** — validate retirement timestamps within configurable slashing window.
- **Slashing event recording** — record slash events with reason codes (malformed_retirement, duplicate_retirement, vintage_age_out_of_bounds, pool_not_found, banned_peer, out_of_window).
- **Summary statistics** — both hub and validator expose `getStats()` methods.

### Extension test checklist

#### Positive paths

- [x] Tonnage rebalance with increase direction.
- [x] Tonnage rebalance with decrease direction.
- [x] Carbon tonnage cap updates on rebalance.
- [x] Batch initialization creates multiple pools.
- [x] Cross-chain settlement works for retired pools.
- [x] Committee signatures can be aggregated.
- [x] Pools can be cancelled.
- [x] HW-SNARK proof generation produces Groth16 proofs.
- [x] Batch retirement verification processes multiple proofs.
- [x] Partial signatures can be aggregated.
- [x] Slashing window validation works for in-window retirements.
- [x] Full init → rebalance → retirement → finalize → settle flow works end-to-end.

#### Security / edge cases

- [x] Reject rebalance with invalid direction.
- [x] Reject rebalance with non-positive amount.
- [x] Reject rebalance with missing poolId.
- [x] Reject rebalance on retired pool.
- [x] Reject batch init with empty array.
- [x] Reject batch init exceeding max size.
- [x] Reject settlement of non-retired pool.
- [x] Reject settlement with mismatched chain.
- [x] Reject settlement with missing poolId.
- [x] Reject settlement with missing targetChainId.
- [x] Reject committee aggregation with insufficient signatures.
- [x] Reject committee aggregation with no signatures.
- [x] Reject committee aggregation for unknown pool.
- [x] Reject cancelling retired pool.
- [x] Reject double cancellation.
- [x] Reject cancelling unknown pool.
- [x] Reject HW-SNARK proof generation with missing poolId.
- [x] Reject HW-SNARK proof generation with missing values.
- [x] Reject HW-SNARK proof generation for unknown pool.
- [x] Reject empty batch retirement verification.
- [x] Reject batch retirement verification exceeding max size.
- [x] Reject partial signature aggregation with banned peer.
- [x] Reject partial signature aggregation with insufficient signatures.
- [x] Reject partial signature aggregation with missing poolId.
- [x] Detect retirement outside slashing window.
- [x] Reject slashing window validation for unknown pool.
- [x] Reject slashing window validation with invalid timestamp.
- [x] Reject slashing window validation with missing poolId.
- [x] Record slashes for malformed retirements.
- [x] Record slashes for out-of-bounds vintage age.
- [x] Record slashes for duplicate retirements.
- [x] RETIREMENT_STATUS, SLASH_REASON, HW_ACCEL_TYPES, POOL_STATUS, REBALANCE_DIRECTION constants exported.

## Files changed (Phase 2 extension)

- `ai-platform/server/lib/hsm-adapter/pqc-carbon-credit-tokenization-hub.cjs` *(extended)*
- `ai-platform/server/lib/hsm-adapter/zk-carbon-retirement-validator.cjs` *(extended)*
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs` *(14 new counters)*
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-carbon-tokenization-extensions.test.cjs` *(new, 54 tests)*

## Approval

Phase 1: Approved and merged (15 tests).
Phase 2: Pending Validator review.
