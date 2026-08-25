# test_plan.md — Track 12: Integrated Key Derivation & Hardware Attestation Mocking

> Skeleton for the Validator to review before Builder writes feature code.

## Metadata

| Field            | Value                                                              |
| ---------------- | ------------------------------------------------------------------ |
| Feature / change | Track 12: Integrated Key Derivation & Hardware Attestation Mocking |
| Author (Builder) | Devin                                                              |
| Date             | 2026-08-01                                                         |
| Branch           | `feature/track12-groundwork`                                       |
| Packages touched | ai-platform                                                        |

## Scope

### Files in scope

- `ai-platform/server/lib/hsm-adapter/asymmetric-adapter.cjs` (HKDF context injection)
- `ai-platform/server/lib/hsm-adapter/attestation.cjs` (new — mock HSM attestation utility)
- `ai-platform/server/lib/__tests__/attestation.test.cjs` (new)
- `ai-platform/server/lib/__tests__/asymmetric-adapter.test.cjs` (HKDF context tests)
- `ai-platform/docs/specs/track12-attestation-spec.md` (new)

### APIs / interfaces

- `AsymmetricHsmAdapter.wrap(kekId, plaintext, context)`
- `AsymmetricHsmAdapter.unwrap(kekId, wrapped, context)`
- `AsymmetricHsmAdapter.verifyAttestation(kekId, certificate)`
- `Attestation.signPublicKey(publicKeyDer, hardwareId, options)`
- `Attestation.verifyCertificate(certificate, rootPublicKey)`

### UI / IDE surfaces

- [ ] Main dashboard iframe / address bar
- [ ] Sidebar webview
- [ ] Welcome / main window panel
- [ ] Simple Browser / external browser

---

## Design decisions

- **Mock root key pair:** A deterministic `crypto.generateKeyPair('rsa')` or random-on-boot root key pair that acts as the simulated hardware trust anchor. In production this would be fused/TPM-backed; here it is a software mock.
- **X.509 certificate fields:** Each attestation certificate will include:
  - `subject` with a `CN=hardwareId` field
  - `subjectPublicKeyInfo` set to the wrapped `AsymmetricHsmAdapter` public key
  - `issuer` signed by the mock root private key
  - `notBefore` / `notAfter` validity window (default 30 days)
  - Custom extension `1.3.6.1.4.1.99999.1` carrying the `algorithm` and `keySize`
- **HKDF context binding:** The ECIES `wrap`/`unwrap` flow will accept an optional `context` string that feeds into `crypto.hkdfSync` along with the IV. Identical context must be provided on unwrap or the key derivation fails.
- **Attestation flow:**
  1. `AsymmetricHsmAdapter.createKEK()` creates the key pair.
  2. `exportPublicKey(kekId)` returns the SPKI public key.
  3. `Attestation.signPublicKey(publicKey, hardwareId)` produces an X.509 certificate signed by the mock root.
  4. `AsymmetricHsmAdapter.verifyAttestation(kekId, certificate)` validates the certificate against the mock root and confirms the public key matches `kekId`.

---

## Level 1 — Deterministic (Validator MUST run all)

| ID    | Check                                            | Command / method                                                                      | Pass |
| ----- | ------------------------------------------------ | ------------------------------------------------------------------------------------- | ---- |
| L1-01 | Syntax on changed `.cjs` files                   | `node -c <file>`                                                                      | [ ]  |
| L1-02 | Attestation tests pass                           | `cd ai-platform && npx jest --config jest.config.cjs attestation`                     | [ ]  |
| L1-03 | Asymmetric adapter tests still pass with context | `cd ai-platform && npx jest --config jest.config.cjs asymmetric-adapter`              | [ ]  |
| L1-04 | Full `ai-platform` test suite passes             | `cd ai-platform && npm test`                                                          | [ ]  |
| L1-05 | SimpleBeacon full gate                           | `node packages/simplebeacon-cli/bin/simplebeacon.js scan --full --gate --format json` | [ ]  |
| L1-06 | No secrets in diff                               | `git diff --cached`                                                                   | [ ]  |

---

## Level 2 — Behavioral

| ID    | Scenario                                | Steps                                                                            | Expected                        | Pass |
| ----- | --------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------- | ---- |
| L2-01 | RSA-OAEP wrap/unwrap with context       | Create RSA key, wrap with context `'user-123:epoch-1'`, unwrap with same context | Round-trip succeeds             | [ ]  |
| L2-02 | ECDH wrap/unwrap with context           | Create ECDH key, wrap with context, unwrap with same context                     | Round-trip succeeds             | [ ]  |
| L2-03 | Context mismatch rejected               | Wrap with context A, unwrap with context B                                       | `UNWRAP_FAILED`                 | [ ]  |
| L2-04 | Mock attestation certificate generation | Call `Attestation.signPublicKey` with SPKI and `hardwareId`                      | Returns valid X.509 certificate | [ ]  |
| L2-05 | Attestation verification                | Call `verifyAttestation` with valid certificate                                  | Returns `true`                  | [ ]  |

---

## Level 3 — Edge cases & regression

| ID    | Case                                          | Expected                                                            | Pass |
| ----- | --------------------------------------------- | ------------------------------------------------------------------- | ---- |
| L3-01 | Certificate expired                           | `verifyAttestation` returns `false` or throws `ATTESTATION_INVALID` | [ ]  |
| L3-02 | Certificate signed by wrong root              | `verifyAttestation` returns `false`                                 | [ ]  |
| L3-03 | Certificate public key does not match `kekId` | `verifyAttestation` returns `false`                                 | [ ]  |
| L3-04 | Missing context on wrap                       | Falls back to default context (`'AsymmetricHsmAdapter:default'`)    | [ ]  |
| L3-05 | Empty context string                          | Treated as valid context                                            | [ ]  |
| L3-06 | Long context strings (>1024 chars)            | Accepted without error                                              | [ ]  |

---

## Security

| ID   | Requirement                                                | Pass |
| ---- | ---------------------------------------------------------- | ---- |
| S-01 | Mock root private key never leaves `Attestation` module    | [ ]  |
| S-02 | HKDF context is mixed into the derived AES key             | [ ]  |
| S-03 | X.509 certificate public key equals the adapter public key | [ ]  |
| S-04 | No raw private key material in attestation certificate     | [ ]  |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________ Date: __________
