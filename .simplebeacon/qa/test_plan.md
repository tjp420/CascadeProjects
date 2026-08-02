# Test Plan — Track 28: Confidential Computing Sandboxing

**Branch:** `feature/track28-confidential-sandboxing`
**Date:** 2026-08-02
**Status:** Active

## Objective

Implement a confidential computing sandbox engine that creates isolated execution environments for sensitive cryptographic operations. The sandbox enforces memory isolation, attestation-gated access, and zeroization of sensitive data after execution. This builds on the existing enclave attestation infrastructure (Track 41) and enclave state manager (Track 47).

## Design

- **Sandbox lifecycle**: create → attest → execute → zeroize → destroy
- **Attestation gating**: Sandboxes require valid attestation before execution (integrates with `EnclaveAttestationClient`)
- **Memory isolation**: Each sandbox has an isolated memory context with scoped key material
- **Execution context**: Sensitive operations run inside the sandbox with restricted access to host keys
- **Zeroization**: All sensitive data is zeroized after sandbox execution completes
- **Policy enforcement**: Sandbox creation, execution time limits, and allowed operations are policy-gated

## Change Set

| File | Change |
|------|--------|
| `server/lib/hsm-adapter/confidential-sandbox-engine.cjs` | **New** — Confidential sandbox engine |
| `server/lib/hsm-adapter/__tests__/confidential-sandbox.test.cjs` | **New** — Test suite |
| `server/lib/hsm-adapter/crypto-policy-engine.cjs` | Add `confidentialSandbox` policy block |
| `server/lib/hsm-adapter/hsm-metrics.cjs` | Add sandbox counters |

## Check Items

### Level 1 — Deterministic

- [ ] L1.1 `node -c confidential-sandbox-engine.cjs` — syntax pass
- [ ] L1.2 `node -c confidential-sandbox.test.cjs` — syntax pass
- [ ] L1.3 `node -c crypto-policy-engine.cjs` — syntax pass
- [ ] L1.4 `node -c hsm-metrics.cjs` — syntax pass
- [ ] L1.5 `npm test` (ai-platform) — all tests pass, no new failures
- [ ] L1.6 No new dependencies added
- [ ] L1.7 No secrets/keys committed

### Level 2 — Functional Operations

- [ ] L2.01 Full happy-path: create sandbox → attest → execute → zeroize → destroy
- [ ] L2.02 Sandbox creation with valid attestation passes
- [ ] L2.03 Sandbox creation with invalid attestation rejected
- [ ] L2.04 Execute operation inside sandbox returns correct result
- [ ] L2.05 Sandbox memory is zeroized after execution
- [ ] L2.06 Sandbox lifecycle: cannot execute before attestation
- [ ] L2.07 Sandbox lifecycle: cannot execute after destruction
- [ ] L2.08 Policy validation: confidentialSandbox.maxExecutionTimeSeconds enforced
- [ ] L2.09 Policy validation: confidentialSandbox.allowedOperations enforced

### Level 3 — Security Engineering

- [ ] L3.01 Unattested sandbox cannot execute operations
- [ ] L3.02 Expired attestation rejected
- [ ] L3.03 Disallowed operation rejected by policy
- [ ] L3.04 Memory zeroization verified (sensitive data cleared)
- [ ] L3.05 No scope creep — only sandbox engine + policy + metrics + tests
- [ ] L3.06 No ghost files or hallucinated API paths
- [ ] L3.07 All existing tests still pass (no regression)
