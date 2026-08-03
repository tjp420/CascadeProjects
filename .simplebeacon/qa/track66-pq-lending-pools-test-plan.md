# Track 66: Post-Quantum Zero-Knowledge Cross-Chain Multi-Party Decentralized Lending Collateral Pools — Test Plan

## Objective

Establish a privacy-preserving decentralized lending layer that scales cross-chain. Track 66 enforces non-repudiable credit and margin evaluation boundaries across shared networks while preventing counterparty profiling and collateral tracking. Builds directly on the Track 50 settlement engines and Track 65 fractional custody hubs, allowing tenants to establish decentralized lending pools across separate platform topologies, enabling borrowers to lock hidden collateral commitments and extract liquidity over anonymous zero-knowledge solvency and range proofs without exposing their raw capital values or corporate risk profiles.

## Scope

### Core primitives

- **PqcLendingCollateralHub** — interlocking collateral coordinator that instantiates multi-party borrowing pools using homomorphically additive Pedersen commitments over borrow values, locked collateral parameters, and safety margins.
- **ZkSolvencyProofProcessor** — succinct verification engine that processes non-interactive zero-knowledge solvency and threshold range proofs, ensuring that a borrower's hidden margin asset status strictly conforms to the policy-defined `minLtvRatio` ceiling without exposing line-item positions.
- **Lending Pool Lifecycle Telemetry** — emits `LENDING_POOL_INITIALIZED`, `ZK_SOLVENCY_PROOF_VERIFIED`, and `COLLATERAL_POOL_LIQUIDATED` into the Track 29 ZK-rollup accumulator.

### Canonical lending pool initialization payload wire layout

```
LENDPOOL:<poolId>:<sourceTenantId>:<targetChainId>:<blindedBorrowValueCommitment>:<blindedCollateralCommitment>:<blindedSafetyMarginCommitment>:<ltvRatio>:<borrowValueCap>:<pqcSignatureScheme>:<borrowerAttestationHash>:<committeeSignature>
```

### Canonical solvency proof payload wire layout

```
SOLVENCYPROOF:<proofId>:<poolId>:<blindedCollateralCommitment>:<blindedBorrowValueCommitment>:<zkSolvencyRangeProofHash>:<clearingCommitteeAttestationHash>:<partialSignature>
```

### Canonical collateral pool liquidation payload wire layout

```
COLLATERALLIQ:<liquidationId>:<poolId>:<liquidationSignatureCount>:<pqcSignatureScheme>:<committeeSignatures>
```

### Policy schema additions

- `pqLendingPools`:
  - `minLtvRatio`: 50
  - `minLiquidationSignatureQuorum`: 3
  - `maxBorrowValueCap`: 1000000000
  - `allowedPqcSignatureSchemes`: `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`
  - `requireBorrowerAttestation`: true
  - `requireClearingCommitteeAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banMalformedOrSubSolvencyClaims`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All decentralized lending criteria—including minimum loan-to-value (LTV) ratios, threshold liquidation quorums, maximum borrow value caps, and post-quantum curve settings—are managed dynamically via the dedicated `pqLendingPools` stanza in the active `CryptoPolicyEngine` schema.
- Both the borrow-requesting endpoint and the processing clearing committee relays must pass `EnclaveAttestationClient.verify()` before a state transition can be signed (Track 41 integration).
- The `PqcLendingCollateralHub` instantiates multi-party borrowing pools using homomorphically additive Pedersen commitments over borrow values, locked collateral parameters, and safety margins, preventing counterparty profiling and collateral tracking.
- The `ZkSolvencyProofProcessor` processes non-interactive zero-knowledge solvency and threshold range proofs, ensuring that a borrower's hidden margin asset status strictly conforms to the policy-defined `minLtvRatio` ceiling without exposing line-item positions.
- Peers broadcasting malformed or sub-solvency credit claims are automatically banned when `banMalformedOrSubSolvencyClaims` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `PqcLendingCollateralHub` initializes a lending pool and emits `LENDING_POOL_INITIALIZED`.
- [ ] `ZkSolvencyProofProcessor` verifies a valid solvency proof and emits `ZK_SOLVENCY_PROOF_VERIFIED`.
- [ ] `PqcLendingCollateralHub` liquidates a collateral pool after quorum and emits `COLLATERAL_POOL_LIQUIDATED`.
- [ ] `CryptoPolicyEngine` validates a compliant `pqLendingPools` configuration.

### Security / edge cases

- [ ] Reject LTV ratio below `minLtvRatio`.
- [ ] Reject liquidation signature quorum below `minLiquidationSignatureQuorum`.
- [ ] Reject borrow value cap exceeding `maxBorrowValueCap`.
- [ ] Reject PQC signature scheme not in `allowedPqcSignatureSchemes`.
- [ ] Reject un-attested borrower.
- [ ] Reject un-attested clearing committee.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject sub-solvency proofs (collateral < borrow value at LTV threshold).
- [ ] Reject malformed solvency proofs (missing zkSolvencyRangeProofHash, missing partialSignature).
- [ ] Reject duplicate pool initializations.
- [ ] Reject liquidation before solvency verification.
- [ ] Reject liquidation with insufficient quorum.
- [ ] Automatically ban peers broadcasting malformed or sub-solvency claims.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqLendingPools` for `operation === 'pqLendingPools'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pq-lending-pools` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pq-lending-pools`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a three-node clearing committee with attested borrower and clearing committee relay, verify solvency proof authentication and collateral pool liquidation after quorum.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Extension scope (Track 66 Phase 2)

### New capabilities added

- **Collateral rebalancing** — rebalance collateral with increase/decrease directions, epoch tracking, and optional LTV ratio updates.
- **Batch pool initialization** — initialize multiple lending pools in a single batch call with per-pool results.
- **Committee signature aggregation** — BLS-style aggregate signature from partial committee signatures.
- **Pool cancellation** — cancel open pools (rejects if liquidated/settled).
- **Cross-chain settlement coordination** — settle liquidated pools on the target chain with settlement proof hashes.
- **Hardware-accelerated SNARK proof generation** — generate Groth16 SNARK proofs with configurable HW acceleration (GPU CUDA, FPGA, ASIC, simulated).
- **Batch solvency verification** — verify multiple solvency proofs in a single batch call with per-proof results.
- **Partial signature aggregation** — aggregate partial signatures from clearing committee members with banned-peer rejection.
- **Slashing window validation** — validate proof timestamps within configurable slashing window.
- **Slashing event recording** — record slash events with reason codes (malformed, duplicate, sub_solvency, pool_not_open, banned_peer, out_of_order).
- **Summary statistics** — both hub and processor expose `getStats()` methods.

### Extension test checklist

#### Positive paths

- [x] Collateral rebalance with increase direction.
- [x] Collateral rebalance with decrease direction.
- [x] LTV ratio updates on rebalance.
- [x] Batch initialization creates multiple pools.
- [x] Cross-chain settlement works for liquidated pools.
- [x] Committee signatures can be aggregated.
- [x] Pools can be cancelled.
- [x] HW-SNARK proof generation produces Groth16 proofs.
- [x] Batch solvency verification processes multiple proofs.
- [x] Partial signatures can be aggregated.
- [x] Slashing window validation works for in-window proofs.
- [x] Full init → rebalance → solvency → liquidate → settle flow works end-to-end.

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
- [x] Reject empty batch solvency verification.
- [x] Reject batch solvency verification exceeding max size.
- [x] Reject partial signature aggregation with banned peer.
- [x] Reject partial signature aggregation with insufficient signatures.
- [x] Reject partial signature aggregation with missing poolId.
- [x] Detect proof outside slashing window.
- [x] Reject slashing window validation for unknown pool.
- [x] Reject slashing window validation with invalid timestamp.
- [x] Record slashes for malformed proofs.
- [x] Record slashes for sub-solvency proofs.
- [x] PROOF_STATUS, SLASH_REASON, HW_ACCEL_TYPES, POOL_STATUS, REBALANCE_DIRECTION constants exported.

## Files changed (Phase 2 extension)

- `ai-platform/server/lib/hsm-adapter/pqc-lending-collateral-hub.cjs` *(extended)*
- `ai-platform/server/lib/hsm-adapter/zk-solvency-proof-processor.cjs` *(extended)*
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs` *(15 new counters)*
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-lending-pools-extensions.test.cjs` *(new, 51 tests)*

## Approval

Phase 1: Approved and merged (15 tests).
Phase 2: Pending Validator review.
