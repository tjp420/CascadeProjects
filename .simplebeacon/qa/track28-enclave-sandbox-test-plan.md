# Track 28: Software-Based Confidential Computing Sandboxing & Enclave Isolation — Test Plan

## Objective

Introduce software-isolated sandboxing and defense-in-depth memory shielding to protect cryptographic keys during cross-process or high-throughput microservice transport, keeping the system portable and cloud-native.

## Scope

### Core primitives

- `SandboxIsolationBroker` — shifts key-payload execution (wrap, threshold split, blinding) into an isolated execution ring, simulating a WASM or isolated-process runtime.
- `MemoryShield` — tracks sensitive data buffers and applies microsecond-level page-wipe operations at `memoryWipeIntervalMs`.
- `EnclaveTelemetry` — emits `SANDBOX_ENCLAVE_INITIALIZED` and `MEMORY_SHIELD_PURGED` audit events.

### Policy schema additions

- `enclave`:
  - `sandboxMode` and `allowedSandboxModes`
  - `memoryWipeIntervalMs` and `maxSensitiveBufferAgeMs`
  - `requirePageBoundaryTracking` and `pageSizeBytes`
  - `requireAttestationLog` and `attestationTimeoutMs`

## Test checklist

### Positive paths

- [ ] `SandboxIsolationBroker` initializes a sandbox and emits `SANDBOX_ENCLAVE_INITIALIZED`.
- [ ] `MemoryShield` purges a sensitive buffer and emits `MEMORY_SHIELD_PURGED`.
- [ ] `SandboxIsolationBroker` executes a wrap payload and returns the expected result.
- [ ] Policy validation accepts a valid `enclave` configuration.
- [ ] Telemetry events are SHA-256 chained with the Track 10 audit pipeline.

### Security / edge cases

- [ ] Reject an unauthorized `sandboxMode`.
- [ ] Reject `memoryWipeIntervalMs` above `maxSensitiveBufferAgeMs`.
- [ ] Reject sandbox execution when `requireAttestationLog` is true and attestation is missing.
- [ ] `MemoryShield` rejects buffers that exceed `maxSensitiveBufferAgeMs`.
- [ ] `SandboxIsolationBroker` fails closed on sandbox initialization errors.

### Integration

- [ ] `base-adapter.cjs` emits enclave telemetry hooks.
- [ ] `CryptoPolicyEngine` validates `enclave` configuration.
- [ ] `MemoryShield` integrates with `secure-zeroize.cjs` if present.

## Level mapping

- **L1 Deterministic**: `node -c` on new `.cjs` files, `npx jest enclave-sandbox`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Manual sandbox round-trip with a wrapped key payload.
- **L3 Reflection**: Spec alignment with Track 28, no ghost modules, minimal file count.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/sandbox-isolation-broker.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/memory-shield.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`

## Approval

Pending Validator review.
