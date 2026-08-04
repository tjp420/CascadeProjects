# test_plan.md

> Option C: Multi-Tenant Boundary Saturation Fuzzing — 15-test deterministic fuzzing matrix
> probing the CryptoPolicyEngine public API surface for prototype pollution, type confusion,
> and cross-tenant memory space leaks.

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Option C: Multi-Tenant Boundary Saturation Fuzzing |
| Author (Builder) | Devin (Builder mode) |
| Date | 2026-08-03 |
| Branch | feat/tenant-boundary-fuzz-matrix |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/lib/hsm-adapter/__tests__/tenant-fuzz-harness.cjs` (extend with PRNG + type-confusion + cross-tenant helpers)
- `ai-platform/server/lib/hsm-adapter/__tests__/tenant-boundary-saturation.test.cjs` (extend from 1 test to 15 tests)
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs` (READ-ONLY — no feature code changes in Builder phase)

### APIs / routes

- `CryptoPolicyEngine` constructor: `new CryptoPolicyEngine(policy, options)`
- `CryptoPolicyEngine.validate(tenantId, operation, config)` — public validation gate
- `CryptoPolicyEngine.getPolicy(tenantId)` — public tenant policy accessor
- `CryptoPolicyEngine.static load(filePath, options)` — static file loader
- `CryptoPolicyEngine.reload()` — hot-reload from path
- Internal: `_parsePolicy(policy)`, `_getTenantPolicy(tenantId)`, `_mergeWithDefault(tenantPolicy)`, `_isObject(value)`

### UI / IDE surfaces

- [ ] N/A — pure backend library testing, no UI/IDE surfaces involved

---

## Fuzzing Matrix Design

### PRNG methodology

Use a deterministic cryptographic hash-chain PRNG seeded with a fixed 256-bit seed. Each test
draws deterministic inputs from the chain so failures are reproducible across runs.

```
seed = 'tenant-fuzz-v1-0000000000000000000000000000000000000000000000000000000000000001'
state = sha256(seed)
next() { state = sha256(state); return state }
```

### Attack vectors

| Vector | Target | Goal |
|--------|--------|------|
| Prototype pollution | `_mergeWithDefault`, `_parsePolicy` | Verify `__proto__`, `constructor.prototype`, and `Object.prototype` injections in tenant blobs do not leak into DEFAULT_POLICY or other tenants |
| Type confusion | `validate(tenantId, operation, config)` | Verify non-string tenantId, non-object config, numeric/string coercion, and wrong-type operation fields are rejected with UNAUTHORIZED_KEY_ACCESS or POLICY_VIOLATION_BLOCKED |
| Cross-tenant memory leak | `getPolicy(tenantId)`, `_getTenantPolicy` | Verify tenant A's policy mutations do not appear in tenant B's resolved policy; verify object identity isolation (no shared references) |

---

## Level 1 - Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on changed JS/CJS | `node -c ai-platform/server/lib/hsm-adapter/__tests__/tenant-fuzz-harness.cjs` | [ ] |
| L1-02 | Syntax on changed test file | `node -c ai-platform/server/lib/hsm-adapter/__tests__/tenant-boundary-saturation.test.cjs` | [ ] |
| L1-03 | ai-platform tests | `cd ai-platform && npm test` | [ ] |
| L1-04 | SimpleBeacon gate (full) | `npx simplebeacon scan --full --gate --format json` | [ ] |
| L1-05 | No secrets in diff | Manual / gate token rules | [ ] |
| L1-06 | npm audit (if deps changed) | N/A — no dependency changes | [ ] |

---

## Level 2 - Behavioral (Fuzzing matrix execution)

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | FUZZ-01: `__proto__` pollution in tenant blob | Construct engine with `tenants.malicious.__proto__ = { polluted: true }`; assert `Object.prototype.polluted` is undefined and `getPolicy('clean')` has no `polluted` key | Object.prototype clean, clean tenant unaffected | [ ] |
| L2-02 | FUZZ-02: `constructor.prototype` pollution in tenant blob | Construct engine with `tenants.malicious.constructor = { prototype: { pollutedViaConstructor: true } }`; assert no prototype pollution | Object.prototype clean | [ ] |
| L2-03 | FUZZ-03: Nested `__proto__` in sub-blocks (pqc, zkp, threshold) | Inject `__proto__` into `tenantPolicy.pqc.__proto__`, `tenantPolicy.zkp.__proto__`, `tenantPolicy.threshold.__proto__`; verify DEFAULT_POLICY sub-blocks remain clean | DEFAULT_POLICY sub-blocks unpolluted | [ ] |
| L2-04 | FUZZ-04: Non-string tenantId (type confusion) | Call `validate(123, 'createKEK', {...})`, `validate(null, ...)`, `validate(undefined, ...)`, `validate([], ...)` | Throws HsmAdapterError with code UNAUTHORIZED_KEY_ACCESS | [ ] |
| L2-05 | FUZZ-05: Empty string tenantId | Call `validate('', 'createKEK', {...})` | Throws HsmAdapterError with code UNAUTHORIZED_KEY_ACCESS | [ ] |
| L2-06 | FUZZ-06: Non-object config (type confusion) | Call `validate('t1', 'createKEK', 'string')`, `validate('t1', 'createKEK', 42)`, `validate('t1', 'createKEK', null)`, `validate('t1', 'createKEK', [])` | Does not crash with TypeError; either throws HsmAdapterError or returns true with no side effects | [ ] |
| L2-07 | FUZZ-07: Unknown operation string | Call `validate('t1', 'nonexistentOp', {...})` | Returns true (falls through to default kekBits/algorithm validation) without crash | [ ] |
| L2-08 | FUZZ-08: Numeric operation field | Call `validate('t1', 42, {...})` | Does not crash; falls through to default validation or returns true | [ ] |
| L2-09 | FUZZ-09: Cross-tenant policy isolation | Construct engine with tenants A (minimumKekBits=128) and B (minimumKekBits=256); mutate A's resolved policy object; verify B's policy is unaffected | Tenant B policy unchanged after A mutation | [ ] |
| L2-10 | FUZZ-10: Cross-tenant object identity isolation | Call `getPolicy('A')` and `getPolicy('B')` for two tenants; verify they return distinct object references (not shared) | `getPolicy('A') !== getPolicy('B')` | [ ] |
| L2-11 | FUZZ-11: DEFAULT_POLICY immutability after tenant merge | Construct engine with malicious tenant blob; verify `DEFAULT_POLICY` object reference still has original key values (no mutation from `_mergeWithDefault`) | DEFAULT_POLICY keys unchanged | [ ] |
| L2-12 | FUZZ-12: Deterministic PRNG reproducibility | Run PRNG with fixed seed twice; verify identical output sequences | Two runs produce identical 256-bit chain | [ ] |
| L2-13 | FUZZ-13: PRNG-driven random tenant blob generation | Generate 100 random tenant blobs using hash-chain PRNG; construct engine for each; verify no prototype pollution or crash | All 100 constructions succeed without pollution | [ ] |
| L2-14 | FUZZ-14: PRNG-driven random validate() calls | Generate 100 random `validate()` calls with PRNG-driven tenantId/operation/config combinations; verify no crash or unhandled exception | All 100 calls either return true or throw HsmAdapterError (no raw TypeError) | [ ] |
| L2-15 | FUZZ-15: Cross-tenant memory space leak via shared sub-block reference | Construct engine with tenants A and B both having `pqc` config; mutate `getPolicy('A').pqc` object; verify `getPolicy('B').pqc` is unaffected | Tenant B pqc block unchanged after A mutation | [ ] |

---

## Level 3 - Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Existing FUZZ-01 test still passes | Original prototype pollution test from prior session remains green | [ ] |
| L3-02 | Existing crypto-policy-engine.test.cjs still passes | All 50+ existing CryptoPolicyEngine tests remain green (no regression) | [ ] |
| L3-03 | No scope creep — crypto-policy-engine.cjs unchanged | Validator confirms no feature code changes to the engine itself | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No credentials / PII in logs or commits | [ ] |
| S-02 | Fuzz inputs are deterministic (fixed seed) — no entropy from system sources | [ ] |
| S-03 | Prototype pollution tests clean up `Object.prototype` after each test (delete injected keys) | [ ] |

---

## Implementation notes

- The fuzzing harness (`tenant-fuzz-harness.cjs`) will be extended with:
  - `makeHashChainPrng(seed)` — deterministic SHA-256 chain PRNG
  - `makeTypeConfusionInputs()` — non-string tenantId, non-object config, numeric operation
  - `makeCrossTenantIsolationPolicy()` — two-tenant policy with shared sub-block references
  - `makeNestedProtoPollutionPolicy()` — `__proto__` injected into pqc/zkp/threshold sub-blocks
- The test file (`tenant-boundary-saturation.test.cjs`) will be extended from 1 test to 15 tests
- No changes to `crypto-policy-engine.cjs` — this is purely a test/harness expansion
- Each prototype pollution test must clean up `Object.prototype` in afterEach to prevent test pollution

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________
