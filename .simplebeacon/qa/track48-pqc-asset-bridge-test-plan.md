# Track 48: Cross-Platform Quantum-Safe Asset Bridges — Test Plan

## Objective

Establish an interoperable, post-quantum bridge architecture to safely secure cross-system asset transfers without single-point private key dependencies. Orchestrate cross-platform asset locks and releases using ML-DSA/Dilithium threshold signatures and time-locked escrows.

## Scope

### Core primitives

- **PqcAssetBridgeHub** — interlocking transfer coordinator that broadcasts asset locks and releases using post-quantum threshold signatures from the Track 27 committee.
- **BridgeTimeLockEscrow** — epoch-bounded claim lock that keeps assets escrowed under strict expiration rules before unlocking on the target runtime.
- **BridgeTelemetry** — emits `BRIDGE_TRANSFER_INITIATED`, `CROSS_CHAIN_CLAIM_VALIDATED`, and `ESCROW_RELEASE_FINALIZED` into the Track 29 ZK-rollup accumulator.

### Canonical bridge transfer payload layout

```
BRIDGE:<sourcePlatform>:<targetPlatform>:<assetId>:<amount>:<recipient>:<lockEpoch>:<releaseEpoch>:<committeeSignatures...>
```

### Policy schema additions

- `assetBridge`:
  - `minCommitteeQuorum`: 3
  - `maxAssetTransactionValue`: 1000000
  - `minLockEpochDuration`: 60
  - `maxClaimExpirationEpochs`: 10
  - `requireSourceAttestation`: true
  - `requireTargetAttestation`: true
  - `allowedBridgeAuthorities`: `["mock-authority"]`
  - `requireTimeLockEscrow`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- The `PqcAssetBridgeHub` reuses the ML-DSA/Dilithium threshold signature pattern from Track 27 for committee-based signing.
- Both the local signing nodes and cross-platform bridge relays must pass `EnclaveAttestationClient.verify()` before a transfer can be broadcast (Track 41 integration).
- The `BridgeTimeLockEscrow` enforces `releaseEpoch > lockEpoch + minLockEpochDuration` and rejects claims beyond `maxClaimExpirationEpochs`.
- The canonical payload layout is enforced for every bridge transfer and the threshold signatures must verify against it.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `PqcAssetBridgeHub` initiates a bridge transfer and emits `BRIDGE_TRANSFER_INITIATED`.
- [ ] `PqcAssetBridgeHub` validates a committee quorum and signs the canonical payload.
- [ ] `BridgeTimeLockEscrow` locks assets and releases them after the time-lock expires.
- [ ] `CryptoPolicyEngine` validates a compliant `assetBridge` configuration.
- [ ] `base-adapter.cjs` emits `BRIDGE_TRANSFER_INITIATED`, `CROSS_CHAIN_CLAIM_VALIDATED`, and `ESCROW_RELEASE_FINALIZED`.
- [ ] `ZkRollupAccumulator` ingests `BRIDGE_TRANSFER_INITIATED` events.

### Security / edge cases

- [ ] Reject transfer without `minCommitteeQuorum` signatures.
- [ ] Reject transfer exceeding `maxAssetTransactionValue`.
- [ ] Reject transfer when source or target attestation fails.
- [ ] Reject transfer from an unauthorized bridge authority.
- [ ] Reject escrow release before the time-lock expires.
- [ ] Reject expired claims beyond `maxClaimExpirationEpochs`.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validateAssetBridge` for `operation === 'assetBridge'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pqc-asset-bridge` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pqc-asset-bridge`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a full cross-platform asset lock, validation, and escrow release.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-asset-bridge-hub.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/bridge-time-lock-escrow.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pqc-asset-bridge.test.cjs` *(new)*

## Approval

Pending Validator review.
