# Software Health Report — Track 28: Confidential Computing Sandboxing

**Date:** 2026-08-02
**Branch:** `feature/track28-confidential-sandboxing`
**Validator Sign-off:** Pending

## Summary

Implemented ConfidentialSandboxEngine that creates isolated execution environments for sensitive cryptographic operations. Each sandbox enforces attestation-gated access, memory isolation, and zeroization of sensitive data after execution. Integrates with existing EnclaveAttestationClient (Track 41).

## Change Set

| File | Change | Lines |
|------|--------|-------|
| `server/lib/hsm-adapter/confidential-sandbox-engine.cjs` | **New** — Confidential sandbox engine | 403 |
| `server/lib/hsm-adapter/__tests__/confidential-sandbox.test.cjs` | **New** — Test suite (31 tests) | 373 |
| `server/lib/hsm-adapter/crypto-policy-engine.cjs` | Added `confidentialSandbox` policy block + merge entry | +22 |
| `server/lib/hsm-adapter/hsm-metrics.cjs` | Added 8 sandbox counters + metadata | +18 |

## Level 1 — Deterministic (required)

| Check | Result |
|-------|--------|
| `node -c confidential-sandbox-engine.cjs` | PASS |
| `node -c confidential-sandbox.test.cjs` | PASS |
| `node -c crypto-policy-engine.cjs` | PASS |
| `node -c hsm-metrics.cjs` | PASS |
| Confidential sandbox test suite (31 tests) | PASS |
| PQC threshold test suite (27 tests) | PASS (no regression) |
| DKG test suite (29 tests) | PASS (no regression) |
| Policy engine test suite (16 tests) | PASS (no regression) |
| No new dependencies | Confirmed |
| No secrets committed | Confirmed |

## Level 2 — Functional Operations

| Test | Result |
|------|--------|
| L2.01: Happy-path create → attest → execute → zeroize → destroy | PASS |
| L2.02: Valid attestation passes | PASS |
| L2.03: Invalid attestation rejected | PASS |
| L2.04: hash, sign/verify, encrypt/decrypt, derive operations | PASS |
| L2.05: Memory zeroized after execution | PASS |
| L2.06: Cannot execute before attestation | PASS |
| L2.07: Cannot execute after destruction | PASS |
| L2.08: Policy maxExecutionTimeSeconds enforced | PASS |
| L2.09: Policy allowedOperations enforced | PASS |

## Level 3 — Security Engineering

| Test | Result |
|------|--------|
| L3.01: Unattested sandbox cannot execute | PASS |
| L3.02: Expired attestation rejected | PASS |
| L3.03: Disallowed operation rejected | PASS |
| L3.04: Memory zeroization verified (all buffers cleared) | PASS |
| L3.05: No scope creep — only engine + policy + metrics + tests | Confirmed |
| L3.06: No ghost files or hallucinated API paths | Confirmed |
| L3.07: All existing tests still pass (no regression) | Confirmed |

## Sandbox Lifecycle

1. **create** — allocate sandbox with scoped key material and policy-gated operations
2. **attest** — verify hardware attestation (via EnclaveAttestationClient or mock)
3. **execute** — run operation (sign, verify, encrypt, decrypt, derive, hash)
4. **zeroize** — clear all sensitive data (Buffer.fill(0))
5. **destroy** — deallocate sandbox (auto-zeroizes if needed)

## Supported Operations

- `sign` — HMAC-SHA256 signature
- `verify` — HMAC-SHA256 verification
- `encrypt` — AES-256-GCM encryption
- `decrypt` — AES-256-GCM decryption
- `derive` — HKDF-SHA256 key derivation
- `hash` — SHA-256 hashing

## Defects

None.

## Unimplemented

None — all planned check-items from `test_plan.md` are implemented and passing.

## Enhancements (future roadmap)

- Track 32: BFT Shard Sync (can use sandboxes for shard consistency verification)
- Track 35: Confidential compute attestation chaining (chain sandbox attestations across nodes)
- Track 38: Sandbox snapshot/restore for crash recovery
