## Track 28: Software-Based Confidential Computing Sandboxing & Enclave Isolation

This PR adds a software-isolated sandboxing and memory-shielding layer to the HSM adapter stack.

### Core primitives

- **SandboxIsolationBroker** (`sandbox-isolation-broker.cjs`)
  - Simulates an isolated runtime ring (`wasm`, `gvisor`, `bubblewrap`) for sensitive cryptographic payloads.
  - Generates attestation logs and executes wrap/split/sign operations in a sandboxed context.
  - Emits `SANDBOX_ENCLAVE_INITIALIZED` telemetry.

- **MemoryShield** (`memory-shield.cjs`)
  - Tracks sensitive buffers and applies periodic `memoryWipeIntervalMs` page-wipe operations.
  - Rejects oversized buffers and expired allocations, using `secureZeroize` for wipe.
  - Emits `MEMORY_SHIELD_PURGED` telemetry.

### Policy integration

- `crypto-policy-schema.json` now defines the `enclave` stanza.
- `crypto-policy-engine.cjs` enforces `_validateEnclave` for the `enclave` operation.
- `base-adapter.cjs` adds `emitSandboxEnclaveInitialized` and `emitMemoryShieldPurged` hooks.

### Verification

```bash
cd ai-platform
npx jest enclave-sandbox
```

```text
Test Suites: 1 passed, 1 total
Tests:       7 passed, 7 total
```

```bash
npm run sb:hook:pre-commit
```

```text
Gate: PASS
Critical: 0  High: 0  Medium: 0  Low: 5
```
