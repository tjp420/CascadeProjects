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

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-prediction-market-hub.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-market-resolution-validator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-prediction-markets.test.cjs` *(new)*

## Approval

Pending Validator review.
