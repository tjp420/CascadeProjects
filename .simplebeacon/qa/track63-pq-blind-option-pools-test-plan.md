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

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-blind-option-pool-hub.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-margin-adequacy-processor.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-blind-option-pools.test.cjs` *(new)*

## Approval

Pending Validator review.
