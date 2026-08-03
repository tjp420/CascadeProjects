# Multi-Tenant Boundary Saturation Testing — Technical Specification Blueprint

> test_plan.md — Phase 1 Spec. No feature code until user approval.
> Per QA framework: Builder drafts spec → User approves → Builder implements → Validator grades.

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Multi-tenant boundary saturation fuzzing matrix for CryptoPolicyEngine |
| Author (Builder) | Devin |
| Date | 2025-01-22 |
| Branch | (to be created on approval) |
| Packages touched | ai-platform |

## 1. Problem Statement

The `CryptoPolicyEngine` tenant merge layer (`_mergeWithDefault`) combines
tenant-specific policy overrides onto `DEFAULT_POLICY` via shallow + deep
merge. The `validate(tenantId, operation, config)` method resolves
tenant-specific policy and dispatches to operation-specific validators.

**The gap:** While individual tenant policies are tested in isolation, there
is no automated fuzzing matrix that:
1. Floods the merge layer with **malicious tenant override schemas** (prototype
   pollution, type confusion, null/undefined injection, deep nesting attacks)
2. Tests **cross-tenant isolation** under high concurrent load (many tenants
   validating simultaneously with conflicting configs)
3. Verifies **zero structural cross-tenant leakage** (one tenant's override
   must never bleed into another tenant's resolved policy)
4. Stresses **edge cases** in tenant ID resolution (empty strings, numeric
   coercion, prototype keys, special characters)

## 2. Existing Infrastructure (Grounding)

### Files already in the codebase

| File | Role | Reuse potential |
|------|------|-----------------|
| `server/lib/hsm-adapter/crypto-policy-engine.cjs` | Policy engine with `_mergeWithDefault`, `validate`, `_getTenantPolicy` | **Target** — fuzz the merge + validate paths |
| `server/lib/hsm-adapter/cluster-keyring-primitive-authorization.cjs` | Has `CROSS_TENANT_VIOLATION` check | **Target** — fuzz cross-tenant authorization |
| `server/lib/hsm-adapter/__tests__/crypto-policy-engine.test.cjs` | Existing policy engine tests | **Pattern reference** — test structure |
| `server/lib/hsm-adapter/__tests__/multi-tenant-key-isolation.test.cjs` | Existing tenant isolation tests | **Pattern reference** — tenant test patterns |
| `server/lib/hsm-adapter/__tests__/parallel-track-runner.cjs` | Parallel worker pool | **Reuse** — run saturation suites in parallel |
| `server/lib/hsm-adapter/__tests__/cluster-keyring-primitive-authorization.test.cjs` | Mock patterns (MockAttestationClient, etc.) | **Pattern reference** — mock setup |

### CryptoPolicyEngine tenant merge (the target)
```javascript
function _mergeWithDefault(tenantPolicy) {
  return {
    ...DEFAULT_POLICY,
    ...tenantPolicy,  // shallow — tenant wins
    // Deep merges for nested blocks:
    threshold: { ...DEFAULT_POLICY.threshold, ...(tenantPolicy.threshold || {}) },
    ratchet: { ...DEFAULT_POLICY.ratchet, ...(tenantPolicy.ratchet || {}) },
    // ... 60+ nested blocks
    clusterKeyringPrimitiveAuthorization: {
      ...DEFAULT_POLICY.clusterKeyringPrimitiveAuthorization,
      ...(tenantPolicy.clusterKeyringPrimitiveAuthorization || {}),
    },
  };
}

_getTenantPolicy(tenantId) {
  return this._policy.tenants[tenantId] || this._policy.default;
}

validate(tenantId, operation, config = {}) {
  // Validates tenantId is non-empty string
  // Resolves tenant policy via _getTenantPolicy
  // Dispatches to operation-specific validator
}
```

### Cross-tenant isolation patterns (existing)
- `cluster-keyring-primitive-authorization.cjs` line 106-108: `CROSS_TENANT_VIOLATION` check
- `cross-tenant-access-auditor.cjs`: dual-tenant approval enforcement
- `escrow-broker.cjs`: tenant party validation
- `software-adapter.cjs`: KEK ownership check
- `homomorphic-db-lookup-engine.cjs`: cross-tenant table blocking

### No existing fuzzing infrastructure
- No `fast-check`, `rapid-check`, or `chai-property` dependencies
- No existing fuzz/stress test files for the policy engine
- The `parallel-track-runner.cjs` can run saturation suites in parallel

## 3. Proposed Design (Broom Strategy — minimal new files)

### Approach: Deterministic fuzzing matrix (no new dependencies)

**Why no `fast-check`:**
- The Broom Strategy says: no new dependencies when built-ins suffice
- `crypto.randomBytes` provides deterministic-seedable randomness
- The fuzzing matrix is **deterministic** (same seed → same test cases)
- This ensures reproducibility for CI/CD

**Fuzzing strategy:**
1. **Malicious tenant override schemas** — pre-defined attack vectors
2. **Randomized tenant configs** — seeded PRNG generates varied configs
3. **Concurrent validation** — many tenants validate simultaneously
4. **Cross-tenant leakage detection** — verify resolved policies don't bleed

### 3a. New file: `server/lib/hsm-adapter/__tests__/tenant-boundary-saturation.test.cjs`

**Justification for new file:** This is a dedicated saturation test suite
that would be too large and too distinct from the existing
`crypto-policy-engine.test.cjs` to merge. It contains attack vectors,
fuzzing harnesses, and concurrent load tests that don't belong in the
unit test file.

**Structure (15 tests):**

#### Section 1: Malicious tenant override schemas (5 tests)

```javascript
describe('Malicious tenant override schemas', () => {
  test('FUZZ-01: prototype pollution attack on tenant merge', () => {
    // Attacker tries to inject __proto__ keys into tenant policy
    const engine = new CryptoPolicyEngine({
      default: {},
      tenants: {
        'malicious-tenant': {
          __proto__: { polluted: true },
          constructor: { prototype: { polluted: true } },
        },
      },
    });
    // Verify DEFAULT_POLICY is not polluted
    // Verify other tenants are not affected
    // Verify validate() still works correctly
  });

  test('FUZZ-02: type confusion in tenant config values', () => {
    // Attacker passes wrong types (string instead of number, array instead of object)
    const engine = new CryptoPolicyEngine({
      default: {},
      tenants: {
        'confused-tenant': {
          minimumKekBits: 'not-a-number',
          threshold: 'string-instead-of-object',
          ratchet: null,
          clusterKeyringPrimitiveAuthorization: 42,
        },
      },
    });
    // Verify validate() throws POLICY_VIOLATION_BLOCKED, not crash
  });

  test('FUZZ-03: null/undefined injection in tenant overrides', () => {
    // Attacker passes null/undefined to bypass policy checks
    const engine = new CryptoPolicyEngine({
      default: {},
      tenants: {
        'null-tenant': {
          minimumKekBits: null,
          threshold: undefined,
          fips: { enabled: null },
        },
      },
    });
    // Verify null/undefined doesn't bypass validation
  });

  test('FUZZ-04: deep nesting attack on nested policy blocks', () => {
    // Attacker creates deeply nested objects to cause stack overflow
    let deep = {};
    let current = deep;
    for (let i = 0; i < 1000; i++) {
      current.nested = {};
      current = current.nested;
    }
    const engine = new CryptoPolicyEngine({
      default: {},
      tenants: { 'deep-tenant': { threshold: deep } },
    });
    // Verify no stack overflow, validate() still works
  });

  test('FUZZ-05: tenant ID injection attacks', () => {
    // Attacker uses special tenant IDs: __proto__, constructor, toString, etc.
    const engine = new CryptoPolicyEngine({
      default: {},
      tenants: {
        '__proto__': { minimumKebBits: 64 },
        'constructor': { minimumKekBits: 64 },
        'toString': { minimumKekBits: 64 },
      },
    });
    // Verify these tenant IDs don't pollute Object.prototype
    // Verify validate() with these IDs uses default policy (not injected)
  });
});
```

#### Section 2: Cross-tenant isolation under load (5 tests)

```javascript
describe('Cross-tenant isolation under load', () => {
  test('FUZZ-06: 100 concurrent tenants with conflicting policies', () => {
    // Create 100 tenants, each with different policy overrides
    // Validate all 100 concurrently
    // Verify each tenant gets its own resolved policy (no bleeding)
  });

  test('FUZZ-07: tenant A override does not bleed into tenant B', () => {
    // Tenant A: minimumKekBits=128
    // Tenant B: minimumKekBits=256
    // Validate both, verify each gets its own threshold
  });

  test('FUZZ-08: unknown tenant falls back to default (not to another tenant)', () => {
    // Tenants: 'tenant-a' with override, 'tenant-b' with different override
    // Validate 'tenant-c' (unknown) — should get DEFAULT_POLICY, not tenant-a or tenant-b
  });

  test('FUZZ-09: rapid tenant creation and validation cycle', () => {
    // Create engine, validate, create new engine with different tenants, validate
    // Repeat 50 times — verify no state leakage between cycles
  });

  test('FUZZ-10: cross-tenant authorization boundary in ClusterKeyringPrimitiveAuthorization', () => {
    // Set up authorization with tenant-a pool
    // Attempt to authorize with tenant-b request
    // Verify CROSS_TENANT_VIOLATION is thrown
    // Repeat with 50 random tenant pairs
  });
});
```

#### Section 3: Randomized fuzzing with seeded PRNG (5 tests)

```javascript
describe('Randomized fuzzing with seeded PRNG', () => {
  test('FUZZ-11: 1000 random tenant configs — all validate or throw cleanly', () => {
    // Use seeded PRNG (crypto.createHash('sha256').update(seed).digest())
    // Generate 1000 random tenant configs with varied:
    //   - key types (string, number, boolean, null, array, object)
    //   - key names (valid, invalid, special chars)
    //   - nesting depth (0-5)
    // Verify: each validate() either returns true or throws HsmAdapterError
    //         NEVER crashes with TypeError, RangeError, or stack overflow
  });

  test('FUZZ-12: 1000 random tenant IDs — all resolve correctly', () => {
    // Generate 1000 random tenant IDs:
    //   - empty strings, single chars, long strings
    //   - numeric strings, special chars, unicode
    //   - __proto__, constructor, toString, valueOf
    // Verify: each ID resolves to a policy (either tenant-specific or default)
    //         NEVER pollutes Object.prototype or other tenants
  });

  test('FUZZ-13: 1000 random operation+config pairs — all dispatch correctly', () => {
    // Generate 1000 random (operation, config) pairs
    // Operations: mix of valid and invalid operation names
    // Configs: random key-value pairs with varied types
    // Verify: each validate() either returns true or throws HsmAdapterError
    //         NEVER crashes with unhandled exception
  });

  test('FUZZ-14: tenant policy immutability after validation', () => {
    // Create engine with tenant-a policy
    // Validate tenant-a 100 times
    // Verify tenant-a's resolved policy is identical each time (no mutation)
    // Verify DEFAULT_POLICY is not mutated
  });

  test('FUZZ-15: saturation run via parallel-track-runner', async () => {
    // Create a saturation suite file that runs 50 tenant boundary tests
    // Run it via parallel-track-runner with concurrency=4
    // Verify all 50 pass, no cross-process contamination
  });
});
```

### 3b. New file: `server/lib/hsm-adapter/__tests__/tenant-fuzz-harness.cjs`

**Justification:** Shared fuzzing utilities (seeded PRNG, random config
generator, tenant ID generator) used by the saturation test suite. Keeping
these separate from the test file follows the existing pattern of
`parallel-track-runner.cjs` being separate from `parallel-track-runner.test.cjs`.

**Exports:**
```javascript
module.exports = {
  seededRandom,           // Deterministic PRNG from seed string
  generateRandomTenantConfig,   // Random tenant policy override
  generateRandomTenantId,       // Random tenant ID (including edge cases)
  generateRandomOperation,      // Random operation name (valid + invalid)
  generateRandomConfig,         // Random config object for validate()
  verifyNoPrototypePollution,   // Check Object.prototype is clean
  createNTenants,               // Create N tenants with varied policies
};
```

**Key functions:**

```javascript
/**
 * Deterministic PRNG seeded from a string.
 * Uses SHA-256 hash chain for reproducibility.
 * @param {string} seed
 * @returns {function} — call to get next random number [0, 1)
 */
function seededRandom(seed) {
  const crypto = require('crypto');
  let state = crypto.createHash('sha256').update(seed).digest();
  return function() {
    state = crypto.createHash('sha256').update(state).digest();
    return parseInt(state.slice(0, 8).toString('hex'), 16) / 0x100000000;
  };
}

/**
 * Generate a random tenant config with varied types and keys.
 * @param {function} rng — seeded PRNG
 * @returns {object} random tenant config
 */
function generateRandomTenantConfig(rng) {
  // Pick random subset of policy keys
  // Assign random values of varied types
  // Include nested objects for deep-merge blocks
}

/**
 * Generate a random tenant ID including edge cases.
 * @param {function} rng
 * @returns {string} random tenant ID
 */
function generateRandomTenantId(rng) {
  // Mix of: normal strings, empty strings, long strings,
  // numeric strings, special chars, unicode, prototype keys
}

/**
 * Verify Object.prototype is not polluted.
 * @returns {boolean} true if clean
 */
function verifyNoPrototypePollution() {
  return !Object.prototype.polluted &&
         !Object.prototype.minimumKekBits &&
         !Object.prototype.constructor;
}
```

## 4. Fuzzing Matrix Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    Tenant Boundary Fuzzing Matrix            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Section 1: Malicious Schemas (5 tests)                    │
│  ├─ FUZZ-01: Prototype pollution (__proto__, constructor)   │
│  ├─ FUZZ-02: Type confusion (string→number, array→object)   │
│  ├─ FUZZ-03: Null/undefined injection                       │
│  ├─ FUZZ-04: Deep nesting (1000 levels)                    │
│  └─ FUZZ-05: Tenant ID injection (__proto__, toString)     │
│                                                             │
│  Section 2: Cross-Tenant Isolation (5 tests)               │
│  ├─ FUZZ-06: 100 concurrent tenants, conflicting policies  │
│  ├─ FUZZ-07: Tenant A override ≠ Tenant B resolved policy  │
│  ├─ FUZZ-08: Unknown tenant → default (not another tenant)  │
│  ├─ FUZZ-09: 50 rapid create/validate cycles                │
│  └─ FUZZ-10: 50 cross-tenant authorization attempts         │
│                                                             │
│  Section 3: Randomized Fuzzing (5 tests)                    │
│  ├─ FUZZ-11: 1000 random tenant configs — clean throw/pass  │
│  ├─ FUZZ-12: 1000 random tenant IDs — correct resolution    │
│  ├─ FUZZ-13: 1000 random operation+config pairs — dispatch  │
│  ├─ FUZZ-14: Policy immutability after 100 validations      │
│  └─ FUZZ-15: Parallel saturation run (50 suites, 4 workers)│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 5. Files in scope

### New files (2)
- `server/lib/hsm-adapter/__tests__/tenant-boundary-saturation.test.cjs` — 15-test fuzzing matrix
- `server/lib/hsm-adapter/__tests__/tenant-fuzz-harness.cjs` — shared fuzzing utilities

### Extended files (0)
- None — all fuzzing is done via the public `CryptoPolicyEngine` API

### NOT touched
- `crypto-policy-engine.cjs` (read-only — fuzzing tests the existing API)
- `cluster-keyring-primitive-authorization.cjs` (read-only — tests existing CROSS_TENANT_VIOLATION)
- `parallel-track-runner.cjs` (reuse — run saturation suites in parallel)
- No new dependencies

## 6. APIs / routes

No REST API changes. All testing is via the programmatic `CryptoPolicyEngine`
and `ClusterKeyringPrimitiveAuthorization` APIs.

## 7. UI / IDE surfaces

- [ ] Not applicable — backend-only testing

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on new .cjs files | `node -c` on tenant-boundary-saturation.test.cjs, tenant-fuzz-harness.cjs | [ ] |
| L1-02 | ai-platform tests | `cd ai-platform && npm test` | [ ] |
| L1-03 | SimpleBeacon gate (full) | `npx simplebeacon scan --full --gate --format json` | [ ] |
| L1-04 | No secrets in diff | Manual / gate token rules | [ ] |
| L1-05 | Saturation suite passes | `npx jest tenant-boundary-saturation.test.cjs` | [ ] |
| L1-06 | run-all-tracks still passes | `node run-all-tracks.cjs` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Prototype pollution blocked | Inject __proto__ keys in tenant config | Object.prototype not polluted, validate() works | [ ] |
| L2-02 | Type confusion handled | Pass wrong types in tenant config | validate() throws POLICY_VIOLATION_BLOCKED, no crash | [ ] |
| L2-03 | Cross-tenant isolation | 100 tenants with conflicting policies | Each tenant gets own policy, no bleeding | [ ] |
| L2-04 | Unknown tenant fallback | Validate unknown tenant ID | Gets DEFAULT_POLICY, not another tenant's | [ ] |
| L2-05 | Randomized configs clean | 1000 random configs | All throw HsmAdapterError or return true, no crash | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Empty tenant ID | validate('') throws error | [ ] |
| L3-02 | Tenant ID with __proto__ | Does not pollute Object.prototype | [ ] |
| L3-03 | 1000-level deep nesting | No stack overflow | [ ] |
| L3-04 | 50 rapid create/validate cycles | No state leakage between cycles | [ ] |
| L3-05 | Policy immutability | 100 validations don't mutate policy | [ ] |
| L3-06 | Parallel saturation run | 50 suites pass via parallel runner | [ ] |
| L3-07 | Cross-tenant authorization | 50 tenant pairs all throw CROSS_TENANT_VIOLATION | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No credentials / PII in logs or commits | [ ] |
| S-02 | Object.prototype not polluted after fuzzing | [ ] |
| S-03 | No cross-tenant policy bleeding under load | [ ] |
| S-04 | All malicious configs throw HsmAdapterError (not crash) | [ ] |
| S-05 | Tenant ID injection doesn't bypass validation | [ ] |

---

## Error Codes (expected from fuzzing)

| Code | Meaning |
|------|---------|
| POLICY_VIOLATION_BLOCKED | Config violates policy constraints |
| POLICY_LOAD_FAILED | Policy object is invalid |
| CROSS_TENANT_VIOLATION | Cross-tenant authorization attempt blocked |
| UNAUTHORIZED_KEY_ACCESS | Tenant doesn't own the resource |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________

---

## Implementation Notes (for Builder phase)

1. **Follow the Broom Strategy:** 2 new files, 0 extended files, 0 new deps.
2. **Deterministic fuzzing:** Use SHA-256 hash chain PRNG for reproducibility.
3. **No new dependencies:** Use only `crypto` (built-in) for PRNG and hashing.
4. **Test the existing API:** Don't modify `crypto-policy-engine.cjs` — fuzz it as-is.
5. **Verify after each step:** `node -c` after every file change.
6. **Parallel run:** Use `parallel-track-runner.cjs` for FUZZ-15 (50 suites, 4 workers).
7. **Attack vectors:** Model after real-world prototype pollution and type confusion CVEs.
