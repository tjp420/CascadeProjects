# Test Plan: Multi-Tenant Cryptographic Sandbox Isolation Keys

> Per-directory derived encryption keys for multi-tenant database record directories, extending the existing `enc:sb:` sandbox key infrastructure.

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Multi-Tenant Cryptographic Sandbox Isolation Keys |
| Author (Builder) | Devin |
| Date | 2026-08-01 |
| Branch | feat/agentic-orchestration |
| Packages touched | ai-platform |

## Scope

### Files in scope

| File | Purpose |
|------|---------|
| `ai-platform/server/lib/crypto-utils.cjs` | Extend with `deriveDirectoryKey`, `encryptForDirectory`, `decryptForDirectory`, `isDirectoryEncrypted`, `directoryKeyFingerprint` |
| `ai-platform/server/routes/workspace-config-routes.cjs` | Add `GET /api/workspace/isolation-key/:directory` to expose a public fingerprint for an org+record-directory key |
| `ai-platform/server/lib/__tests__/sandbox-isolation-keys.test.cjs` | Jest tests for derivation, encryption round-trip, cross-directory key isolation, and invalid input handling |

### APIs / routes

- `GET /api/workspace/isolation-key/:directory?orgId=<orgId>` — returns the SHA-256 fingerprint of the derived key for the given org and directory. Returns `400` if `orgId` or `directory` missing.

### Isolation model

- A master `ENCRYPTION_KEY` is mixed via HMAC with a domain-separated salt: `sb:dir:<orgId>:<directory>`.
- Two different `(orgId, directory)` tuples must produce uncorrelated 32-byte AES-GCM keys.
- The ciphertext format reuses `enc:sb:` prefix with structure `iv:tag:ciphertext`.
- Directory keys are **not persisted**; they are deterministically derived on demand.

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on modified files | `node -c ai-platform/server/lib/crypto-utils.cjs`, `node -c ai-platform/server/routes/workspace-config-routes.cjs` | [ ] |
| L1-02 | ai-platform tests | `cd ai-platform && npm test` | [ ] |
| L1-03 | SimpleBeacon full gate | `npx simplebeacon scan --full --gate --format json` | [ ] |
| L1-04 | npm audit (no package.json changes expected) | `npm audit` in touched package roots | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Directory key is deterministic | Call `deriveDirectoryKey('org-a', 'customers')` twice | Same 32-byte Buffer both times | [ ] |
| L2-02 | Org + directory produces unique key | Compare `deriveDirectoryKey('org-a', 'customers')` vs `deriveDirectoryKey('org-b', 'customers')` | Different keys | [ ] |
| L2-03 | Different directories for same org differ | Compare `deriveDirectoryKey('org-a', 'customers')` vs `deriveDirectoryKey('org-a', 'payments')` | Different keys | [ ] |
| L2-04 | Encryption round-trip | `encryptForDirectory('secret', 'org-a', 'customers')` then `decryptForDirectory(...)` | Returns `secret` | [ ] |
| L2-05 | Fingerprint API | `GET /api/workspace/isolation-key/customers?orgId=org-a` | Returns `success: true` and `fingerprint` (sha256 hex) | [ ] |

---

## Level 3 — Edge cases & security

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Decrypting with wrong org fails | `decryptForDirectory(ciphertext, 'org-b', 'customers')` on `org-a` ciphertext | Returns empty string (auth tag mismatch) | [ ] |
| L3-02 | Decrypting with wrong directory fails | `decryptForDirectory(ciphertext, 'org-a', 'payments')` | Returns empty string | [ ] |
| L3-03 | Missing orgId throws | `deriveDirectoryKey('', 'customers')` | Throws `TypeError` | [ ] |
| L3-04 | Missing directory throws | `deriveDirectoryKey('org-a', '')` | Throws `TypeError` | [ ] |
| L3-05 | API without orgId returns 400 | `GET /api/workspace/isolation-key/customers` | 400 with `missing orgId` | [ ] |
| L3-06 | API without directory returns 400 | `GET /api/workspace/isolation-key/?orgId=org-a` | 400 with `missing directory` | [ ] |
| L3-07 | Key fingerprint does not reveal key | The fingerprint is a sha256 of the key, never the raw key | Assert response contains only `fingerprint` and `directory` | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | Directory key uses HMAC-SHA256 with domain-separated salt `sb:dir:<orgId>:<directory>` | [ ] |
| S-02 | AES-256-GCM with 16-byte IV and 16-byte auth tag | [ ] |
| S-03 | No raw key material is logged, returned, or persisted | [ ] |
| S-04 | Directory keys are deterministic and reproducible without new secrets | [ ] |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________
