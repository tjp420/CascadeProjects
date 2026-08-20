# test_plan.md — Track 16: Cryptographic Key Provenance & Decentralized Attestation Anchoring

> Skeleton for the Validator to review before Builder writes feature code.

## Metadata

| Field            | Value                                                                        |
| ---------------- | ---------------------------------------------------------------------------- |
| Feature / change | Track 16: Cryptographic Key Provenance & Decentralized Attestation Anchoring |
| Author (Builder) | Devin                                                                        |
| Date             | 2026-08-01                                                                   |
| Branch           | `feature/track16-groundwork`                                                 |
| Packages touched | ai-platform                                                                  |

## Scope

### Files in scope

- `ai-platform/server/lib/hsm-adapter/provenance-tracker.cjs` (new — genesis record generator and ledger)
- `ai-platform/server/lib/hsm-adapter/provenance-proof.cjs` (new — exportable proof structure)
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs` (provenance validation checkpoints)
- `ai-platform/server/lib/hsm-adapter/software-adapter.cjs` (emit provenance records on `createKEK`)
- `ai-platform/server/lib/hsm-adapter/asymmetric-adapter.cjs` (emit provenance records on `createKEK`)
- `ai-platform/server/lib/hsm-adapter/__tests__/provenance-tracker.test.cjs` (new)
- `ai-platform/server/lib/hsm-adapter/__tests__/provenance-proof.test.cjs` (new)
- `ai-platform/docs/specs/track16-provenance-ledger-test-plan.md` (this file)

### APIs / interfaces

- `ProvenanceTracker(rootKeyPair, options)`
- `ProvenanceTracker.register(tenantId, kekId, metadata)`
- `ProvenanceTracker.getRecord(kekId)`
- `ProvenanceTracker.verify(record)`
- `ProvenanceProof.create(record, publicKey)`
- `ProvenanceProof.verify(proof, rootPublicKey)`
- `BaseHsmAdapter.createKEK` now anchors provenance automatically
- `HsmAdapterError` code `KEY_PROVENANCE_CORRUPTED`

### UI / IDE surfaces

- [ ] Main dashboard iframe / address bar
- [ ] Sidebar webview
- [ ] Welcome / main window panel
- [ ] Simple Browser / external browser

---

## Design decisions

- **Provenance record fields:**
  - `kekId` — the unique key identifier
  - `tenantId` — owner
  - `algorithm` — e.g. `aes-kw`, `rsa-oaep`, `ecdh`
  - `keySize` or `kekBits`
  - `createdAt` — ISO-8601 timestamp
  - `buildHash` — commit hash or `package.json` version/build identifier
  - `hardwareRootToken` — a deterministic token derived from the signing root key pair (or a hardware-attested public key)
  - `signature` — RSASSA-PSS or ECDSA signature over the canonical JSON of the above fields
  - `previousHash` — optional hash of the previous record to form a chain
- **Signing:** The `ProvenanceTracker` accepts a root key pair. By default it uses ECDSA P-256 for compact signatures, but it can be configured to use `rsa-oaep` or `ecdh` through the `AsymmetricHsmAdapter` if desired. The initial implementation keeps the tracker self-contained using Node.js `crypto` primitives.
- **Decentralized proofs:** A `ProvenanceProof` is a subset of a record plus a detached signature and the public key needed to verify it. A third-party node can verify the proof without network access by checking the signature against the root public key.
- **Tamper-evident checkpoints:** `BaseHsmAdapter` and concrete adapters validate provenance on `wrap`, `unwrap`, `rotateKEK`, and `zeroize`. If `getRecord(kekId)` returns a record that does not match the in-memory key metadata (algorithm, keySize, tenantId), the adapter throws `KEY_PROVENANCE_CORRUPTED`.
- **Build hash:** Provided by the caller via `options.buildHash` or read from `process.env.SB_BUILD_HASH` at tracker construction. Falls back to `unknown-build`.
- **Hardware root token:** A stable 16-byte random value or HSM-derived token injected at tracker construction. It is not a secret; it is a public anchor used to link records to a specific root.

---

## Level 1 — Deterministic (Validator MUST run all)

| ID    | Check                                              | Command / method                                                                                                                                                      | Pass |
| ----- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| L1-01 | Syntax on changed `.cjs` files                     | `node -c <file>`                                                                                                                                                      | [ ]  |
| L1-02 | Provenance tracker tests pass                      | `cd ai-platform && npx jest --config jest.config.cjs provenance-tracker`                                                                                              | [ ]  |
| L1-03 | Provenance proof tests pass                        | `cd ai-platform && npx jest --config jest.config.cjs provenance-proof`                                                                                                | [ ]  |
| L1-04 | HSM/adapter tests still pass with provenance hooks | `cd ai-platform && npx jest --config jest.config.cjs hsm-adapter asymmetric-adapter multi-tenant-key-isolation crypto-policy-engine secure-zeroize volatile-eviction` | [ ]  |
| L1-05 | Full `ai-platform` test suite passes               | `cd ai-platform && npm test`                                                                                                                                          | [ ]  |
| L1-06 | SimpleBeacon full gate                             | `npx simplebeacon scan --full --gate --format json`                                                                                                                   | [ ]  |
| L1-07 | No secrets in diff                                 | `git diff --cached`                                                                                                                                                   | [ ]  |

---

## Level 2 — Behavioral

| ID    | Scenario                                          | Steps                                                                                                 | Expected                                                  | Pass |
| ----- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---- |
| L2-01 | Register a KEK and retrieve its provenance record | `createKEK`, then `provenanceTracker.getRecord(kekId)`                                                | Record contains all required fields and a valid signature | [ ]  |
| L2-02 | Verify a provenance record                        | Call `ProvenanceTracker.verify(record)`                                                               | Returns `true` for valid record                           | [ ]  |
| L2-03 | Generate and verify a decentralized proof         | `ProvenanceProof.create(record, publicKey)` then `verify(proof, rootPublicKey)` on a different object | Returns `true`                                            | [ ]  |
| L2-04 | Tampered record fails verification                | Mutate a field, call `verify(record)`                                                                 | Throws `KEY_PROVENANCE_CORRUPTED`                         | [ ]  |
| L2-05 | Checkpoint on wrap                                | Call `wrap` with a record whose `algorithm` differs from the in-memory key                            | Throws `KEY_PROVENANCE_CORRUPTED`                         | [ ]  |
| L2-06 | Build hash is anchored                            | Create record, read `buildHash`                                                                       | Matches `options.buildHash` or fallback                   | [ ]  |

---

## Level 3 — Edge cases & regression

| ID    | Case                                         | Expected                                                                   | Pass |
| ----- | -------------------------------------------- | -------------------------------------------------------------------------- | ---- |
| L3-01 | Unknown `kekId` returns `null`               | `getRecord('missing')` returns `null`                                      | [ ]  |
| L3-02 | Duplicate registration idempotent            | Re-registering the same `kekId` with the same data returns the same record | [ ]  |
| L3-03 | `hardwareRootToken` mismatch on verification | Throws `KEY_PROVENANCE_CORRUPTED`                                          | [ ]  |
| L3-04 | `tenantId` mismatch in checkpoint            | Throws `KEY_PROVENANCE_CORRUPTED`                                          | [ ]  |
| L3-05 | Existing Tracks 10–15 tests still pass       | No regressions                                                             | [ ]  |

---

## Security

| ID   | Requirement                                                    | Pass |
| ---- | -------------------------------------------------------------- | ---- |
| S-01 | Provenance records do not contain raw key material             | [ ]  |
| S-02 | Private signing key never leaves `ProvenanceTracker`           | [ ]  |
| S-03 | `KEY_PROVENANCE_CORRUPTED` is thrown for any metadata mismatch | [ ]  |
| S-04 | Proof verification does not require the original database      | [ ]  |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________ Date: __________
