# Track 63: Post-Quantum Zero-Knowledge Cross-Chain Blind Option Pools — Test Plan

## Objective

Establish a privacy-preserving financial option contract plane that scales cross-chain. Track 63 ensures non-repudiable, privacy-preserving multi-party financial execution while strictly defending against contract manipulation and structural counterparty profiling. Builds directly upon Track 48 post-quantum asset bridges, Track 50 zero-knowledge settlement engines, and Track 58 threshold vesting locks, enabling users to execute and clear conditional cross-chain smart-contract options over fully blinded asset values, strike parameters, and participant identities with zero-knowledge margin-adequacy verifications.

## Scope

### Core primitives

- **PqcBlindOptionPoolHub** — interlocking contract coordinator that instantiates blinded option pools using homomorphically additive Pedersen commitments over values, strikes, and collateral thresholds.
- **ZkMarginAdequacyProcessor** — succinct proof validator that processes non-interactive zero-knowledge range proofs to verify that hidden collateral values meet or exceed option strike requirements without disclosing individual asset amounts.
- **Option Execution Telemetry** — emits `BLIND_OPTION_POOL_INITIALIZED`, `ZK_MARGIN_ADEQUACY_VERIFIED`, and `BLIND_OPTION_CONTRACT_EXECUTED` into the Track 29 ZK-rollup accumulator.

### Canonical blind option pool initialization payload wire layout

```
OPTPOOL:<poolId>:<sourceTenantId>:<targetChainId>:<blindedValueCommitment>:<blindedStrikeCommitment>:<blindedCollateralCommitment>:<collateralRatio>:<expirationTimestamp>:<pqcSignatureScheme>:<initializerAttestationHash>:<committeeSignature>
```

### Canonical margin adequacy proof payload wire layout

```
MARGINPROOF:<proofId>:<poolId>:<blindedCollateralCommitment>:<blindedStrikeCommitment>:<zkRangeProofHash>:<clearingCommitteeAttestationHash>:<partialSignature>
```

### Canonical option execution claim payload wire layout

```
OPTEXEC:<execId>:<poolId>:<executionSignatureCount>:<clearingCommitteeAttestationHash>:<pqcSignatureScheme>:<committeeSignatures>
```

### Policy schema additions

- `pqBlindOptionPools`:
  - `minCollateralRatio`: 150
  - `minExecutionSignatureQuorum`: 3
  - `maxContractLifetimeSeconds`: 2592000
  - `allowedPqcSignatureSchemes`: `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`
  - `requireInitializerAttestation`: true
  - `requireClearingCommitteeAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banMalformedOrSubCollateralProofs`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All blind option pool criteria—including minimum collateral ratios, minimum execution signature quorums, and maximum allowed contract expiration durations—are managed dynamically via the dedicated `pqBlindOptionPools` stanza in the active `CryptoPolicyEngine` schema.
- Both the contract-initializing endpoint and the processing clearing committee relays must pass `EnclaveAttestationClient.verify()` before a pool state transition can be signed (Track 41 integration).
- The `PqcBlindOptionPoolHub` instantiates blinded option pools using homomorphically additive Pedersen commitments over values, strikes, and collateral thresholds, preventing counterparty profiling.
- The `ZkMarginAdequacyProcessor` processes non-interactive zero-knowledge range proofs to verify that hidden collateral values meet or exceed option strike requirements without disclosing individual asset amounts.
- Peers broadcasting malformed or sub-collateral execution proofs are automatically banned when `banMalformedOrSubCollateralProofs` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `PqcBlindOptionPoolHub` initializes a blind option pool and emits `BLIND_OPTION_POOL_INITIALIZED`.
- [ ] `ZkMarginAdequacyProcessor` verifies a valid margin adequacy proof and emits `ZK_MARGIN_ADEQUACY_VERIFIED`.
- [ ] `PqcBlindOptionPoolHub` executes a cleared option contract and emits `BLIND_OPTION_CONTRACT_EXECUTED`.
- [ ] `CryptoPolicyEngine` validates a compliant `pqBlindOptionPools` configuration.

### Security / edge cases

- [ ] Reject collateral ratio below `minCollateralRatio`.
- [ ] Reject execution signature quorum below `minExecutionSignatureQuorum`.
- [ ] Reject contract lifetime exceeding `maxContractLifetimeSeconds`.
- [ ] Reject PQC signature scheme not in `allowedPqcSignatureSchemes`.
- [ ] Reject un-attested initializer.
- [ ] Reject un-attested clearing committee.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject sub-collateral margin adequacy proofs (collateral < strike).
- [ ] Reject malformed margin proofs (missing zkRangeProofHash, missing partialSignature).
- [ ] Reject duplicate pool initializations.
- [ ] Reject execution attempts before margin adequacy verification.
- [ ] Reject execution attempts on expired contracts.
- [ ] Automatically ban peers broadcasting malformed or sub-collateral proofs.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqBlindOptionPools` for `operation === 'pqBlindOptionPools'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pq-blind-option-pools` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pq-blind-option-pools`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a three-node clearing committee with attested initializer and clearing committee relay, verify margin adequacy proof authentication and option contract execution.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Extension scope (Track 63 Phase 2)

### New capabilities added

- **VDF-locked execution windows** — each pool now carries Wesolowski VDF parameters (difficulty, seed, proof hash, unlock timestamp). Enforcement is opt-in via `enforceVdfLock` flag.
- **Cross-chain settlement coordination** — settle executed contracts on the target chain with settlement proof hashes.
- **Batch pool initialization** — initialize multiple pools in a single batch call with per-pool results.
- **Committee signature aggregation** — BLS-style aggregate signature from partial committee signatures.
- **Pool cancellation** — cancel open pools (rejects if already executed/settled).
- **Pool expiration** — explicitly expire pools past their useful window.
- **Hardware-accelerated SNARK proof generation** — generate Groth16 SNARK proofs with configurable HW acceleration (GPU CUDA, FPGA, ASIC, simulated).
- **Batch margin verification** — verify multiple margin adequacy proofs in a single batch call.
- **Partial signature aggregation** — aggregate partial signatures from clearing committee members with banned-peer rejection.
- **Slashing window validation** — validate proof timestamps within configurable slashing window.
- **Slashing event recording** — record slash events with reason codes (sub-collateral, collateral below strike, malformed, duplicate, banned peer).
- **Summary statistics** — both hub and processor expose `getStats()` methods.

### Extension test checklist

#### Positive paths

- [x] Pool initialization includes VDF lock parameters.
- [x] VDF lock is not enforced by default (backward compatible).
- [x] VDF lock is enforced when `enforceVdfLock` is true.
- [x] Cross-chain settlement works for executed contracts.
- [x] Batch initialization creates multiple pools.
- [x] Committee signatures can be aggregated.
- [x] Pools can be cancelled.
- [x] Pools can be expired.
- [x] HW-SNARK proof generation produces Groth16 proofs.
- [x] Batch margin verification processes multiple proofs.
- [x] Partial signatures can be aggregated.
- [x] Slashing window validation works for in-window proofs.
- [x] Full init → HW-SNARK → margin → aggregate → execute → settle flow works end-to-end.

#### Security / edge cases

- [x] Reject VDF difficulty below minimum.
- [x] Reject VDF difficulty above maximum.
- [x] Reject execution when VDF lock is enforced and not yet unlocked.
- [x] Reject settlement of non-executed pool.
- [x] Reject settlement with mismatched chain.
- [x] Reject settlement with missing poolId.
- [x] Reject settlement with missing targetChainId.
- [x] Reject batch init with empty array.
- [x] Reject batch init exceeding max size.
- [x] Reject committee aggregation with insufficient signatures.
- [x] Reject committee aggregation with no signatures.
- [x] Reject committee aggregation for unknown pool.
- [x] Reject cancelling executed pool.
- [x] Reject double cancellation.
- [x] Reject double expiration.
- [x] Reject cancelling unknown pool.
- [x] Reject expiring unknown pool.
- [x] Reject HW-SNARK proof generation with missing poolId.
- [x] Reject HW-SNARK proof generation with missing values.
- [x] Reject HW-SNARK proof generation for unknown pool.
- [x] Reject empty batch verification.
- [x] Reject batch verification exceeding max size.
- [x] Reject partial signature aggregation with banned peer.
- [x] Reject partial signature aggregation with insufficient signatures.
- [x] Reject partial signature aggregation with missing poolId.
- [x] Detect proof outside slashing window.
- [x] Reject slashing window validation for unknown pool.
- [x] Reject slashing window validation with invalid timestamp.
- [x] Record slashes for sub-collateral proofs.
- [x] PROOF_STATUS, SLASH_REASON, HW_ACCEL_TYPES, POOL_STATUS, VDF_PARAMS constants exported.

## Files changed (Phase 2 extension)

- `ai-platform/server/lib/hsm-adapter/pqc-blind-option-pool-hub.cjs` *(extended)*
- `ai-platform/server/lib/hsm-adapter/zk-margin-adequacy-processor.cjs` *(extended)*
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs` *(14 new counters)*
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-blind-option-pools-extensions.test.cjs` *(new, 53 tests)*

## Approval

Phase 1: Approved and merged (15 tests).
Phase 2: Pending Validator review.
