# Test Plan: Multi-Tenant Cryptographic Sandbox Isolation Core — Phase 1

> Per-org key derivation and field-level encryption for file-based multi-tenant stores.

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Multi-Tenant Cryptographic Sandbox Isolation Core — per-organization key derivation and field-level encryption for SSO configs |
| Author (Builder) | Devin |
| Date | 2026-07-31 |
| Branch | main |
| Packages touched | ai-platform |

## Context

The platform currently protects secrets in `sso-config-store.cjs` with a single shared AES-256-GCM key. If that one master key leaks, every organization's SSO client secret stored in `sso-configs.json` is exposed. This phase introduces per-organization key derivation so each `orgId` gets a cryptographically isolated AES key. Field-level encryption and decryption happen automatically on every file read and write, with a deterministic derivation and a fallback for legacy encrypted values.

## Design

### Core mechanics

1. **Per-org key derivation** in `ai-platform/server/lib/crypto-utils.cjs`:
   - `deriveOrgKey(orgId)` returns an AES-256 key derived from the active master secret plus the `orgId` salt.
   - Same `orgId` and master secret always produce the same key.
   - Different `orgId` values produce computationally independent keys.
   - Derivation uses a standard KDF (HKDF-SHA256 or PBKDF2) from Node's built-in `crypto`.

2. **Per-org encrypt/decrypt helpers** in `crypto-utils.cjs`:
   - `encryptForOrg(plaintext, orgId)` produces the new `enc:sb:iv:tag:ciphertext` format using the per-org key.
   - `decryptForOrg(ciphertext, orgId)` attempts per-org decryption only for values starting with the `enc:sb:` sandbox prefix.
   - Existing `encrypt(plaintext)` / `decrypt(ciphertext)` remain unchanged for callers that do not pass an `orgId`.
   - The dedicated `enc:sb:` sandbox prefix enables transparent prefix-based routing and zero-downtime coexistence with legacy `enc:` and base64-encrypted values.

3. **Field-level encryption on writes** in `ai-platform/server/lib/sso-config-store.cjs`:
   - `createConfig` and `updateConfig` encrypt `oidc.clientSecret` with `encryptForOrg(clientSecret, orgId)`.
   - `getConfigDecrypted` decrypts with `decryptForOrg(clientSecret, orgId)`.
   - `getAllConfigs` / `getConfigsByOrg` mask the decrypted value through `crypto-utils.maskSecret`.

4. **Fallback handling**:
   - If `decryptForOrg` returns an empty string, try the legacy `decryptSecret` (single-key base64) before giving up.
   - This keeps existing SSO configs readable while new writes migrate to per-org encryption.

### Files in scope

| File | Purpose |
|------|---------|
| `ai-platform/server/lib/crypto-utils.cjs` | Add `deriveOrgKey`, `encryptForOrg`, `decryptForOrg`; keep existing single-key API backward-compatible |
| `ai-platform/server/lib/sso-config-store.cjs` | Use per-org encryption for `oidc.clientSecret`; add legacy fallback; keep masking and cache behavior |

### Files explicitly NOT in scope (deferred)

- Other `*-store.cjs` files (`pii-policy-store.cjs`, `webhook-config-store.cjs`, `alert-rule-store.cjs`, etc.)
- Key rotation and retired-per-org-key support
- Dashboard UI changes

### APIs / routes

- Internal store methods only (`createConfig`, `updateConfig`, `getConfigDecrypted`, `getConfigsByOrg`, `getAllConfigs`)
- No new HTTP routes in this phase

### UI / IDE surfaces

- [ ] Sidebar webview
- [ ] Main dashboard iframe / address bar
- [ ] Welcome / main window panel
- [ ] Simple Browser / external browser

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on changed JS/CJS | `node -c ai-platform/server/lib/crypto-utils.cjs` and `node -c ai-platform/server/lib/sso-config-store.cjs` | [ ] |
| L1-02 | ai-platform tests | `cd ai-platform && npm test` | [ ] |
| L1-03 | Extension compile (if touched) | `cd simplebeacon-vscode-merged && npm run compile` | [ ] |
| L1-04 | SimpleBeacon gate (full) | `npx simplebeacon scan --full --gate --format json` | [ ] |
| L1-05 | No secrets in diff | Manual review: no hardcoded keys, no plaintext clientSecret in test fixtures | [ ] |
| L1-06 | npm audit (if deps changed) | `npm audit` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Per-org ciphertext isolation | Create two SSO configs with the same `clientSecret` for `org-a` and `org-b`; read `sso-configs.json` raw | The two `oidc.clientSecret` values are different ciphertexts | [ ] |
| L2-02 | Correct org can decrypt its own secret | Call `getConfigDecrypted(providerIdA)` and `getConfigDecrypted(providerIdB)` | `_decryptedSecret` equals the original plaintext for each provider | [ ] |
| L2-03 | Masked display for admin list | Call `getAllConfigs()` and `getConfigsByOrg('org-a')` | `clientSecret` is masked as `••••` and never returned in plaintext | [ ] |
| L2-04 | Update re-encrypts with per-org key | Update `oidc.clientSecret` for an existing provider and read raw store | Ciphertext changes and decrypts to the new value | [ ] |
| L2-05 | Legacy base64 fallback | Load an existing `sso-configs.json` with a base64-encrypted `clientSecret` and call `getConfigDecrypted` | Plaintext is recovered via legacy `decryptSecret` fallback | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Missing or empty `orgId` | `createConfig` rejects or falls back to non-org encryption; no crash | [ ] |
| L3-02 | No `clientSecret` provided | `oidc.clientSecret` remains `undefined` or `null`; no encryption attempted | [ ] |
| L3-03 | Malformed / tampered ciphertext | `decryptForOrg` returns `''` without throwing and does not expose key | [ ] |
| L3-04 | Cache invalidation after write | After `createConfig`/`updateConfig`, a subsequent `getAllConfigs` sees the new/updated entry | [ ] |
| L3-05 | Other `crypto-utils` callers unaffected | Existing `encrypt`/`decrypt` outputs remain identical before and after the change | [ ] |
| L3-06 | No new files created | Broom strategy: only 2 files edited, 0 new modules | [ ] |
| L3-07 | Per-org ciphertext uses `enc:sb:` prefix | All per-org values start with `enc:sb:` and legacy `enc:` values are not mis-routed | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No raw master key material is logged, written to disk, or committed | [ ] |
| S-02 | Per-org derived key is not persisted; only `orgId` and ciphertext are stored | [ ] |
| S-03 | Plaintext `clientSecret` never appears in `sso-configs.json` or test artifacts | [ ] |
| S-04 | No new external dependencies; only Node built-in `crypto` is used | [ ] |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________
