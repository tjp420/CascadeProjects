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

## Approval

Pending Validator review.
