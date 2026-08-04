# Test Plan: Track 119 Phase 3 — Multi-Tenant Fuzzing & Edge Cases

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Add 6 Track 119 mutator functions + 14 cleanup keys to `tenant-fuzz-harness.cjs`, plus a 9-check fuzz test file stress-testing the `crossClusterMigration` validation layer |
| Author (Builder) | Builder |
| Date | 2026-08-04 |
| Branch | feat/track119-multi-tenant-fuzz |
| Packages touched | ai-platform |

## Scope

### Files in scope (Broom strategy — 2 files)

1. `ai-platform/server/lib/hsm-adapter/__tests__/tenant-fuzz-harness.cjs` — add 6 Track 119 mutator functions + 14 cleanup keys
2. `ai-platform/server/lib/hsm-adapter/__tests__/track119-multi-tenant-fuzz.test.cjs` — new Jest test file (9 checks)

### Tracking keys for prototype contamination detection

Following the Track 118 pattern (2 base + 10 nested + 2 deep = 14 keys):

| Key | Purpose |
|-----|---------|
| `migrationGatePolluted` | Direct `__proto__` pollution on crossClusterMigration block |
| `migrationConstructorPolluted` | Direct `constructor.prototype` pollution |
| `migrationProtoLevel0` through `migrationProtoLevel4` | 5-level nested `__proto__` chain |
| `migrationCtorLevel0` through `migrationCtorLevel4` | 5-level nested `constructor.prototype` chain |
| `migrationDeepMinQuorumNodes` | Deep nested policy key contamination |
| `migrationDeepMaxConcurrentMigrations` | Deep nested policy key contamination |

### 6 mutator functions to add to `tenant-fuzz-harness.cjs`

| # | Function | Purpose |
|---|----------|---------|
| 1 | `makeTrack119ProtoPollutionPolicy()` | Basic `__proto__`/`constructor` pollution on `crossClusterMigration` block with `track119-polluter` and `track119-clean` tenants |
| 2 | `makeTrack119DeepNestedPollutionPolicy()` | 5-level nested `__proto__`/`constructor` pollution with `track119-deep-polluter` tenant |
| 3 | `makeTrack119TypeConfusionConfigs()` | 6 type confusion cases: string-numbers, array-object values, null-undefined values, string-booleans, boolean-numbers, **array-flooded attestation authorities** |
| 4 | `makeTrack119PrngDrivenValidateCall(prng)` | PRNG-driven validation calls with boundary values for all 7 policy keys, including mixed-type `allowedAttestationAuthorities` arrays |
| 5 | `makeTrack119PrngDrivenMultiLayerPolicy(prng)` | Multi-layer random policies (2-5 tenants, 1-4 layers) with random pollution attachment |
| 6 | `makeTrack119ConcurrentValidationCall(prng)` | Concurrent validation flood calls for race condition testing |

### Attestation authority array fuzzing (your question 2)

Yes — the type confusion configs will aggressively flood the `allowedAttestationAuthorities` array with:
- Mixed data types: `['mock-authority', 123, null, {}, [], true, undefined]`
- Array mutations: nested arrays `[['mock-authority'], ['spoofed']]`
- Prototype pollution via array: `[{ __proto__: { migrationGatePolluted: true } }]`
- Empty array: `[]`
- Non-array values: `'mock-authority'` (string), `123` (number), `{ authority: 'mock' }` (object)

### Test structure (9 checks following Track 118 pattern)

| ID | Test | Iterations |
|----|------|------------|
| FUZZ-119-01 | Prototype pollution in crossClusterMigration is blocked | 1 |
| FUZZ-119-02 | 5-level nested `__proto__`/`constructor` pollution is blocked | 1 |
| FUZZ-119-03 | Deterministic SHA-256 PRNG is reproducible | 20 |
| FUZZ-119-04 | 1000 multi-layer random policies construct and merge without crash or pollution | 1000 |
| FUZZ-119-05 | Strict reference sandboxing — mutation does not cross-tenant leak | 1 |
| FUZZ-119-06 | Track 119 type confusion fails closed with structured HsmAdapterError | 6 |
| FUZZ-119-07 | PRNG-driven crossClusterMigration validation — 100 calls, no unhandled crash | 100 |
| FUZZ-119-08 | Concurrent validation flood does not race or crash | 1000 |
| FUZZ-119-09 | Cross-tenant crossClusterMigration mutation isolation | 1 |

### Tenant IDs

- `track119-polluter` (malicious tenant with prototype pollution)
- `track119-clean` (clean tenant for isolation verification)
- `track119-deep-polluter` (for 5-level nested pollution)
- `t1` (generic tenant in PRNG-driven tests)
- `track119-tenant-{random-8-chars}` (PRNG-generated)

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on tenant-fuzz-harness.cjs | `node -c ai-platform/server/lib/hsm-adapter/__tests__/tenant-fuzz-harness.cjs` | [ ] |
| L1-02 | Syntax on track119-multi-tenant-fuzz.test.cjs | `node -c ai-platform/server/lib/hsm-adapter/__tests__/track119-multi-tenant-fuzz.test.cjs` | [ ] |
| L1-03 | Track 119 fuzz tests pass | `cd ai-platform && npx jest --testPathPatterns track119-multi-tenant-fuzz` | [ ] |
| L1-04 | Existing Track 118 fuzz tests still pass (regression) | `cd ai-platform && npx jest --testPathPatterns track118-multi-tenant-fuzz` | [ ] |
| L1-05 | Existing Track 117 fuzz tests still pass (regression) | `cd ai-platform && npx jest --testPathPatterns track117-multi-tenant-fuzz` | [ ] |
| L1-06 | Track 119 REST route tests still pass (regression) | `cd ai-platform && npx jest --testPathPatterns track119-rest-routes` | [ ] |
| L1-07 | SimpleBeacon gate (full) | `npx simplebeacon scan --full --gate --format json` | [ ] |
| L1-08 | No secrets in diff | Manual / gate token rules | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Prototype pollution blocked | Load `makeTrack119ProtoPollutionPolicy()`, construct engine, check `Object.prototype.migrationGatePolluted` is undefined | Pollution blocked | [ ] |
| L2-02 | Deep nested pollution blocked | Load `makeTrack119DeepNestedPollutionPolicy()`, construct engine, check all 12 nested keys are undefined | Pollution blocked | [ ] |
| L2-03 | PRNG reproducibility | Create 2 PRNGs with same seed, generate 20 values each, compare | All values match | [ ] |
| L2-04 | Multi-layer policy construction | 1000 iterations of `makeTrack119PrngDrivenMultiLayerPolicy()`, construct engine each time, check no pollution | No crash, no pollution | [ ] |
| L2-05 | Cross-tenant isolation | Mutate `track119-polluter` policy, verify `track119-clean` policy unchanged | No cross-tenant leak | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Type confusion fails closed | All 6 type confusion configs throw `HsmAdapterError` with `POLICY_VIOLATION_BLOCKED` or fail gracefully | [ ] |
| L3-02 | PRNG-driven validation — 100 calls | No unhandled crashes, all throw `HsmAdapterError` or return `true` | [ ] |
| L3-03 | Concurrent validation flood — 1000 calls | No race conditions, no crashes, all promises resolve | [ ] |
| L3-04 | Cross-tenant mutation isolation | Mutating `track119-polluter` crossClusterMigration does not affect `track119-clean` | [ ] |
| L3-05 | Existing Track 118 fuzz tests unchanged | Track 118 fuzz tests still pass (9/9) | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No credentials / PII in fuzz test data | [ ] |
| S-02 | Prototype pollution does not leak to other tenants | [ ] |
| S-03 | Attestation authority array flooding does not bypass validation | [ ] |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________
