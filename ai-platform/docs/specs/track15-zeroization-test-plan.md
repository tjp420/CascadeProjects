# test_plan.md — Track 15: Volatile Memory Purging & Key Zeroization

> Skeleton for the Validator to review before Builder writes feature code.

## Metadata

| Field            | Value                                               |
| ---------------- | --------------------------------------------------- |
| Feature / change | Track 15: Volatile Memory Purging & Key Zeroization |
| Author (Builder) | Devin                                               |
| Date             | 2026-08-01                                          |
| Branch           | `feature/track15-groundwork`                        |
| Packages touched | ai-platform                                         |

## Scope

### Files in scope

- `ai-platform/server/lib/hsm-adapter/secure-zeroize.cjs` (new — buffer / KeyObject overwrite)
- `ai-platform/server/lib/hsm-adapter/volatile-eviction-engine.cjs` (new — inactivity timer + purge)
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs` (add `zeroize`, `evictInactive`, audit payload hooks)
- `ai-platform/server/lib/hsm-adapter/software-adapter.cjs` (use `secure-zeroize` on `KEK` purge)
- `ai-platform/server/lib/hsm-adapter/asymmetric-adapter.cjs` (use `secure-zeroize` on `KeyObject` purge)
- `ai-platform/server/lib/hsm-adapter/__tests__/secure-zeroize.test.cjs` (new)
- `ai-platform/server/lib/hsm-adapter/__tests__/volatile-eviction-engine.test.cjs` (new)
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs` (add `eviction` policy fields)
- `ai-platform/docs/specs/track15-zeroization-test-plan.md` (this file)

### APIs / interfaces

- `secureZeroize(buffer)` — overwrite a Buffer with random or zero bytes
- `secureZeroizeKeyObject(keyObject)` — export and discard a crypto.KeyObject reference
- `VolatileEvictionEngine(policy, options)` — per-tenant inactivity monitor
- `VolatileEvictionEngine.register(tenantId, kekId, zeroizeCallback)`
- `VolatileEvictionEngine.touch(tenantId, kekId)`
- `BaseHsmAdapter.zeroize(kekId)`
- `BaseHsmAdapter.evictInactive()`
- `BaseHsmAdapter._logEviction(tenantId, kekId, reason, metadata)`

### UI / IDE surfaces

- [ ] Main dashboard iframe / address bar
- [ ] Sidebar webview
- [ ] Welcome / main window panel
- [ ] Simple Browser / external browser

---

## Design decisions

- **Explicit secure zeroization:** Node.js `Buffer` instances are mutable, so `secureZeroize` can overwrite their underlying memory with `crypto.randomFillSync` or `Buffer.fill(0x00)`. `KeyObject` instances are opaque and managed by OpenSSL/Node internals; the best we can do is remove all references and force `v8` to collect. For `KeyObject`, `secureZeroizeKeyObject` will clear any cached exported forms and set the reference to `null`.
- **Zeroization strategies:**
  - `random` (default): overwrite with `crypto.randomFillSync` — more resistant to remanence attacks.
  - `zeros`: overwrite with `0x00` — faster, deterministic.
  - `both`: random then zeros.
- **Volatile eviction engine:** A single `VolatileEvictionEngine` instance per adapter. It registers each `kekId` with a `lastUsed` timestamp. A periodic timer (default 30s) scans for entries whose `lastUsed + inactivityEvictionSeconds` is in the past and invokes the adapter's `zeroize` callback. The timer is optional and disabled in tests via `options.intervalMs`.
- **Policy-driven eviction interval:** `CryptoPolicyEngine` schema extended with:
  - `eviction.inactivityEvictionSeconds` (default 0 = disabled)
  - `eviction.zeroizeStrategy` (`'random' | 'zeros' | 'both'`)
  - `eviction.auditOnEvict` (boolean)
- **Audit integration:** Every `zeroize` and `evictInactive` event emits a structured audit payload through the existing `BaseHsmAdapter._log` pathway (or a new `_audit` helper). The payload contains:
  - `event: 'KEY_ZEROIZED' | 'KEY_EVICTED'`
  - `tenantId`
  - `kekId`
  - `reason` (`explicit`, `inactivity`, `unauthorized`, `rotation`)
  - `timestamp`
  - `strategy`
- **Safety guards:**
  - Zeroization cannot be called on an active key currently in use (ref count > 0) unless `force: true`.
  - `evictInactive` is safe to call at any time and skips active keys.
  - `secureZeroize` throws `INVALID_INPUT` if the argument is not a `Buffer` or typed array.

---

## Level 1 — Deterministic (Validator MUST run all)

| ID    | Check                                               | Command / method                                                                                                                     | Pass |
| ----- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| L1-01 | Syntax on changed `.cjs` files                      | `node -c <file>`                                                                                                                     | [ ]  |
| L1-02 | Secure zeroize tests pass                           | `cd ai-platform && npx jest --config jest.config.cjs secure-zeroize`                                                                 | [ ]  |
| L1-03 | Volatile eviction tests pass                        | `cd ai-platform && npx jest --config jest.config.cjs volatile-eviction-engine`                                                       | [ ]  |
| L1-04 | HSM/adapter tests still pass with zeroization hooks | `cd ai-platform && npx jest --config jest.config.cjs hsm-adapter asymmetric-adapter multi-tenant-key-isolation crypto-policy-engine` | [ ]  |
| L1-05 | Full `ai-platform` test suite passes                | `cd ai-platform && npm test`                                                                                                         | [ ]  |
| L1-06 | SimpleBeacon full gate                              | `npx simplebeacon scan --full --gate --format json`                                                                                  | [ ]  |
| L1-07 | No secrets in diff                                  | `git diff --cached`                                                                                                                  | [ ]  |

---

## Level 2 — Behavioral

| ID    | Scenario                                  | Steps                                                                                     | Expected                                               | Pass |
| ----- | ----------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------ | ---- |
| L2-01 | Buffer zeroization overwrites all bytes   | Create a `Buffer` with known bytes, call `secureZeroize(buffer)`, inspect contents        | All bytes overwritten to non-original (random or zero) | [ ]  |
| L2-02 | `zeros` strategy leaves all zeros         | Call `secureZeroize(buffer, { strategy: 'zeros' })`                                       | Buffer is all `0x00`                                   | [ ]  |
| L2-03 | `both` strategy applies random then zeros | Call `secureZeroize(buffer, { strategy: 'both' })`                                        | Buffer is all `0x00` (after random phase)              | [ ]  |
| L2-04 | KeyObject reference removal               | Create a `KeyObject`, call `secureZeroizeKeyObject(key)`, attempt to use it               | Operation fails or throws because reference is gone    | [ ]  |
| L2-05 | Inactivity eviction fires                 | Set `inactivityEvictionSeconds: 1`, register a key, wait, verify zeroize callback invoked | Callback called with `reason: 'inactivity'`            | [ ]  |
| L2-06 | Active key not evicted                    | Register key, call `touch` repeatedly, wait past interval                                 | Zeroize callback not called                            | [ ]  |
| L2-07 | Policy-driven eviction interval           | Load policy with `eviction.inactivityEvictionSeconds: 5`, create adapter, register, wait  | Eviction occurs at ~5s                                 | [ ]  |

---

## Level 3 — Edge cases & regression

| ID    | Case                                                   | Expected                                               | Pass |
| ----- | ------------------------------------------------------ | ------------------------------------------------------ | ---- |
| L3-01 | Zeroize non-Buffer throws                              | `secureZeroize('not-a-buffer')` throws `INVALID_INPUT` | [ ]  |
| L3-02 | Zeroize already zeroized buffer is a no-op             | Returns without error                                  | [ ]  |
| L3-03 | Eviction engine disabled when interval is 0            | No timer created; no callbacks                         | [ ]  |
| L3-04 | Multiple registrations for same kekId update timestamp | Last `touch` wins; not double-registered               | [ ]  |
| L3-05 | `evictInactive` called manually purges all idle keys   | All idle keys zeroized; active remain                  | [ ]  |
| L3-06 | Existing Track 10–14 tests still pass                  | No regressions                                         | [ ]  |

---

## Security

| ID   | Requirement                                                              | Pass |
| ---- | ------------------------------------------------------------------------ | ---- |
| S-01 | Zeroization overwrites memory before GC, not just drops reference        | [ ]  |
| S-02 | Eviction audit payload does not include key material                     | [ ]  |
| S-03 | `KeyObject` purge cannot be bypassed to recover raw bytes                | [ ]  |
| S-04 | Eviction timer does not prevent process exit when no keys are registered | [ ]  |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________ Date: __________
