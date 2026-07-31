# Test Plan: Multi-Region Key Custody & HSM Handshake Vault

> Upgrade the server's master key architecture so per-organization sandbox encryption keys can be derived inside an external HSM or cloud KMS, rather than in application memory. This delegates the most sensitive cryptographic operations to a remote custody provider while preserving existing encrypt/decrypt interfaces.

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Multi-Region Key Custody & HSM Handshake Vault |
| Author (Builder) | Devin |
| Date | 2026-08-01 |
| Branch | feat/agentic-orchestration |
| Packages touched | ai-platform |

## Scope

### Files in scope

| File | Purpose |
|------|---------|
| `ai-platform/server/lib/hsm-vault.cjs` | HSM client abstraction: handshake, key derivation, decrypt helpers. Supports `mockhsm`, `cloudkms`, `azurekms` providers. |
| `ai-platform/server/lib/__tests__/hsm-vault.test.cjs` | Jest tests for handshake, derive, decrypt, provider fallback, and error handling. |
| `ai-platform/server/routes/hsm-vault-routes.cjs` | REST endpoints for vault status, handshake, and HSM-backed decrypt. |
| `ai-platform/server/index.cjs` | Mount `/api/vault` router. |
| `ai-platform/server/lib/crypto-utils.cjs` | Use `hsm-vault.cjs` for `deriveOrgKey` when `HSM_PROVIDER` is configured; otherwise fall back to local ENCRYPTION_KEY. |

### Configuration (env-driven)

| Variable | Purpose |
|----------|---------|
| `HSM_PROVIDER` | `mockhsm` (default/off), `cloudkms`, `azurekms` |
| `HSM_ENDPOINT` | Optional provider endpoint/region URI |
| `HSM_KEY_ID` | Master key identifier in the HSM |
| `HSM_REGION` | Multi-region failover selector |

### Cryptographic handshake model

1. `hsmHandshake(provider, keyId, region)` performs an idempotent handshake with the HSM provider and returns a `keyHandle` and `fingerprint` (SHA-256 of the handle + region).
2. `deriveOrgKeyViaHsm(orgId)` asks the HSM to compute `HMAC-SHA256(masterKey, "sb:org:${orgId}")` and returns the 32-byte buffer.
3. `decryptWithHsm(orgId, stored)` is a convenience that derives the org key via the HSM, then runs the existing AES-256-GCM decrypt.
4. `crypto-utils.cjs` `deriveOrgKey` transparently uses `hsm-vault.cjs` when `HSM_PROVIDER` is set, otherwise uses local key as today.
5. Existing ciphertext (encrypted with the local master key) remains decryptable via the local fallback.

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on new `.cjs` files | `node -c ai-platform/server/lib/hsm-vault.cjs`, `node -c ai-platform/server/routes/hsm-vault-routes.cjs`, `node -c ai-platform/server/index.cjs`, `node -c ai-platform/server/lib/crypto-utils.cjs` | [ ] |
| L1-02 | ai-platform tests | `cd ai-platform && npm test` | [ ] |
| L1-03 | SimpleBeacon full gate | `npx simplebeacon scan --full --gate --format json` | [ ] |
| L1-04 | npm audit (no package changes expected) | `npm audit` in touched package roots | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | MockHSM handshake | Call `hsmVault.hsmHandshake('mockhsm', 'mk-1', 'us-east')` | Returns a stable handle and fingerprint | [ ] |
| L2-02 | Derive org key via HSM | `hsmVault.deriveOrgKeyViaHsm('org-a')` with `HSM_PROVIDER=mockhsm` | Returns a 32-byte buffer equal to local `deriveOrgKey` if master key is the same | [ ] |
| L2-03 | Encrypt/decrypt round-trip with HSM | `encryptForOrg(plaintext, 'org-a')` then `decryptForOrg` with `HSM_PROVIDER=mockhsm` | Returns original plaintext | [ ] |
| L2-04 | Decrypt legacy local ciphertext with HSM off | `decryptForOrg(localCipher, 'org-a')` with `HSM_PROVIDER` unset | Returns original plaintext | [ ] |
| L2-05 | Vault status endpoint | `GET /api/vault/status?orgId=...` | Returns provider, keyId, region, handshake status | [ ] |
| L2-06 | HSM decrypt endpoint | `POST /api/vault/decrypt` body `{ orgId, ciphertext }` | Returns plaintext when HSM provider is `mockhsm` | [ ] |

---

## Level 3 — Edge cases & security

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Unknown HSM provider | `deriveOrgKeyViaHsm` throws `Unsupported HSM provider` | [ ] |
| L3-02 | HSM handshake failure | Returns error without exposing master key material | [ ] |
| L3-03 | Different orgId produces different key | `deriveOrgKeyViaHsm('org-a')` !== `deriveOrgKeyViaHsm('org-b')` | [ ] |
| L3-04 | Ciphertext tampering | `decryptWithHsm` returns empty string for bad tag | [ ] |
| L3-05 | HSM provider disabled (empty/undefined) | `crypto-utils.cjs` uses local key, no HSM calls | [ ] |
| L3-06 | No key ID configured | `hsmHandshake` falls back to a default `sb-master-key` identifier | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | Master key never leaves the HSM; only derived per-org keys are materialized in app memory | [ ] |
| S-02 | HSM routes require `admin:all` permission | [ ] |
| S-03 | Handshake response does not contain the master key | [ ] |
| S-04 | Provider credentials/endpoints are read from env, never hardcoded | [ ] |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________
