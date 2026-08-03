# Track 68: Post-Quantum Zero-Knowledge Cross-Chain Multi-Party Supply Chain Order Matching and Escrow Pool Matrix — Test Plan

## Objective

Establish a privacy-preserving decentralized supply chain order matching and escrow layer that scales cross-chain. Track 68 enforces non-repudiable procurement delivery and finality boundaries across shared networks while preventing supply chain profiling and participant tracking. Builds directly on the Track 50 cross-chain settlement engines and Track 63 blind option pools, enabling enterprise tenants to initialize supply chain contracts across independent networks. This architecture allows buyers and suppliers to verify hidden order fulfillment milestones and extract time-locked escrow payouts via non-interactive zero-knowledge quantity and value proofs without exposing actual item pricing, corporate procurement volumes, or trading partner identities.

## Scope

### Core primitives

- **PqcSupplyChainEscrowHub** — interlocking order coordinator that instantiates multi-party procurement pools using homomorphically additive Pedersen commitments over order values, logistics volumes, and deposit margins.
- **ZkOrderMilestoneValidator** — succinct fulfillment verifier that processes non-interactive zero-knowledge range and quantity proofs, ensuring that an enterprise's hidden delivery status strictly satisfies the policy-defined `maxProcurementDeliveryEpochs` window without disclosing line-item data.
- **Procurement Lifecycle Telemetry** — emits `SUPPLY_CHAIN_ORDER_INITIALIZED`, `ZK_DELIVERY_MILESTONE_VERIFIED`, and `PROCUREMENT_ESCROW_RELEASED` into the Track 29 ZK-rollup accumulator.

### Canonical supply chain order initialization payload wire layout

```
SCORDER:<orderId>:<sourceTenantId>:<targetChainId>:<blindedOrderValueCommitment>:<blindedLogisticsVolumeCommitment>:<blindedDepositMarginCommitment>:<deliveryEpochs>:<escrowFundingCap>:<pqcSignatureScheme>:<procurementInitiatorAttestationHash>:<committeeSignature>
```

### Canonical delivery milestone verification payload wire layout

```
MILESTONE:<milestoneId>:<orderId>:<blindedDeliveryQuantityCommitment>:<blindedDeliveryValueCommitment>:<zkMilestoneRangeProofHash>:<clearingCommitteeAttestationHash>:<partialSignature>
```

### Canonical escrow release payload wire layout

```
ESCROWRELEASE:<releaseId>:<orderId>:<milestoneSignatureCount>:<pqcSignatureScheme>:<committeeSignatures>
```

### Policy schema additions

- `pqSupplyChainEscrow`:
  - `minOrderMatchingQuorum`: 3
  - `maxProcurementDeliveryEpochs`: 30
  - `maxEscrowFundingCap`: 1000000000
  - `allowedPqcSignatureSchemes`: `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`
  - `requireProcurementInitiatorAttestation`: true
  - `requireClearingCommitteeAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banMalformedOrOutOfOrderDeliveryAssertions`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All decentralized supply chain criteria—including minimum order matching quorums, maximum procurement delivery epochs, allowed escrow funding caps, and post-quantum signature schemes—are managed dynamically via the dedicated `pqSupplyChainEscrow` stanza in the active `CryptoPolicyEngine` schema.
- Both the procurement-initializing endpoint and the processing clearing committee relays must pass `EnclaveAttestationClient.verify()` before a state transition can be signed (Track 41 integration).
- The `PqcSupplyChainEscrowHub` instantiates multi-party procurement pools using homomorphically additive Pedersen commitments over order values, logistics volumes, and deposit margins, preventing supply chain profiling and participant tracking.
- The `ZkOrderMilestoneValidator` processes non-interactive zero-knowledge range and quantity proofs, ensuring that an enterprise's hidden delivery status strictly satisfies the policy-defined `maxProcurementDeliveryEpochs` window without disclosing line-item data.
- Peers broadcasting malformed or out-of-order delivery assertions are automatically banned when `banMalformedOrOutOfOrderDeliveryAssertions` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `PqcSupplyChainEscrowHub` initializes a supply chain order and emits `SUPPLY_CHAIN_ORDER_INITIALIZED`.
- [ ] `ZkOrderMilestoneValidator` verifies a valid delivery milestone and emits `ZK_DELIVERY_MILESTONE_VERIFIED`.
- [ ] `PqcSupplyChainEscrowHub` releases escrow after milestone verification and emits `PROCUREMENT_ESCROW_RELEASED`.
- [ ] `CryptoPolicyEngine` validates a compliant `pqSupplyChainEscrow` configuration.

### Security / edge cases

- [ ] Reject order matching quorum below `minOrderMatchingQuorum`.
- [ ] Reject procurement delivery epochs exceeding `maxProcurementDeliveryEpochs`.
- [ ] Reject escrow funding cap exceeding `maxEscrowFundingCap`.
- [ ] Reject PQC signature scheme not in `allowedPqcSignatureSchemes`.
- [ ] Reject un-attested procurement initiator.
- [ ] Reject un-attested clearing committee.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject delivery milestones exceeding the delivery epoch window.
- [ ] Reject malformed milestone proofs (missing zkMilestoneRangeProofHash, missing partialSignature).
- [ ] Reject duplicate order initializations.
- [ ] Reject escrow release before milestone verification.
- [ ] Reject escrow release with insufficient quorum.
- [ ] Automatically ban peers broadcasting malformed or out-of-order delivery assertions.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqSupplyChainEscrow` for `operation === 'pqSupplyChainEscrow'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pq-supply-chain-escrow` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pq-supply-chain-escrow`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a three-node clearing committee with attested procurement initiator and clearing committee relay, verify delivery milestone authentication and escrow release after quorum.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-supply-chain-escrow-hub.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-order-milestone-validator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-supply-chain-escrow.test.cjs` *(new)*

## Extension scope (Track 68 Phase 2)

### New capabilities added

- **Delivery epoch rebalancing** — rebalance delivery epochs with increase/decrease directions, epoch tracking, and optional new delivery epoch updates.
- **Batch order initialization** — initialize multiple supply chain orders in a single batch call with per-order results.
- **Committee signature aggregation** — BLS-style aggregate signature from partial committee signatures.
- **Order cancellation** — cancel open orders (rejects if released/settled).
- **Cross-chain settlement coordination** — settle released orders on the target chain with settlement proof hashes.
- **Hardware-accelerated SNARK proof generation** — generate Groth16 SNARK proofs with configurable HW acceleration (GPU CUDA, FPGA, ASIC, simulated).
- **Batch milestone verification** — verify multiple delivery milestone proofs in a single batch call with per-milestone results.
- **Partial signature aggregation** — aggregate partial signatures from clearing committee members with banned-peer rejection.
- **Slashing window validation** — validate milestone timestamps within configurable slashing window.
- **Slashing event recording** — record slash events with reason codes (malformed_milestone, duplicate_milestone, epoch_out_of_bounds, order_not_found, banned_peer, out_of_window).
- **Summary statistics** — both hub and validator expose `getStats()` methods.

### Extension test checklist

#### Positive paths

- [x] Delivery epoch rebalance with increase direction.
- [x] Delivery epoch rebalance with decrease direction.
- [x] Delivery epoch updates on rebalance.
- [x] Batch initialization creates multiple orders.
- [x] Cross-chain settlement works for released orders.
- [x] Committee signatures can be aggregated.
- [x] Orders can be cancelled.
- [x] HW-SNARK proof generation produces Groth16 proofs.
- [x] Batch milestone verification processes multiple proofs.
- [x] Partial signatures can be aggregated.
- [x] Slashing window validation works for in-window milestones.
- [x] Full init → rebalance → milestone → release → settle flow works end-to-end.

#### Security / edge cases

- [x] Reject rebalance with invalid direction.
- [x] Reject rebalance with non-positive amount.
- [x] Reject rebalance with missing orderId.
- [x] Reject rebalance on released order.
- [x] Reject batch init with empty array.
- [x] Reject batch init exceeding max size.
- [x] Reject settlement of non-released order.
- [x] Reject settlement with mismatched chain.
- [x] Reject settlement with missing orderId.
- [x] Reject settlement with missing targetChainId.
- [x] Reject committee aggregation with insufficient signatures.
- [x] Reject committee aggregation with no signatures.
- [x] Reject committee aggregation for unknown order.
- [x] Reject cancelling released order.
- [x] Reject double cancellation.
- [x] Reject cancelling unknown order.
- [x] Reject HW-SNARK proof generation with missing orderId.
- [x] Reject HW-SNARK proof generation with missing values.
- [x] Reject HW-SNARK proof generation for unknown order.
- [x] Reject empty batch milestone verification.
- [x] Reject batch milestone verification exceeding max size.
- [x] Reject partial signature aggregation with banned peer.
- [x] Reject partial signature aggregation with insufficient signatures.
- [x] Reject partial signature aggregation with missing orderId.
- [x] Detect milestone outside slashing window.
- [x] Reject slashing window validation for unknown order.
- [x] Reject slashing window validation with invalid timestamp.
- [x] Reject slashing window validation with missing orderId.
- [x] Record slashes for malformed milestones.
- [x] Record slashes for out-of-bounds epoch.
- [x] Record slashes for duplicate milestones.
- [x] MILESTONE_STATUS, SLASH_REASON, HW_ACCEL_TYPES, ORDER_STATUS, REBALANCE_DIRECTION constants exported.

## Files changed (Phase 2 extension)

- `ai-platform/server/lib/hsm-adapter/pqc-supply-chain-escrow-hub.cjs` *(extended)*
- `ai-platform/server/lib/hsm-adapter/zk-order-milestone-validator.cjs` *(extended)*
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs` *(14 new counters)*
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-supply-chain-escrow-extensions.test.cjs` *(new, 54 tests)*

## Approval

Phase 1: Approved and merged (15 tests).
Phase 2: Pending Validator review.
