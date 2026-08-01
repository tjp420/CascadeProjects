# test_plan.md — Track 11: Asymmetric Wrapping Pairs

> Skeleton for the Validator to review before Builder writes feature code.

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Track 11: Asymmetric Wrapping Pairs for HSM Adapter |
| Author (Builder) | Devin |
| Date | 2026-08-01 |
| Branch | `feature/track11-asymmetric-wrapping` |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/lib/hsm-adapter/asymmetric-adapter.cjs` (new — `AsymmetricHsmAdapter`)
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs` (extend contract if needed)
- `ai-platform/server/lib/__tests__/asymmetric-adapter.test.cjs` (new)
- `ai-platform/docs/specs/track11-asymmetric-wrapping-spec.md` (new)

### APIs / routes

- `AsymmetricHsmAdapter.generateKeyPair(algorithm)`
- `AsymmetricHsmAdapter.wrap(kekId, plaintext)`
- `AsymmetricHsmAdapter.unwrap(kekId, wrapped)`
- `AsymmetricHsmAdapter.exportPublicKey(kekId)`
- `AsymmetricHsmAdapter.rotateKeyring(envelope, oldKek, newKek)`

### UI / IDE surfaces

- [ ] Main dashboard iframe / address bar
- [ ] Sidebar webview
- [ ] Welcome / main window panel
- [ ] Simple Browser / external browser

---

## Design decisions

- **RSA-OAEP** support: 2048-bit and 4096-bit key pairs with `SHA-256` hashing.
- **ECDH** support: `P-256` and `P-384` curves for key wrapping using `ECIES`-style ephemeral-static agreement.
- **Private key export format:** PKCS#8 DER.
- **Public key export format:** SubjectPublicKeyInfo (SPKI) DER.
- **No raw private key exposure:** private keys are stored only inside the adapter; callers receive handles (`kekId`) and public material only.

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on changed `.cjs` files | `node -c <file>` | [ ] |
| L1-02 | Asymmetric adapter tests pass | `cd ai-platform && npx jest --config jest.config.cjs asymmetric-adapter` | [ ] |
| L1-03 | Existing HSM/serializer tests still pass | `cd ai-platform && npx jest --config jest.config.cjs hsm-adapter && npx jest --config jest.config.cjs keyring-serializer` | [ ] |
| L1-04 | SimpleBeacon full gate | `node packages/simplebeacon-cli/bin/simplebeacon.js scan --full --gate --format json` | [ ] |
| L1-05 | No secrets in diff | `git diff --cached` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | RSA-OAEP wrap/unwrap round-trip | Generate 2048-bit RSA key pair, wrap a 256-bit AES key, unwrap with the private key | Recovered key matches the input | [ ] |
| L2-02 | ECDH P-256 wrap/unwrap round-trip | Generate P-256 key pair, perform ECDH wrap of a small secret, unwrap with the private key | Recovered secret matches the input | [ ] |
| L2-03 | Export public key only | Call `exportPublicKey(kekId)` | Returns valid SPKI buffer; private key is not present | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Wrap with wrong algorithm label | `HsmAdapterError` with `UNSUPPORTED_ALGORITHM` | [ ] |
| L3-02 | Attempt to extract private key via public export | Returns `undefined` or throws `UNAUTHORIZED_KEY_ACCESS` | [ ] |
| L3-03 | Corrupted wrapped payload | Unwrap fails with `ENVELOPE_INTEGRITY` | [ ] |
| L3-04 | Unsupported curve or key size | Constructor or `generateKeyPair` rejects with `INVALID_KEK_BITS` or `UNSUPPORTED_ALGORITHM` | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No raw private key material logged or returned | [ ] |
| S-02 | Public export cannot be used to unwrap | [ ] |
| S-03 | Key handles (`kekId`) are non-deterministic and non-guessable | [ ] |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________
