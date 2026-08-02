# Track 58: Cross-Platform Quantum-Resistant Threshold Asset Vesting Locks — Test Plan

## Objective

Establish a multi-party, epoch-bounded lockup contract that allows assets to be held in a trustless escrow across separate platform topologies, requiring a threshold of verified committee signatures before releasing portions of the funds over policy-defined time windows. Track 58 ensures non-repudiable, time-locked asset dispersal while defending against single-node compromise and temporal clock manipulations. Building on Track 48 post-quantum asset bridges, Track 50 zero-knowledge settlement engines, and Track 22 time anchor engine.

## Scope

### Core primitives

- **PqcVestingEscrowHub** — interlocking release coordinator that maps hidden asset balances to multi-epoch distribution milestones, validating incoming release claims using post-quantum ML-DSA threshold signatures.
- **VestingTemporalGuard** — time-lock verification engine tied to the Track 22 TimeAnchorEngine to strictly prevent premature asset extraction and block adversarial system clock acceleration strategies.
- **Vesting Lifecycle Telemetry** — emits `VESTING_LOCK_INITIALIZED`, `VESTING_EPOCH_RELEASE_CLAIMED`, and `VESTING_ESCROW_COMPLETED` into the Track 29 ZK-rollup accumulator.

### Canonical vesting lock initialization payload wire layout

```
VESTINIT:<lockId>:<sourceTenantId>:<assetId>:<assetValue>:<totalEpochs>:<epochSeconds>:<pqcSignatureScheme>:<claimantAttestationHash>:<committeeSignature>
```

### Canonical epoch release claim payload wire layout

```
VESTCLAIM:<claimId>:<lockId>:<epochIndex>:<releaseAmount>:<claimantAttestationHash>:<committeeRelayAttestationHash>:<thresholdSignature>
```

### Policy schema additions

- `pqcVestingLocks`:
  - `minVestingEpochSeconds`: 3600
  - `minReleaseSignatureQuorum`: 3
  - `maxAssetValueCap`: 1000000
  - `allowedPqcSignatureSchemes`: `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`
  - `requireClaimantAttestation`: true
  - `requireCommitteeRelayAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banExpiredOrDuplicateClaims`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All parameter limitations—including minimum vesting epoch durations, threshold release quorums, maximum allowed asset value caps, and post-quantum signature schemes—are managed dynamically via the dedicated `pqcVestingLocks` stanza in the active `CryptoPolicyEngine` schema.
- Both the asset-claiming endpoint and the processing committee relays must pass `EnclaveAttestationClient.verify()` before a release vector can be committed (Track 41 integration).
- The `PqcVestingEscrowHub` maps hidden asset balances to multi-epoch distribution milestones, requiring `minReleaseSignatureQuorum` committee signatures before releasing funds.
- The `VestingTemporalGuard` ties into the Track 22 TimeAnchorEngine to prevent premature asset extraction and block adversarial system clock acceleration.
- Peers broadcasting expired or duplicate milestone release requests are automatically banned when `banExpiredOrDuplicateClaims` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `PqcVestingEscrowHub` initializes a vesting lock and emits `VESTING_LOCK_INITIALIZED`.
- [ ] `PqcVestingEscrowHub` processes a valid epoch release claim with threshold signatures and emits `VESTING_EPOCH_RELEASE_CLAIMED`.
- [ ] `PqcVestingEscrowHub` completes all epochs and emits `VESTING_ESCROW_COMPLETED`.
- [ ] `VestingTemporalGuard` permits release after the epoch window has elapsed.
- [ ] `CryptoPolicyEngine` validates a compliant `pqcVestingLocks` configuration.

### Security / edge cases

- [ ] Reject vesting epoch below `minVestingEpochSeconds`.
- [ ] Reject release signature quorum below `minReleaseSignatureQuorum`.
- [ ] Reject asset value exceeding `maxAssetValueCap`.
- [ ] Reject PQC signature scheme not in `allowedPqcSignatureSchemes`.
- [ ] Reject un-attested claimant endpoints.
- [ ] Reject un-attested committee relays.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject premature release claims before epoch window elapses.
- [ ] Reject adversarial clock acceleration attempts.
- [ ] Automatically ban peers broadcasting expired or duplicate claims.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqcVestingLocks` for `operation === 'pqcVestingLocks'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pqc-vesting-locks` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pqc-vesting-locks`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a three-node committee vesting lock with attested claimant and committee relays, verify epoch release and completion.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-vesting-escrow-hub.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/vesting-temporal-guard.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pqc-vesting-locks.test.cjs` *(new)*

## Approval

Pending Validator review.
