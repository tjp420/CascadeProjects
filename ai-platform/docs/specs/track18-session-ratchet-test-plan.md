# test_plan.md — Track 18: Perfect Forward Secrecy & Ratcheting Session-Key Exchange

> Skeleton for the Validator to review before Builder writes feature code.

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Track 18: Perfect Forward Secrecy & Ratcheting Session-Key Exchange |
| Author (Builder) | Devin |
| Date | 2026-08-01 |
| Branch | `feature/track18-groundwork` |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/lib/hsm-adapter/cryptographic-ratchet.cjs` (new — dual-ratchet key derivation engine)
- `ai-platform/server/lib/hsm-adapter/ratchet-message-handler.cjs` (new — out-of-order message / skipped-key queue)
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs` (ratchet policy validation)
- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json` (ratchet policy schema)
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs` (optional `initiateRatchet` / `ratchetStep` high-level hooks)
- `ai-platform/server/lib/hsm-adapter/__tests__/cryptographic-ratchet.test.cjs` (new)
- `ai-platform/server/lib/hsm-adapter/__tests__/ratchet-message-handler.test.cjs` (new)
- `ai-platform/docs/specs/track18-session-ratchet-test-plan.md` (this file)

### APIs / interfaces

- `CryptographicRatchet(initialRootKey, options)`
- `CryptographicRatchet.step(sendOrReceive, ephemeralPublicKey?)`
- `CryptographicRatchet.encrypt(plaintext, ad)`
- `CryptographicRatchet.decrypt(ciphertext, ad)`
- `CryptographicRatchet.getCurrentChainKey()`
- `RatchetMessageHandler(maxSkipped, maxCacheMs)`
- `RatchetMessageHandler.queue(message, sequence)`
- `RatchetMessageHandler.process(handler)`
- `CryptoPolicyEngine.validate(tenantId, 'ratchet', { maxSkipped, sessionExpiryMs })`
- `HsmAdapterError` codes: `RATCHET_DESYNCHRONIZED`, `SESSION_EXPIRED`, `MAX_SKIPPED_EXCEEDED`

---

## Design decisions

- **Dual-ratchet model:**
  - **Root chain:** A shared root key (established via `AsymmetricHsmAdapter` ECDH) is fed through HKDF to produce new root keys and chain keys for each round trip.
  - **Symmetric ratchet:** Each message increments the current chain key via HKDF to produce a message key and the next chain key.
  - **DH ratchet:** Periodic ephemeral ECDH exchanges rotate the root key, providing break-in recovery.
- **HKDF parameters:** SHA-256, context string `SimpleBeacon:Track18:Ratchet:v1`, salt = current root key.
- **Encryption at rest / in transit:** Message keys are used with AES-256-GCM. The 12-byte IV is deterministic per chain: `IV = chainCounter` (padded to 12 bytes) or random with explicit counter in AAD.
- **Out-of-order handling:**
  - Each message carries a counter and a previous-chain length.
  - A skipped message causes the handler to derive and cache up to `maxSkipped` message keys without advancing the main chain.
  - If a message arrives with a gap larger than `maxSkipped`, the handler throws `MAX_SKIPPED_EXCEEDED`.
  - Cache entries expire after `maxCacheMs` to avoid unbounded memory growth.
- **Session expiration:** A `sessionExpiryMs` policy field sets the maximum age of a ratchet root. After expiry, `RATCHET_DESYNCHRONIZED` or `SESSION_EXPIRED` is thrown.
- **Policy enforcement:** `CryptoPolicyEngine` gains `ratchet: { maxSkipped, sessionExpiryMs, allowDhRatchet }` with defaults `maxSkipped: 1000`, `sessionExpiryMs: 86400000`, `allowDhRatchet: true`.
- **Audit events:** `RATCHET_STEPPED` (with chain index and DH flag) and `SESSION_EXPIRED` (with session age) are emitted through `BaseHsmAdapter._audit`.
- **State packet format (canonical):**
  ```json
  {
    "version": "1.0.0",
    "tenantId": "...",
    "sessionId": "...",
    "chainIndex": 0,
    "messageIndex": 0,
    "dhPublicKey": "base64...",
    "rootKeyHash": "sha256...",
    "createdAt": "ISO-8601"
  }
  ```

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on changed `.cjs` files | `node -c <file>` | [ ] |
| L1-02 | Cryptographic ratchet tests pass | `cd ai-platform && npx jest --config jest.config.cjs cryptographic-ratchet` | [ ] |
| L1-03 | Ratchet message handler tests pass | `cd ai-platform && npx jest --config jest.config.cjs ratchet-message-handler` | [ ] |
| L1-04 | Crypto policy tests still pass with ratchet schema | `cd ai-platform && npx jest --config jest.config.cjs crypto-policy-engine` | [ ] |
| L1-05 | Full `ai-platform` test suite passes | `cd ai-platform && npm test` | [ ] |
| L1-06 | SimpleBeacon full gate | `npx simplebeacon scan --full --gate --format json` | [ ] |
| L1-07 | No secrets in diff | `git diff --cached` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Two nodes establish a shared ratchet root | `AsymmetricHsmAdapter` ECDH exchange, then `CryptographicRatchet(rootKey)` | Both produce identical initial chain keys | [ ] |
| L2-02 | Symmetric ratchet produces independent message keys | `encrypt` 3 messages; compare message keys | Each message key is unique and unpredictable | [ ] |
| L2-03 | DH ratchet rotates root and breaks forward chain | Call `step('send', newEphemeralPublicKey)` and encrypt | Previous chain keys cannot decrypt new message | [ ] |
| L2-04 | Out-of-order message decrypts with cached skipped key | Send messages 1, 3, 2; decrypt 2 then 3 | Message 2 decrypts; message 3 still decrypts | [ ] |
| L2-05 | Excessive skipped messages rejected | Skip 1001 messages with `maxSkipped: 1000` | Throws `MAX_SKIPPED_EXCEEDED` | [ ] |
| L2-06 | Session expiry triggers audit event | Hold root for > `sessionExpiryMs`, then `step` | Throws `SESSION_EXPIRED`; `SESSION_EXPIRED` audit logged | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Tampered AAD causes decryption failure | Throws `UNWRAP_FAILED` | [ ] |
| L3-02 | Reusing same chain counter IV fails for identical plaintext | Two messages at same index produce different ciphertexts | [ ] |
| L3-03 | Existing Tracks 10–17 tests still pass | No regressions | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | Compromised old chain key cannot decrypt future messages after DH ratchet | [ ] |
| S-02 | Skipped-key cache never stores plaintext or current root key | [ ] |
| S-03 | `maxSkipped` and `sessionExpiryMs` are enforced by policy | [ ] |
| S-04 | All state packets carry a `rootKeyHash` for integrity cross-check | [ ] |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________
