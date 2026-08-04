# Test Plan: Track 32 Multi-Tenant Fuzzing Matrix

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Track 32 aggressive multi-tenant fuzzing matrix for CryptoPolicyEngine merge routines |
| Author (Builder) | Devin |
| Date | 2026-08-04 |
| Branch | `feat/track32-multi-tenant-fuzz` |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/lib/hsm-adapter/__tests__/track32-multi-tenant-fuzz.test.cjs` *(new adversarial test suite)*
- `ai-platform/server/lib/hsm-adapter/__tests__/tenant-fuzz-harness.cjs` *(extend with Track 32 specific mutators)*
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs` *(target of fuzzing; no source changes unless bugs found)*

### APIs / routines under test

- `CryptoPolicyEngine._parsePolicy()`
- `CryptoPolicyEngine._mergeWithDefault()`
- `CryptoPolicyEngine.getPolicy(tenantId)`
- `CryptoPolicyEngine.validate(tenantId, operation, config)`

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on new test file | `node -c ai-platform/server/lib/hsm-adapter/__tests__/track32-multi-tenant-fuzz.test.cjs` | [ ] |
| L1-02 | Syntax on harness additions | `node -c ai-platform/server/lib/hsm-adapter/__tests__/tenant-fuzz-harness.cjs` | [ ] |
| L1-03 | Target module still loads | `node -c ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs` | [ ] |
| L1-04 | Fuzz suite green | `cd ai-platform && npx jest track32-multi-tenant-fuzz --coverage=false` | [ ] |
| L1-05 | Parallel suite remains green | `cd ai-platform && npm run test:parallel` | [ ] |
| L1-06 | SimpleBeacon gate (full) | `npx simplebeacon scan --full --gate --format json` | [ ] |
| L1-07 | No secrets in diff | `node packages/simplebeacon-cli/bin/simplebeacon.js secrets-gate --path .` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | SHA-256 PRNG reproducibility | Instantiate `makeHashChainPrng` with identical seeds, advance 1000 steps | Outputs match bit-for-bit | [ ] |
| L2-02 | 1000 deterministic policy merges | Run `makeTrack32MultiLayerPolicyMutations` for 1000 iterations, construct `CryptoPolicyEngine` each time | No crash, no prototype pollution, no cross-tenant leakage | [ ] |
| L2-03 | Concurrent validation flood | `Promise.all` 1000 parallel `engine.validate()` calls across mixed tenant IDs | No race-condition crashes; tenant policies remain isolated | [ ] |
| L2-04 | Multi-layer nested payload mutations | Feed 5-level nested objects with randomized `pqc`, `zkp`, `threshold`, `governance`, `ringGating` blocks | `_mergeWithDefault` preserves defaults and ignores unexpected keys | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Tenant ID collisions under PRNG | Reuse generated `tenant-*` ids across iterations | Each tenant resolves to its own policy; no shared reference leakage | [ ] |
| L3-02 | Extreme nested array pollution | Arrays injected inside nested policy blocks | Engine treats arrays as non-objects and falls back to defaults | [ ] |
| L3-03 | `__proto__` / `constructor.prototype` at depth 5 | Deep nested prototype pollution attempts | `Object.prototype` unchanged; resolved policy not polluted | [ ] |
| L3-04 | `null` / `undefined` tenant overrides | Tenant explicitly sets nested blocks to `null` | Merge falls back to default block cleanly | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No hard-coded KEK, seed, or tenant secrets in the test | [ ] |
| S-02 | Fuzz payloads cannot escape the Node process or write outside `.data` | [ ] |
| S-03 | Prototype pollution cleanup runs after each test (`afterEach`) | [ ] |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________
