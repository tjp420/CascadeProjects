# Track 67: Post-Quantum Zero-Knowledge Cross-Chain Decentralized Insurance Risk Underwriting Matrices — Test Plan

## Objective

Establish a privacy-preserving decentralized insurance underwriting layer that scales cross-chain. Track 67 enforces non-repudiable claim assessment boundaries across shared networks while preventing pool profiling and participant tracking. Builds directly on the Track 50 settlement engines and the Track 66 lending collateral pools, enabling corporate tenants to establish decentralized insurance and hedging pools across separate platform topologies, allowing coverage underwriters to lock hidden reserve commitments and evaluate policy claims using anonymous zero-knowledge solvency and loss-exposure proofs without disclosing actual underlying risk weights or liquidity metrics.

## Scope

### Core primitives

- **PqcInsuranceUnderwritingHub** — interlocking coverage coordinator that instantiates multi-party risk pools using homomorphically additive Pedersen commitments over premium values, underwriting reserves, and max claim limits.
- **ZkRiskExposureValidator** — succinct evaluation verifier that processes non-interactive zero-knowledge solvency range and boundary proofs, ensuring that an underwriting pool's hidden reserve status strictly satisfies the policy-defined `minReserveRatio` floor without disclosing line-item parameters.
- **Insurance Lifecycle Telemetry** — emits `INSURANCE_POOL_INITIALIZED`, `ZK_CLAIM_ELIGIBILITY_VERIFIED`, and `UNDERWRITING_POOL_LIQUIDATED` into the Track 29 ZK-rollup accumulator.

### Canonical insurance pool initialization payload wire layout

```
INSPAULT:<poolId>:<sourceTenantId>:<targetChainId>:<blindedPremiumCommitment>:<blindedReserveCommitment>:<blindedMaxClaimCommitment>:<reserveRatio>:<poolRiskExposureCap>:<pqcSignatureScheme>:<coverageInitiatorAttestationHash>:<committeeSignature>
```

### Canonical claim eligibility verification payload wire layout

```
CLAIMELIG:<claimId>:<poolId>:<blindedReserveCommitment>:<blindedLossExposureCommitment>:<zkRiskExposureProofHash>:<clearingCommitteeAttestationHash>:<partialSignature>
```

### Canonical underwriting pool liquidation payload wire layout

```
UNDERWRITINGLIQ:<liquidationId>:<poolId>:<claimSignatureCount>:<pqcSignatureScheme>:<committeeSignatures>
```

### Policy schema additions

- `pqInsuranceUnderwriting`:
  - `minReserveRatio`: 30
  - `minClaimQuorum`: 3
  - `maxPoolRiskExposureCap`: 1000000000
  - `allowedPqcSignatureSchemes`: `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`
  - `requireCoverageInitiatorAttestation`: true
  - `requireClearingCommitteeAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banMalformedOrOutOfOrderClaimAssertions`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All decentralized insurance underwriting criteria—including minimum underwriting reserve ratios, threshold claim quorums, maximum allowed pool risk exposure caps, and post-quantum signature schemes—are managed dynamically via the dedicated `pqInsuranceUnderwriting` stanza in the active `CryptoPolicyEngine` schema.
- Both the coverage-initializing endpoint and the processing clearing committee relays must pass `EnclaveAttestationClient.verify()` before a state transition can be signed (Track 41 integration).
- The `PqcInsuranceUnderwritingHub` instantiates multi-party risk pools using homomorphically additive Pedersen commitments over premium values, underwriting reserves, and max claim limits, preventing pool profiling and participant tracking.
- The `ZkRiskExposureValidator` processes non-interactive zero-knowledge solvency range and boundary proofs, ensuring that an underwriting pool's hidden reserve status strictly satisfies the policy-defined `minReserveRatio` floor without disclosing line-item parameters.
- Peers broadcasting malformed or out-of-order claim assertions are automatically banned when `banMalformedOrOutOfOrderClaimAssertions` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `PqcInsuranceUnderwritingHub` initializes an insurance pool and emits `INSURANCE_POOL_INITIALIZED`.
- [ ] `ZkRiskExposureValidator` verifies a valid claim eligibility proof and emits `ZK_CLAIM_ELIGIBILITY_VERIFIED`.
- [ ] `PqcInsuranceUnderwritingHub` liquidates an underwriting pool after quorum and emits `UNDERWRITING_POOL_LIQUIDATED`.
- [ ] `CryptoPolicyEngine` validates a compliant `pqInsuranceUnderwriting` configuration.

### Security / edge cases

- [ ] Reject reserve ratio below `minReserveRatio`.
- [ ] Reject claim quorum below `minClaimQuorum`.
- [ ] Reject pool risk exposure cap exceeding `maxPoolRiskExposureCap`.
- [ ] Reject PQC signature scheme not in `allowedPqcSignatureSchemes`.
- [ ] Reject un-attested coverage initiator.
- [ ] Reject un-attested clearing committee.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject sub-reserve proofs (reserve < premium at reserve ratio threshold).
- [ ] Reject malformed claim proofs (missing zkRiskExposureProofHash, missing partialSignature).
- [ ] Reject duplicate pool initializations.
- [ ] Reject liquidation before claim eligibility verification.
- [ ] Reject liquidation with insufficient quorum.
- [ ] Automatically ban peers broadcasting malformed or out-of-order claim assertions.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqInsuranceUnderwriting` for `operation === 'pqInsuranceUnderwriting'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pq-insurance-underwriting` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pq-insurance-underwriting`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a three-node clearing committee with attested coverage initiator and clearing committee relay, verify claim eligibility authentication and underwriting pool liquidation after quorum.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Extension scope (Track 67 Phase 2)

### New capabilities added

- **Risk rebalancing** — rebalance risk exposure with increase/decrease directions, epoch tracking, and optional reserve ratio updates.
- **Batch pool initialization** — initialize multiple insurance underwriting pools in a single batch call with per-pool results.
- **Committee signature aggregation** — BLS-style aggregate signature from partial committee signatures.
- **Pool cancellation** — cancel open pools (rejects if liquidated/settled).
- **Cross-chain settlement coordination** — settle liquidated pools on the target chain with settlement proof hashes.
- **Hardware-accelerated SNARK proof generation** — generate Groth16 SNARK proofs with configurable HW acceleration (GPU CUDA, FPGA, ASIC, simulated).
- **Batch claim verification** — verify multiple claim eligibility proofs in a single batch call with per-claim results.
- **Partial signature aggregation** — aggregate partial signatures from clearing committee members with banned-peer rejection.
- **Slashing window validation** — validate claim timestamps within configurable slashing window.
- **Slashing event recording** — record slash events with reason codes (malformed, duplicate, sub_reserve, pool_not_open, banned_peer, out_of_order).
- **Summary statistics** — both hub and validator expose `getStats()` methods.

### Extension test checklist

#### Positive paths

- [x] Risk rebalance with increase direction.
- [x] Risk rebalance with decrease direction.
- [x] Reserve ratio updates on rebalance.
- [x] Batch initialization creates multiple pools.
- [x] Cross-chain settlement works for liquidated pools.
- [x] Committee signatures can be aggregated.
- [x] Pools can be cancelled.
- [x] HW-SNARK proof generation produces Groth16 proofs.
- [x] Batch claim verification processes multiple proofs.
- [x] Partial signatures can be aggregated.
- [x] Slashing window validation works for in-window claims.
- [x] Full init → rebalance → claim → liquidate → settle flow works end-to-end.

#### Security / edge cases

- [x] Reject rebalance with invalid direction.
- [x] Reject rebalance with non-positive amount.
- [x] Reject rebalance with missing poolId.
- [x] Reject rebalance on liquidated pool.
- [x] Reject batch init with empty array.
- [x] Reject batch init exceeding max size.
- [x] Reject settlement of non-liquidated pool.
- [x] Reject settlement with mismatched chain.
- [x] Reject settlement with missing poolId.
- [x] Reject committee aggregation with insufficient signatures.
- [x] Reject committee aggregation with no signatures.
- [x] Reject committee aggregation for unknown pool.
- [x] Reject cancelling liquidated pool.
- [x] Reject double cancellation.
- [x] Reject cancelling unknown pool.
- [x] Reject HW-SNARK proof generation with missing poolId.
- [x] Reject HW-SNARK proof generation with missing values.
- [x] Reject HW-SNARK proof generation for unknown pool.
- [x] Reject empty batch claim verification.
- [x] Reject batch claim verification exceeding max size.
- [x] Reject partial signature aggregation with banned peer.
- [x] Reject partial signature aggregation with insufficient signatures.
- [x] Reject partial signature aggregation with missing poolId.
- [x] Detect claim outside slashing window.
- [x] Reject slashing window validation for unknown pool.
- [x] Reject slashing window validation with invalid timestamp.
- [x] Record slashes for malformed claims.
- [x] Record slashes for sub-reserve claims.
- [x] CLAIM_STATUS, SLASH_REASON, HW_ACCEL_TYPES, POOL_STATUS, REBALANCE_DIRECTION constants exported.

## Files changed (Phase 2 extension)

- `ai-platform/server/lib/hsm-adapter/pqc-insurance-underwriting-hub.cjs` *(extended)*
- `ai-platform/server/lib/hsm-adapter/zk-risk-exposure-validator.cjs` *(extended)*
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs` *(15 new counters)*
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-insurance-underwriting-extensions.test.cjs` *(new, 51 tests)*

## Approval

Phase 1: Approved and merged (15 tests).
Phase 2: Pending Validator review.
