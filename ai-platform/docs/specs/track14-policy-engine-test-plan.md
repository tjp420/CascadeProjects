# test_plan.md — Track 14: Dynamic Cryptographic Policy & Adaptive Key Hardening

> Skeleton for the Validator to review before Builder writes feature code.

## Metadata

| Field            | Value                                                           |
| ---------------- | --------------------------------------------------------------- |
| Feature / change | Track 14: Dynamic Cryptographic Policy & Adaptive Key Hardening |
| Author (Builder) | Devin                                                           |
| Date             | 2026-08-01                                                      |
| Branch           | `feature/track14-groundwork`                                    |
| Packages touched | ai-platform                                                     |

## Scope

### Files in scope

- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs` (new — policy parser/validator)
- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json` (new — default JSON schema)
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs` (policy enforcement hooks)
- `ai-platform/server/lib/hsm-adapter/software-adapter.cjs` (KEK size validation against policy)
- `ai-platform/server/lib/hsm-adapter/asymmetric-adapter.cjs` (algorithm validation against policy)
- `ai-platform/server/lib/__tests__/crypto-policy-engine.test.cjs` (new)
- `ai-platform/docs/specs/track14-policy-engine-spec.md` (new)

### APIs / interfaces

- `CryptoPolicyEngine(policy, options)`
- `CryptoPolicyEngine.load(path)` — load policy from JSON file
- `CryptoPolicyEngine.reload()` — hot-reload from file
- `CryptoPolicyEngine.validate(tenantId, operation, config)`
- `BaseHsmAdapter.createKEK(tenantId, meta, policyContext)`
- `AsymmetricHsmAdapter.createKEK(tenantId, meta, policyContext)`
- `HsmAdapterError` code `POLICY_VIOLATION_BLOCKED`
- `HsmAdapterError` code `POLICY_DEPRECATED_WARNING` (non-fatal)

### UI / IDE surfaces

- [ ] Main dashboard iframe / address bar
- [ ] Sidebar webview
- [ ] Welcome / main window panel
- [ ] Simple Browser / external browser

---

## Design decisions

- **JSON policy schema per tenant:** Each tenant can have its own policy file or entry. A top-level `default` policy applies when a tenant is not explicitly configured. The schema is versioned with a `$schema` URI and a `version` string.
- **Hot-reloading:** `CryptoPolicyEngine` caches the parsed policy. `reload()` re-reads the configured file or object and replaces the cached policy atomically. File-watcher (`fs.watchFile`) is optional and off by default to avoid test flakiness. In production, the operator can call `reload()` after a deployment.
- **Default policy fields:**
  - `version`: semver string
  - `tenantId` or `default: true`
  - `allowedAlgorithms`: `{ aes: { kw: boolean, kwp: boolean, bits: [128, 192, 256] }, rsa: { oaep: boolean, minBits: number }, ecdh: { curves: ['P-256', 'P-384', 'P-521'] } }`
  - `minimumKekBits`: number
  - `keyExpirationDays`: number (0 = no expiry)
  - `deprecatedAlgorithms`: array of `{ algorithm, reason, rotationWindowDays }`
  - `allowEphemeralSecrets`: boolean
- **Enforcement points:**
  - `createKEK`: validate `algorithm`, `keySize`, `kekBits` against allowed values.
  - `wrap`/`unwrap`: validate the operation does not use a deprecated KEK; emit `POLICY_DEPRECATED_WARNING` if expiry is near or algorithm is deprecated.
  - `rotateKEK`: validate the new KEK complies with the current policy.
- **Error contract:**
  - Hard block: `POLICY_VIOLATION_BLOCKED` with `policyPath` and `constraint` in the error.
  - Soft warning: `POLICY_DEPRECATED_WARNING` (returned alongside a result or logged) — in Track 14 this is thrown as an error that can be caught and re-attempted, or logged and continued depending on `strictPolicy` mode.
- **Adaptive hardening:** On `createKEK`, if the selected config is deprecated, the engine can recommend an alternative. The adapter stores a `policyRecommendation` flag in the KEK metadata. A future background worker can read these flags and rotate.

---

## Level 1 — Deterministic (Validator MUST run all)

| ID    | Check                                          | Command / method                                                                                                | Pass |
| ----- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---- |
| L1-01 | Syntax on changed `.cjs` files                 | `node -c <file>`                                                                                                | [ ]  |
| L1-02 | Policy engine tests pass                       | `cd ai-platform && npx jest --config jest.config.cjs crypto-policy-engine`                                      | [ ]  |
| L1-03 | HSM/adapter tests still pass with policy hooks | `cd ai-platform && npx jest --config jest.config.cjs hsm-adapter asymmetric-adapter multi-tenant-key-isolation` | [ ]  |
| L1-04 | Full `ai-platform` test suite passes           | `cd ai-platform && npm test`                                                                                    | [ ]  |
| L1-05 | SimpleBeacon full gate                         | `node packages/simplebeacon-cli/bin/simplebeacon.js scan --full --gate --format json`                           | [ ]  |
| L1-06 | No secrets in diff                             | `git diff --cached`                                                                                             | [ ]  |

---

## Level 2 — Behavioral

| ID    | Scenario                                 | Steps                                                                                                              | Expected                                         | Pass |
| ----- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | ---- |
| L2-01 | Default policy allows allowed algorithms | Create `CryptoPolicyEngine` with default schema; validate `SoftwareHsmAdapter` `createKEK('t1', { kekBits: 256 })` | Returns `valid: true`                            | [ ]  |
| L2-02 | Tenant-specific policy overrides default | Load a tenant policy that only allows 128-bit KEKs; validate `createKEK` for 128 and 256                           | 128 passes; 256 blocked                          | [ ]  |
| L2-03 | Asymmetric algorithm enforcement         | Tenant policy disables `rsa-oaep`; `AsymmetricHsmAdapter` with `rsa-oaep` throws `POLICY_VIOLATION_BLOCKED`        | Blocked                                          | [ ]  |
| L2-04 | Policy hot-reload                        | Load policy A, then replace file with policy B, call `reload()`, validate                                          | New constraints apply                            | [ ]  |
| L2-05 | Deprecated KEK soft warning              | Create a KEK under a deprecated algorithm, then `wrap`                                                             | Returns a `POLICY_DEPRECATED_WARNING` or logs it | [ ]  |

---

## Level 3 — Edge cases & regression

| ID    | Case                                         | Expected                                                                                          | Pass |
| ----- | -------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---- |
| L3-01 | Unknown tenant falls back to default policy  | Uses `default` policy constraints                                                                 | [ ]  |
| L3-02 | Missing `allowedAlgorithms` in tenant policy | Falls back to default `allowedAlgorithms` or blocks with `POLICY_VIOLATION_BLOCKED` if no default | [ ]  |
| L3-03 | Invalid JSON policy file                     | Throws `POLICY_LOAD_FAILED`                                                                       | [ ]  |
| L3-04 | Hot-reload with missing file                 | Retains previous policy and warns                                                                 | [ ]  |
| L3-05 | `minimumKekBits` below 128                   | Treated as 128 or throws `POLICY_VIOLATION_BLOCKED`                                               | [ ]  |
| L3-06 | `keyExpirationDays` 0                        | No expiry enforcement                                                                             | [ ]  |
| L3-07 | Existing `kek-rotation` tests still pass     | Track 10 rotation not broken                                                                      | [ ]  |

---

## Security

| ID   | Requirement                                                                   | Pass |
| ---- | ----------------------------------------------------------------------------- | ---- |
| S-01 | Policy cannot be bypassed by direct `_createKEK` calls                        | [ ]  |
| S-02 | Default policy is the most restrictive set (deny by default)                  | [ ]  |
| S-03 | Policy file path is not hardcoded; injectable via constructor                 | [ ]  |
| S-04 | `POLICY_VIOLATION_BLOCKED` is returned for both missing and disallowed config | [ ]  |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________ Date: __________
