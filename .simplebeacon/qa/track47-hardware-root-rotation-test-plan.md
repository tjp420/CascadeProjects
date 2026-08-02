# Track 47: Decentralized Multi-Signature Hardware Root Rotations — Test Plan

## Objective

Expand Track 41 secure hardware enclave isolation into a decentralized operational lifecycle. Master enclave master seeds must be rotated without host interception, requiring a threshold quorum of administrator hardware module assertions and re-derivation of the platform's root keys inside protected memory pages.

## Scope

### Core primitives

- **EnclaveRootRotator** — locks hardware master seed updates behind a multi-signature quorum and validates attestation for every participating admin endpoint.
- **EnclaveKeyDeriver** — regenerates root public/private master keys directly inside protected memory after an epoch rotation clears old states.
- **RotationTelemetry** — emits `ENCLAVE_ROOT_ROTATION_INITIATED` and `HARDWARE_SEED_COMMITTED` into the Track 29 ZK-rollup accumulator.

### Canonical signature payload layout for root rotation proposal

```
ROTATION:<epochId>:<previousSeedHash>:<proposedSeedHash>:<proposerEnclaveId>:<timestamp>:<adminSignatures...>
```

### Policy schema additions

- `hardwareRootRotation`:
  - `minAdminQuorum`: 3
  - `maxSignatureExpirationSeconds`: 60
  - `requireAdminAttestation`: true
  - `allowedAdminAuthorities`: `["mock-authority"]`
  - `requirePreviousSeedZeroization`: true
  - `maxRotationEpochIntervalSeconds`: 86400
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- Every participating admin endpoint must pass `EnclaveAttestationClient.verify()` before its signature is accepted (Track 41 integration).
- A minimum `minAdminQuorum` of admin enclave signatures is required before the new seed can be committed.
- The `EnclaveKeyDeriver` regenerates the platform's root key pair inside protected memory after zeroizing the previous seed.
- The `EnclaveRootRotator` rejects any proposal whose signatures are older than `maxSignatureExpirationSeconds`.
- The canonical payload layout must be enforced and the signatures must be verified against the payload.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `EnclaveRootRotator` initiates a root rotation and emits `ENCLAVE_ROOT_ROTATION_INITIATED`.
- [ ] `EnclaveRootRotator` commits a new hardware seed after reaching `minAdminQuorum`.
- [ ] `EnclaveKeyDeriver` regenerates the root key pair from the new seed inside protected memory.
- [ ] `CryptoPolicyEngine` validates a compliant `hardwareRootRotation` configuration.
- [ ] `base-adapter.cjs` emits `ENCLAVE_ROOT_ROTATION_INITIATED` and `HARDWARE_SEED_COMMITTED`.
- [ ] `ZkRollupAccumulator` ingests `ENCLAVE_ROOT_ROTATION_INITIATED` events.

### Security / edge cases

- [ ] Reject rotation without `minAdminQuorum` signatures.
- [ ] Reject signatures from un-attested admin endpoints.
- [ ] Reject signatures older than `maxSignatureExpirationSeconds`.
- [ ] Reject rotation from an unauthorized admin authority.
- [ ] Reject commitment when `requirePreviousSeedZeroization` is not satisfied.
- [ ] Reject a proposal that does not follow the canonical payload layout.
- [ ] Reject a rotation whose epoch interval is below `maxRotationEpochIntervalSeconds`.

### Integration

- [ ] `CryptoPolicyEngine` has `_validateHardwareRootRotation` for `operation === 'hardwareRootRotation'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `hardware-root-rotation` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest hardware-root-rotation`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a full admin enclave quorum rotating the hardware root seed and deriving new root keys.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/enclave-root-rotator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/enclave-key-deriver.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/hardware-root-rotation.test.cjs` *(new)*

## Approval

Pending Validator review.
