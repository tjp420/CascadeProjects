# test_plan.md — Track 19: Homomorphic Payload Masking & Encrypted-State Querying

> Skeleton for the Validator to review before Builder writes feature code.

## Metadata

| Field            | Value                                                            |
| ---------------- | ---------------------------------------------------------------- |
| Feature / change | Track 19: Homomorphic Payload Masking & Encrypted-State Querying |
| Author (Builder) | Devin                                                            |
| Date             | 2026-08-01                                                       |
| Branch           | `feature/track19-groundwork`                                     |
| Packages touched | ai-platform                                                      |

## Scope

### Files in scope

- `ai-platform/server/lib/hsm-adapter/homomorphic-masker.cjs` (new — additive randomized blinding)
- `ai-platform/server/lib/hsm-adapter/encrypted-search-token.cjs` (new — deterministic search hashes with rolling salt)
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs` (homomorphic policy validation)
- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json` (homomorphic schema)
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs` (optional `blindQuery` / `tokenize` high-level hooks)
- `ai-platform/server/lib/hsm-adapter/__tests__/homomorphic-masking.test.cjs` (new)
- `ai-platform/server/lib/hsm-adapter/__tests__/encrypted-search-token.test.cjs` (new)
- `ai-platform/docs/specs/track19-homomorphic-masking-test-plan.md` (this file)

### APIs / interfaces

- `HomomorphicMasker(options)`
- `HomomorphicMasker.blind(plaintextBigInt)`
- `HomomorphicMasker.unmask(maskedValue, blindingFactor)`
- `HomomorphicMasker.add(maskedA, maskedB, blindA, blindB)`
- `EncryptedSearchToken(saltRoller, options)`
- `EncryptedSearchToken.generate(token, salt)`
- `EncryptedSearchToken.rotate()`
- `CryptoPolicyEngine.validate(tenantId, 'homomorphic', { maxModulusBits, tokenExpiryMs })`
- `HsmAdapterError` codes: `HOMOMORPHIC_OVERFLOW`, `TOKEN_EXPIRED`, `INVALID_BLIND`

---

## Design decisions

- **Additive masking model (simplified homomorphic blinding):**
  - Use a 2048-bit public modulus `n` (product of two safe primes in a production deployment; for this track, use a published or generated 2048-bit prime `p` as the field modulus for the reference implementation).
  - A plaintext integer `x` is masked as `c = (x + r) mod p` where `r` is a random blinding factor drawn uniformly from `[0, p)`.
  - `add(c1, c2)` returns `(c1 + c2) mod p` = `(x1 + x2 + r1 + r2) mod p`.
  - `unmask(c, r1 + r2)` returns `x1 + x2 mod p`.
  - All arithmetic uses native `BigInt` with explicit bounds checks.
- **BigInt boundaries:**
  - All inputs are reduced modulo `p` before masking.
  - Blinding factors are `< p`.
  - Any intermediate result `>= 2p` triggers `HOMOMORPHIC_OVERFLOW`.
  - `maxModulusBits` policy field caps the modulus at 2048 bits by default.
- **Encrypted search tokens:**
  - `EncryptedSearchToken` maintains a rolling salt and counter.
  - `generate(queryString, salt)` returns `HMAC-SHA256(salt, canonical(queryString))` truncated to a stable token length (e.g., 32 bytes).
  - Token lifetime is governed by `tokenExpiryMs`; old salts are retained briefly for matching, then zeroized.
  - `rotate()` advances to a new salt; old tokens remain matchable during a configurable grace window.
- **Policy enforcement:**
  - `CryptoPolicyEngine` gains `homomorphic: { maxModulusBits: 2048, tokenExpiryMs: 300000, allowBlinding: true }`.
  - `validate(tenantId, 'homomorphic', config)` checks `maxModulusBits` and `tokenExpiryMs`.
- **Audit events:** `PAYLOAD_BLINDED` and `STATE_MATCHED` are emitted through `BaseHsmAdapter._audit`.

---

## Level 1 — Deterministic (Validator MUST run all)

| ID    | Check                                | Command / method                                                             | Pass |
| ----- | ------------------------------------ | ---------------------------------------------------------------------------- | ---- |
| L1-01 | Syntax on changed `.cjs` files       | `node -c <file>`                                                             | [ ]  |
| L1-02 | Homomorphic masker tests pass        | `cd ai-platform && npx jest --config jest.config.cjs homomorphic-masking`    | [ ]  |
| L1-03 | Encrypted search token tests pass    | `cd ai-platform && npx jest --config jest.config.cjs encrypted-search-token` | [ ]  |
| L1-04 | Crypto policy tests still pass       | `cd ai-platform && npx jest --config jest.config.cjs crypto-policy-engine`   | [ ]  |
| L1-05 | Full `ai-platform` test suite passes | `cd ai-platform && npm test`                                                 | [ ]  |
| L1-06 | SimpleBeacon full gate               | `npx simplebeacon scan --full --gate --format json`                          | [ ]  |
| L1-07 | No secrets in diff                   | `git diff --cached`                                                          | [ ]  |

---

## Level 2 — Behavioral

| ID    | Scenario                                                 | Steps                                                     | Expected                            | Pass |
| ----- | -------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------- | ---- |
| L2-01 | Blind and unmask an integer                              | `masker.blind(100n)` then `unmask(c, r)`                  | Returns `100n`                      | [ ]  |
| L2-02 | Add two masked integers without unwrapping               | `masker.add(c1, c2, r1, r2)`                              | Returns `(x1 + x2) mod p`           | [ ]  |
| L2-03 | Generate matching search tokens with same salt and query | `token.generate('foo')` x2                                | Both return identical 32-byte token | [ ]  |
| L2-04 | Different salts produce different tokens                 | `token.generate('foo', saltA)` vs `saltB`                 | Tokens differ                       | [ ]  |
| L2-05 | Token rotation preserves matching during grace window    | `rotate()`, then match old token                          | Old token still valid               | [ ]  |
| L2-06 | Policy rejects excessive modulus bits                    | `validate('t1', 'homomorphic', { maxModulusBits: 4096 })` | Throws `POLICY_VIOLATION_BLOCKED`   | [ ]  |

---

## Level 3 — Edge cases & regression

| ID    | Case                                       | Expected                                                          | Pass |
| ----- | ------------------------------------------ | ----------------------------------------------------------------- | ---- |
| L3-01 | Unmasking with wrong blinding factor fails | Throws `INVALID_BLIND`                                            | [ ]  |
| L3-02 | Input `>= p` is reduced modulo `p`         | `blind(p + 5n)` is equivalent to `5n`                             | [ ]  |
| L3-03 | Expired tokens are rejected                | `rotate(); wait(tokenExpiryMs + 1); match` throws `TOKEN_EXPIRED` | [ ]  |
| L3-04 | Existing Tracks 10–18 tests still pass     | No regressions                                                    | [ ]  |

---

## Security

| ID   | Requirement                                                     | Pass |
| ---- | --------------------------------------------------------------- | ---- |
| S-01 | Blinding factors are uniformly random and never logged          | [ ]  |
| S-02 | Raw plaintext never appears in masked or tokenized output       | [ ]  |
| S-03 | `HOMOMORPHIC_OVERFLOW` is thrown before any result exceeds `2p` | [ ]  |
| S-04 | Expired search salts are zeroized                               | [ ]  |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________ Date: __________
