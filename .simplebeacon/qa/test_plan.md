# test_plan.md

> Copy to `.simplebeacon/qa/test_plan.md` and fill before Builder writes feature code.
> User approval required unless the task explicitly includes an approved plan.

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | ZKP-Identity Test Suite Expansion + Timing-Attack Fix |
| Author (Builder) | Devin |
| Date | 2026-08-07 |
| Branch | feature/zkp-identity-tests |
| Packages touched | ai-platform (server/lib/hsm-adapter) |

## Scope

### Goal

Expand the ZKP identity verification test suite to cover boundary conditions,
malformed cryptographic proof inputs, and timing-attack protections. Fix the
existing timing-attack vulnerability in the proof verification code.

### Architecture

1. **Fix timing-attack vulnerability** — replace `lhs === rhs` BigInt comparison
   and `Buffer.equals()` with constant-time comparison functions
2. **Expand test suite** — add tests for malformed inputs, boundary conditions,
   replay attacks, and timing-attack resistance

### Files in scope

- `ai-platform/server/lib/hsm-adapter/zk-identity-verifier.cjs` — fix constant-time comparison
- `ai-platform/server/lib/hsm-adapter/ephemeral-hardware-token-splitter.cjs` — fix constant-time comparison
- `ai-platform/server/lib/hsm-adapter/__tests__/zkp-identity.test.cjs` — expand test suite

### APIs / routes

- N/A — internal library modules only

### UI / IDE surfaces

- N/A

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on zk-identity-verifier.cjs | `node -c ai-platform/server/lib/hsm-adapter/zk-identity-verifier.cjs` | [ ] |
| L1-02 | Syntax on ephemeral-hardware-token-splitter.cjs | `node -c ai-platform/server/lib/hsm-adapter/ephemeral-hardware-token-splitter.cjs` | [ ] |
| L1-03 | Syntax on zkp-identity.test.cjs | `node -c ai-platform/server/lib/hsm-adapter/__tests__/zkp-identity.test.cjs` | [ ] |
| L1-04 | All existing tests still pass | `cd ai-platform && npx jest --config jest.config.cjs zkp-identity` | [ ] |
| L1-05 | All new tests pass | `cd ai-platform && npx jest --config jest.config.cjs zkp-identity` | [ ] |
| L1-06 | SimpleBeacon gate (staged files) | Pre-commit hook | [ ] |
| L1-07 | No secrets in diff | Manual / gate token rules | [ ] |

---

## Level 2 — Behavioral

### Timing-Attack Fix Tests

| ID | Scenario | Expected | Pass |
|----|----------|----------|------|
| L2-01 | verifyProof uses constant-time comparison | Verification time is data-independent | [ ] |
| L2-02 | token verify uses timingSafeEqual | Token comparison is constant-time | [ ] |
| L2-03 | Valid proof still verifies after fix | `verifyProof` returns true for valid proof | [ ] |
| L2-04 | Invalid proof still fails after fix | `verifyProof` returns false for tampered proof | [ ] |

### Malformed Input Tests

| ID | Scenario | Expected | Pass |
|----|----------|----------|------|
| L2-05 | Proof with wrong t buffer size | Returns false (not crash) | [ ] |
| L2-06 | Proof with wrong s buffer size | Returns false (not crash) | [ ] |
| L2-07 | Proof with null/undefined t | Returns false (not crash) | [ ] |
| L2-08 | Proof with null/undefined s | Returns false (not crash) | [ ] |
| L2-09 | Public key with wrong size | Returns false (not crash) | [ ] |
| L2-10 | Empty context string | Proof verifies (empty context is valid) | [ ] |
| L2-11 | Buffer context (not string) | Proof verifies with Buffer context | [ ] |

### Boundary Condition Tests

| ID | Scenario | Expected | Pass |
|----|----------|----------|------|
| L2-12 | Proof with s = 0 | Returns false (invalid response) | [ ] |
| L2-13 | Proof with t = 0 | Returns false (invalid commitment) | [ ] |
| L2-14 | External challenge parameter | Proof verifies with external challenge | [ ] |
| L2-15 | External challenge mismatch | Proof fails with wrong external challenge | [ ] |

### Replay Attack Tests

| ID | Scenario | Expected | Pass |
|----|----------|----------|------|
| L2-16 | Same proof replayed with different context | Fails (context-bound) | [ ] |
| L2-17 | Same proof with different public key | Fails (key-bound) | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | All existing tests still pass | No regressions | [ ] |
| L3-02 | Large field (256-bit default) proof | Verifies correctly | [ ] |
| L3-03 | Multiple proofs with same key | Each verifies independently | [ ] |
| L3-04 | Audit events still emitted after fix | IDENTITY_PROOF_GENERATED + ZERO_KNOWLEDGE_VERIFIED | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | Constant-time comparison for proof verification | [ ] |
| S-02 | Constant-time comparison for token verification | [ ] |
| S-03 | No private key material in error messages | [ ] |
| S-04 | No timing leak in malformed input handling | [ ] |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________
