# Track 41: Hardware-Enforced Secure Enclaves & Remote Attestation — Test Plan

## Objective

Shift core cryptographic operations into hardware-isolated TEEs (Intel SGX / AWS Nitro Enclaves), protecting key material and consensus state from host-root compromise. Implement remote attestation verification before key provisioning.

## Scope

### Core primitives

- **HardwareEnclaveAdapter** — wraps HSM operations behind an SGX/Nitro enclave boundary; loads secrets only inside the enclave.
- **EnclaveAttestationClient** — fetches and verifies signed attestation evidence (measurement, timestamp, signature) against configured manufacturer root authorities.
- **EnclaveBoundaryTelemetry** — emits `ENCLAVE_HARDWARE_BOOTSTRAPPED` and `ATTESTATION_CHALLENGE_VERIFIED` events into the Track 29 ZK-rollup telemetry pipeline.

### Policy schema additions

- `enclave`:
  - `allowedEnclaveTypes`: `["intel-sgx", "aws-nitro"]`
  - `requiredMRENCLAVEHashes`: `[]`
  - `allowedAttestationAuthorities`: `[]`
  - `requireRemoteAttestation`: `true`
  - `minAttestationTtlSeconds`: `300`
  - `allowedEnclaveCiphers`: `["aes-256-gcm"]`
  - `maxAttestationAgeSeconds`: `60`

### Mock attestation format

- `attestation-doc.json` / `attestation-doc.cose` mock bundle for unit tests.
- Contains `measurement`, `timestamp`, `pcrs` (if Nitro), `reportData`, `signature`, and `authority`.

## Design decisions

- Hardware-agnostic interface: the adapter accepts a `backend` option (`sgx`/`nitro`/`mock`).
- Attestation happens once at bootstrap; verified documents are cached for `minAttestationTtlSeconds`.
- Key provisioning is blocked unless the enclave measurement is in `requiredMRENCLAVEHashes` and the authority signature is valid.
- Telemetry events are emitted through `base-adapter.cjs` audit hooks.

## Test checklist

### Positive paths

- [ ] `HardwareEnclaveAdapter` initializes in `mock` mode and seals a test key.
- [ ] `EnclaveAttestationClient` validates a correctly signed mock attestation document.
- [ ] `CryptoPolicyEngine` accepts an enclave configuration with an allowed type and known MRENCLAVE hash.
- [ ] `base-adapter.cjs` emits `ENCLAVE_HARDWARE_BOOTSTRAPPED` on adapter initialization.
- [ ] `base-adapter.cjs` emits `ATTESTATION_CHALLENGE_VERIFIED` after successful verification.

### Security / edge cases

- [ ] Reject an attestation document from an unknown authority.
- [ ] Reject an attestation document whose measurement is not in the allowed list.
- [ ] Reject an expired attestation document (> `maxAttestationAgeSeconds`).
- [ ] Reject key provisioning when `requireRemoteAttestation` is `true` and no attestation exists.
- [ ] Reject an enclave type not in `allowedEnclaveTypes`.
- [ ] Reject an unsupported cipher in `allowedEnclaveCiphers`.

### Integration

- [ ] `CryptoPolicyEngine` has `_validateEnclave` for `operation === 'enclave'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes the new `hardware-enclave` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest hardware-enclave`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Mock enclave boot and attestation with known-bad signatures.
- **L3 Reflection**: Spec alignment, no native SGX/Nitro binary dependencies in tests.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/hardware-enclave-adapter.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/enclave-attestation-client.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/hardware-enclave.test.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/__tests__/fixtures/mock-attestation.json` *(new)*

## Approval

Pending Validator review.
