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

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-lending-collateral-hub.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-solvency-proof-processor.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-lending-pools.test.cjs` *(new)*

## Approval

Pending Validator review.
