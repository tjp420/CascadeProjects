# test_plan.md — Track 13: Multi-Tenant Key Isolation & Envelope Derivation

> Skeleton for the Validator to review before Builder writes feature code.

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Track 13: Multi-Tenant Key Isolation & Envelope Derivation |
| Author (Builder) | Devin |
| Date | 2026-08-01 |
| Branch | `feature/track13-groundwork` |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs` (tenant-aware `_ensureTenant` hook)
- `ai-platform/server/lib/hsm-adapter/software-adapter.cjs` (tenant-isolated `_keks` store)
- `ai-platform/server/lib/hsm-adapter/asymmetric-adapter.cjs` (tenant `context` binding)
- `ai-platform/server/lib/hsm-adapter/multi-tenant-kek-derivation.cjs` (new — DEK derivation utility)
- `ai-platform/server/lib/__tests__/multi-tenant-key-isolation.test.cjs` (new)
- `ai-platform/docs/specs/track13-multi-tenant-spec.md` (new)

### APIs / interfaces

- `BaseHsmAdapter.createKEK(tenantId, meta)`
- `BaseHsmAdapter.wrap(tenantId, kekId, plaintext)`
- `BaseHsmAdapter.unwrap(tenantId, kekId, wrapped)`
- `BaseHsmAdapter.rotateKEK(tenantId, oldKekId)`
- `AsymmetricHsmAdapter.wrap(tenantId, kekId, plaintext, context)`
- `MultiTenantKeyDerivation.deriveDek(baseKek, salt, tenantId, keyId)`
- `MultiTenantKeyDerivation.deriveSalt()`

### UI / IDE surfaces

- [ ] Main dashboard iframe / address bar
- [ ] Sidebar webview
- [ ] Welcome / main window panel
- [ ] Simple Browser / external browser

---

## Design decisions

- **Tenant scope as first-class parameter:** All key lifecycle operations (`createKEK`, `wrap`, `unwrap`, `rotateKEK`, `listKEKs`) require an explicit `tenantId` string. `BaseHsmAdapter` will enforce it before delegating to the concrete adapter.
- **Key storage isolation:** Concrete adapters keep per-tenant key maps: `this._keks[tenantId]` or a flat `Map` keyed by `tenantId + ':' + kekId`. Direct `kekId` lookups without a `tenantId` are prohibited.
- **Tenant binding in HKDF context:** For `AsymmetricHsmAdapter` ECDH wraps, the `tenantId` is concatenated into the HKDF `context` parameter (e.g., `tenantId + ':' + appContext`) so the derived AES key is tenant-specific.
- **Per-transaction DEK derivation:** `multi-tenant-kek-derivation.cjs` uses `crypto.hkdfSync('sha256', baseKek, salt, tenantId + ':' + keyId, 32)` to produce a one-time DEK. The `salt` is a 32-byte random nonce stored alongside the ciphertext.
- **Envelope format:** Wrapped payloads include a 16-byte `salt` prefix for DEK-mode operations. Legacy non-tenant paths (without `tenantId`) are rejected.
- **Error contract:** Any cross-tenant or missing-tenant access throws `HsmAdapterError` with code `UNAUTHORIZED_KEY_ACCESS`.
- **Key identifier collision prevention:** `kekId` values are random 16-byte hex strings, but lookups are namespaced by `tenantId`. Two tenants may coincidentally have the same `kekId` without conflict.

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on changed `.cjs` files | `node -c <file>` | [ ] |
| L1-02 | Multi-tenant tests pass | `cd ai-platform && npx jest --config jest.config.cjs multi-tenant-key-isolation` | [ ] |
| L1-03 | Existing HSM/adapter tests still pass | `cd ai-platform && npx jest --config jest.config.cjs hsm-adapter asymmetric-adapter attestation` | [ ] |
| L1-04 | Full `ai-platform` test suite passes | `cd ai-platform && npm test` | [ ] |
| L1-05 | SimpleBeacon full gate | `node packages/simplebeacon-cli/bin/simplebeacon.js scan --full --gate --format json` | [ ] |
| L1-06 | No secrets in diff | `git diff --cached` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Create KEK for a tenant | `createKEK('tenant-a')` | Returns a `kekId` scoped to `tenant-a` | [ ] |
| L2-02 | Wrap and unwrap for same tenant | `wrap('tenant-a', kekId, plaintext)` then `unwrap('tenant-a', kekId, wrapped)` | Round-trip succeeds | [ ] |
| L2-03 | DEK-mode wrap/unwrap | Derive a per-transaction DEK and encrypt a payload; decrypt with the same `salt` and `tenantId` | Round-trip succeeds | [ ] |
| L2-04 | List KEKs is tenant-scoped | `listKEKs('tenant-a')` after creating keys for `tenant-a` and `tenant-b` | Returns only `tenant-a` keys | [ ] |
| L2-05 | Asymmetric wrap binds tenant to context | `wrap('tenant-a', kekId, plaintext, 'app-ctx')` then `unwrap('tenant-a', kekId, wrapped, 'app-ctx')` | Round-trip succeeds | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Missing `tenantId` | Throws `UNAUTHORIZED_KEY_ACCESS` | [ ] |
| L3-02 | Cross-tenant access attempt | `wrap('tenant-b', kekId-from-tenant-a, plaintext)` throws `UNAUTHORIZED_KEY_ACCESS` | [ ] |
| L3-03 | Wrong tenant on unwrap | `unwrap('tenant-b', kekId, wrapped-from-tenant-a)` throws `UNAUTHORIZED_KEY_ACCESS` | [ ] |
| L3-04 | Empty or null `tenantId` | Throws `UNAUTHORIZED_KEY_ACCESS` | [ ] |
| L3-05 | Same `kekId` across tenants | Both tenants can create the same string `kekId` with no collision because lookups are namespaced | [ ] |
| L3-06 | Salt reuse rejected | DEK derivation must not be called with an all-zeros or reused `salt` | [ ] |
| L3-07 | Legacy non-tenant calls | Existing `wrap(kekId, plaintext)` without `tenantId` throws or is unsupported | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | Keys from one tenant are never returned by another tenant's `listKEKs` | [ ] |
| S-02 | `tenantId` is cryptographically bound into the DEK and ECDH HKDF context | [ ] |
| S-03 | No raw base KEK is exposed in the DEK-mode envelope | [ ] |
| S-04 | Cross-tenant access throws `UNAUTHORIZED_KEY_ACCESS`, not `UNKNOWN_KEK` | [ ] |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________
