# Track 64: Post-Quantum Zero-Knowledge Decentralized Prediction Market Resolution Engines — Test Plan

## Objective

Establish a privacy-preserving oracle and betting resolution matrix that scales cross-chain. Track 64 ensures non-repudiable, privacy-preserving multi-party truth aggregation while protecting oracle configurations against single-node compromise and market manipulation loops. Bridges the zero-knowledge cross-chain blind option pools from Track 63 and the decentralized governance bridges from Track 59, enabling independent reporter nodes to settle market outsets anonymously using zero-knowledge binary or scalar value verification proofs without leaking their reporting stakes or individual transaction histories.

## Scope

### Core primitives

- **PqcPredictionMarketHub** — interlocking market supervisor that registers binary or scalar market conditions, records blinded resolution inputs using Pedersen commitments, and enforces the `minReporterQuorum` boundary.
- **ZkMarketResolutionValidator** — autonomous resolution verifier that aggregates partial evaluation signatures across active reporter cells, validating succinct zero-knowledge truth assertions without intermediate state or voter leakage.
- **Prediction Market Telemetry** — emits `PREDICTION_MARKET_INITIALIZED`, `ZK_RESOLUTION_VOTE_RECORDED`, and `PREDICTION_MARKET_FINALIZED` into the Track 29 ZK-rollup accumulator.

### Canonical prediction market initialization payload wire layout

```
PREDMKT:<marketId>:<sourceTenantId>:<targetChainId>:<marketType>:<blindedOutcomeCommitment>:<assetWeight>:<expirationTimestamp>:<pqcSignatureScheme>:<marketInitializerAttestationHash>:<committeeSignature>
```

### Canonical resolution vote payload wire layout

```
RESVOTE:<voteId>:<marketId>:<blindedVoteCommitment>:<zkTruthProofHash>:<reporterRelayAttestationHash>:<partialSignature>
```

### Canonical market finalization payload wire layout

```
PREDMKT_FINAL:<finalId>:<marketId>:<resolutionEpoch>:<reporterSignatureCount>:<pqcSignatureScheme>:<committeeSignatures>
```

### Policy schema additions

- `pqPredictionMarkets`:
  - `minReporterQuorum`: 3
  - `maxDisputeResolutionEpochs`: 5
  - `maxContractLifetimeSeconds`: 2592000
  - `maxAssetWeightCap`: 1000000
  - `allowedPqcSignatureSchemes`: `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`
  - `requireMarketInitializerAttestation`: true
  - `requireReporterRelayAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banMalformedOrOutOfOrderResolutionClaims`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All decentralized prediction market criteria—including minimum reporter quorums, maximum dispute resolution epochs, maximum allowed contract expiration durations, and permitted asset weight caps—are managed dynamically via the dedicated `pqPredictionMarkets` stanza in the active `CryptoPolicyEngine` schema.
- Both the market-initializing endpoint and the processing reporter relays must pass `EnclaveAttestationClient.verify()` before an event state transition can be staged (Track 41 integration).
- The `PqcPredictionMarketHub` registers binary or scalar market conditions, records blinded resolution inputs using Pedersen commitments, and enforces the `minReporterQuorum` boundary, preventing voter leakage.
- The `ZkMarketResolutionValidator` aggregates partial evaluation signatures across active reporter cells, validating succinct zero-knowledge truth assertions without intermediate state or voter leakage.
- Peers broadcasting malformed or out-of-order resolution claims are automatically banned when `banMalformedOrOutOfOrderResolutionClaims` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `PqcPredictionMarketHub` initializes a prediction market and emits `PREDICTION_MARKET_INITIALIZED`.
- [ ] `ZkMarketResolutionValidator` records a valid resolution vote and emits `ZK_RESOLUTION_VOTE_RECORDED`.
- [ ] `PqcPredictionMarketHub` finalizes a market after quorum and emits `PREDICTION_MARKET_FINALIZED`.
- [ ] `CryptoPolicyEngine` validates a compliant `pqPredictionMarkets` configuration.

### Security / edge cases

- [ ] Reject reporter quorum below `minReporterQuorum`.
- [ ] Reject dispute resolution epochs exceeding `maxDisputeResolutionEpochs`.
- [ ] Reject contract lifetime exceeding `maxContractLifetimeSeconds`.
- [ ] Reject asset weight exceeding `maxAssetWeightCap`.
- [ ] Reject PQC signature scheme not in `allowedPqcSignatureSchemes`.
- [ ] Reject un-attested market initializer.
- [ ] Reject un-attested reporter relay.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject finalization before quorum reached.
- [ ] Reject duplicate market initializations.
- [ ] Reject duplicate resolution votes from the same peer.
- [ ] Reject resolution votes on non-existent markets.
- [ ] Reject finalization on expired markets.
- [ ] Automatically ban peers broadcasting malformed or out-of-order resolution claims.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqPredictionMarkets` for `operation === 'pqPredictionMarkets'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pq-prediction-markets` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pq-prediction-markets`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a three-node reporter committee with attested market initializer and reporter relay, verify resolution vote authentication and market finalization after quorum.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Extension scope (Track 64 Phase 2)

### New capabilities added

- **Multi-asset privacy pool support** — markets can carry multi-asset pool parameters (asset IDs, blinded asset values, shielded pool type, Merkle root) with validation.
- **Batch market initialization** — initialize multiple markets in a single batch call with per-market results.
- **Dispute resolution escalation** — escalate markets to dispute status with epoch tracking and max epoch enforcement.
- **Cross-chain settlement coordination** — settle finalized markets on the target chain with settlement proof hashes.
- **Committee signature aggregation** — BLS-style aggregate signature from partial committee signatures.
- **Market cancellation/expiration** — cancel open markets, explicitly expire markets past their window.
- **Hardware-accelerated SNARK proof generation** — generate Groth16 SNARK proofs with configurable HW acceleration (GPU CUDA, FPGA, ASIC, simulated).
- **Batch vote recording** — record multiple resolution votes in a single batch call with per-vote results.
- **Partial signature aggregation** — aggregate partial signatures from reporter committee members with banned-peer rejection.
- **Slashing window validation** — validate vote timestamps within configurable slashing window.
- **Slashing event recording** — record slash events with reason codes (malformed, duplicate, market not open, banned peer, out of order).
- **Summary statistics** — both hub and validator expose `getStats()` methods.

### Extension test checklist

#### Positive paths

- [x] Market initialization with multi-asset pool parameters.
- [x] Batch initialization creates multiple markets.
- [x] Dispute resolution escalation works.
- [x] Cross-chain settlement works for finalized markets.
- [x] Committee signatures can be aggregated.
- [x] Markets can be cancelled.
- [x] Markets can be expired.
- [x] HW-SNARK proof generation produces Groth16 proofs.
- [x] Batch vote recording processes multiple votes.
- [x] Partial signatures can be aggregated.
- [x] Slashing window validation works for in-window votes.
- [x] Full init → vote → dispute → finalize → settle flow works end-to-end.

#### Security / edge cases

- [x] Reject multi-asset pool with no asset IDs.
- [x] Reject multi-asset pool with too many assets (>100).
- [x] Reject invalid multi-asset pool object.
- [x] Reject batch init with empty array.
- [x] Reject batch init exceeding max size.
- [x] Reject dispute escalation on finalized market.
- [x] Reject dispute escalation on cancelled market.
- [x] Reject dispute escalation exceeding max epochs.
- [x] Reject dispute with missing marketId.
- [x] Reject settlement of non-finalized market.
- [x] Reject settlement with mismatched chain.
- [x] Reject settlement with missing marketId.
- [x] Reject settlement with missing targetChainId.
- [x] Reject committee aggregation with insufficient signatures.
- [x] Reject committee aggregation with no signatures.
- [x] Reject committee aggregation for unknown market.
- [x] Reject cancelling finalized market.
- [x] Reject double cancellation.
- [x] Reject double expiration.
- [x] Reject cancelling unknown market.
- [x] Reject expiring unknown market.
- [x] Reject HW-SNARK proof generation with missing marketId.
- [x] Reject HW-SNARK proof generation with missing outcome.
- [x] Reject HW-SNARK proof generation for unknown market.
- [x] Reject empty batch vote recording.
- [x] Reject batch vote recording exceeding max size.
- [x] Reject partial signature aggregation with banned peer.
- [x] Reject partial signature aggregation with insufficient signatures.
- [x] Reject partial signature aggregation with missing marketId.
- [x] Detect vote outside slashing window.
- [x] Reject slashing window validation for unknown market.
- [x] Reject slashing window validation with invalid timestamp.
- [x] Record slashes for malformed votes.
- [x] VOTE_STATUS, SLASH_REASON, HW_ACCEL_TYPES, MARKET_STATUS, MARKET_TYPE constants exported.

## Files changed (Phase 2 extension)

- `ai-platform/server/lib/hsm-adapter/pqc-prediction-market-hub.cjs` *(extended)*
- `ai-platform/server/lib/hsm-adapter/zk-market-resolution-validator.cjs` *(extended)*
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs` *(16 new counters)*
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-prediction-markets-extensions.test.cjs` *(new, 56 tests)*

## Approval

Phase 1: Approved and merged (15 tests).
Phase 2: Pending Validator review.
