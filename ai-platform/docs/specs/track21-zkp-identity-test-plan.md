# test_plan.md — Track 21: Ephemeral Hardware Tokens & Decentralized Zero-Knowledge Identity Proofs

> Skeleton for the Validator to review before Builder writes feature code.

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Track 21: Ephemeral Hardware Tokens & Decentralized Zero-Knowledge Identity Proofs |
| Author (Builder) | Devin |
| Date | 2026-08-01 |
| Branch | `feature/track21-groundwork` |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/lib/hsm-adapter/zk-identity-verifier.cjs` (new — Schnorr-style ZKP verifier)
- `ai-platform/server/lib/hsm-adapter/ephemeral-hardware-token-splitter.cjs` (new — time-bounded 128-bit token provider)
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs` (ZKP / token policy validation)
- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json` (ZKP / token schema)
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs` (optional `createZkpProof` / `verifyZkpProof` high-level hooks)
- `ai-platform/server/lib/hsm-adapter/__tests__/zkp-identity.test.cjs` (new)
- `ai-platform/server/lib/hsm-adapter/__tests__/ephemeral-token.test.cjs` (new)
- `ai-platform/docs/specs/track21-zkp-identity-test-plan.md` (this file)

### APIs / interfaces

- `ZkIdentityVerifier(prime, options)`
- `ZkIdentityVerifier.generateProverKeys()`
- `ZkIdentityVerifier.createProof(privateKey, challenge)`
- `ZkIdentityVerifier.verifyProof(publicKey, proof, challenge)`
- `EphemeralHardwareTokenSplitter(attestationRoot, options)`
- `EphemeralHardwareTokenSplitter.issue(tenantId)`
- `EphemeralHardwareTokenSplitter.verify(token, tenantId)`
- `CryptoPolicyEngine.validate(tenantId, 'zkp', { tokenExpiryMs, maxProofs })`
- `HsmAdapterError` codes: `ZKP_VERIFICATION_FAILED`, `IDENTITY_PROOF_EXPIRED`, `TOKEN_NOT_BOUND`, `PROOF_LIMIT_EXCEEDED`

---

## Design decisions

- **Schnorr-style ZKP over a 256-bit prime field:**
  - A generator `g` and public prime `p` are fixed for each `ZkIdentityVerifier` instance.
  - Prover secret: `x`, public key: `y = g^x mod p`.
  - Commitment: `r = random` in `[1, p-1]`; `t = g^r mod p`.
  - Challenge `c` is a 256-bit hash of `(publicKey, t, context)`.
  - Response: `s = (r + c * x) mod (p-1)`.
  - Verification: `g^s mod p == t * y^c mod p`.
  - All arithmetic uses native `BigInt`.
  - The `challenge` parameter lets the verifier supply an external nonce or a timestamp.
- **Ephemeral hardware tokens:**
  - Token = `HMAC-SHA256(attestationRoot, tenantId || timestamp || counter)` truncated to 16 bytes.
  - `tokenExpiryMs` and `maxProofs` are enforced by `CryptoPolicyEngine`.
  - Tokens are tied to Track 12 attestation roots: `attestationRoot` is the `sha256` hash of the last approved `AttestationReport`.
  - `verify(token, tenantId)` recomputes the expected token within the active time window.
- **Policy enforcement:**
  - `CryptoPolicyEngine` gains `zkp: { tokenExpiryMs: 300000, maxProofs: 100, allowedPrimes: [list] }`.
  - `validate(tenantId, 'zkp', config)` checks token lifetime and proof limits.
- **Audit events:** `IDENTITY_PROOF_GENERATED` and `ZERO_KNOWLEDGE_VERIFIED` are emitted through `BaseHsmAdapter._audit`.

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on changed `.cjs` files | `node -c <file>` | [ ] |
| L1-02 | ZKP identity tests pass | `cd ai-platform && npx jest --config jest.config.cjs zkp-identity` | [ ] |
| L1-03 | Ephemeral token tests pass | `cd ai-platform && npx jest --config jest.config.cjs ephemeral-token` | [ ] |
| L1-04 | Crypto policy tests still pass | `cd ai-platform && npx jest --config jest.config.cjs crypto-policy-engine` | [ ] |
| L1-05 | Full `ai-platform` test suite passes | `cd ai-platform && npm test` | [ ] |
| L1-06 | SimpleBeacon full gate | `npx simplebeacon scan --full --gate --format json` | [ ] |
| L1-07 | No secrets in diff | `git diff --cached` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Generate and verify a valid ZKP | `createProof` then `verifyProof` with same challenge | Returns `true` | [ ] |
| L2-02 | Verifying with a different challenge fails | `verifyProof` with altered `c` | Returns `false` | [ ] |
| L2-03 | Issue and verify an ephemeral hardware token | `issue(tenantId)` then `verify(token, tenantId)` within window | Returns `true` | [ ] |
| L2-04 | Expired token is rejected | Wait `tokenExpiryMs + 1` and `verify` | Throws `IDENTITY_PROOF_EXPIRED` | [ ] |
| L2-05 | Token bound to wrong tenant is rejected | `verify(token, 't2')` for `t1` token | Throws `TOKEN_NOT_BOUND` | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Exceeding `maxProofs` rate limit fails | `createProof` called > `maxProofs` in window | Throws `PROOF_LIMIT_EXCEEDED` | [ ] |
| L3-02 | `g` and `p` values are well-known safe primes | `allowedPrimes` policy enforced | [ ] |
| L3-03 | Existing Tracks 10–20 tests still pass | No regressions | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | Private key `x` is never transmitted or logged | [ ] |
| S-02 | Tokens expire and are not reversible to attestation root without the root | [ ] |
| S-03 | `challenge` replay across different contexts is prevented by context-bound hash | [ ] |
| S-04 | `maxProofs` prevents proof-flooding attacks | [ ] |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________
