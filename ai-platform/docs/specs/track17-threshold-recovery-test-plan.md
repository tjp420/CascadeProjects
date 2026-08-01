# test_plan.md — Track 17: Threshold Cryptography & Distributed Multi-Party Key Recovery (M-of-N)

> Skeleton for the Validator to review before Builder writes feature code.

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Track 17: Threshold Cryptography & Distributed Multi-Party Key Recovery (M-of-N) |
| Author (Builder) | Devin |
| Date | 2026-08-01 |
| Branch | `feature/track17-groundwork` |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/lib/hsm-adapter/threshold-secret-splitter.cjs` (new — Shamir secret sharing split engine)
- `ai-platform/server/lib/hsm-adapter/threshold-key-recoverer.cjs` (new — Lagrange interpolation reconstruction)
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs` (threshold policy validation)
- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json` (threshold schema)
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs` (optional `splitKey` / `recoverKey` high-level interface)
- `ai-platform/server/lib/hsm-adapter/__tests__/threshold-secret-splitter.test.cjs` (new)
- `ai-platform/server/lib/hsm-adapter/__tests__/threshold-key-recoverer.test.cjs` (new)
- `ai-platform/docs/specs/track17-threshold-recovery-test-plan.md` (this file)

### APIs / interfaces

- `ThresholdSecretSplitter({ prime, maxShards })`
- `ThresholdSecretSplitter.split(secretBuffer, total, threshold, custodianIds)`
- `ThresholdKeyRecoverer({ prime })`
- `ThresholdKeyRecoverer.recover(shards, threshold)`
- `CryptoPolicyEngine.validate(tenantId, 'threshold', { total, threshold })`
- `HsmAdapterError` codes: `INVALID_THRESHOLD`, `INSUFFICIENT_SHARDS`, `SHARD_CUSTODIAN_MISMATCH`

---

## Design decisions

- **Field prime:** Use a 256-bit safe prime `p` documented in the module. All polynomial coefficients and evaluations are reduced modulo `p`. The prime must be larger than any valid 32-byte secret.
- **Secret encoding:** A secret `Buffer` is converted into a BigInt field element. If the secret is longer than the field can hold in one element, it may be split into chunks; for the initial implementation a single 32-byte KEK is the primary target.
- **Shamir construction:** A random degree `threshold - 1` polynomial `f(x)` is generated with `f(0) = secret`. Each shard is a point `(x, y)` where `x` is the 1-indexed custodian index and `y = f(x) mod p`.
- **Custodian binding:** Each shard object includes `custodianId`, `x`, `y` (base64), and `kekId`. Shards are identified by custodian, not by the secret, so losing a shard does not reveal the secret.
- **Reconstruction:** `ThresholdKeyRecoverer` accepts any `M` valid shards, verifies custodian uniqueness, and uses Lagrange interpolation at `x = 0` to recover `f(0) = secret`.
- **Policy enforcement:** `CryptoPolicyEngine` validates `threshold` and `total` against a per-tenant `threshold` policy. Defaults: `minThreshold = 2`, `maxTotal = 7`.
- **Audit events:** `KEY_SHARD_GENERATED` and `KEY_RECONSTRUCTION_SUCCESS` events are emitted through the existing `BaseHsmAdapter._audit` logger.

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on changed `.cjs` files | `node -c <file>` | [ ] |
| L1-02 | Threshold splitter tests pass | `cd ai-platform && npx jest --config jest.config.cjs threshold-secret-splitter` | [ ] |
| L1-03 | Threshold recoverer tests pass | `cd ai-platform && npx jest --config jest.config.cjs threshold-key-recoverer` | [ ] |
| L1-04 | Crypto policy tests still pass with threshold schema | `cd ai-platform && npx jest --config jest.config.cjs crypto-policy-engine` | [ ] |
| L1-05 | Full `ai-platform` test suite passes | `cd ai-platform && npm test` | [ ] |
| L1-06 | SimpleBeacon full gate | `npx simplebeacon scan --full --gate --format json` | [ ] |
| L1-07 | No secrets in diff | `git diff --cached` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Split a 32-byte KEK into 5 shards with threshold 3 | `split(secret, 5, 3, ids)` | Returns 5 shards, none of which reveal the secret alone | [ ] |
| L2-02 | Reconstruct from exactly M shards | `recover(shards.slice(0, 3), 3)` | Returns original secret | [ ] |
| L2-03 | Reconstruct from M+1 shards | `recover(shards, 3)` | Returns original secret | [ ] |
| L2-04 | Reconstruction with duplicate custodian IDs rejected | Provide two shards with same `custodianId` | Throws `SHARD_CUSTODIAN_MISMATCH` | [ ] |
| L2-05 | Policy rejects invalid threshold | `validate(tenant, 'threshold', { total: 2, threshold: 3 })` | Throws `INVALID_THRESHOLD` | [ ] |
| L2-06 | Audit log emits `KEY_SHARD_GENERATED` | Split a key and inspect logger calls | Logger receives `KEY_SHARD_GENERATED` | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Reconstruction with fewer than M shards fails | Throws `INSUFFICIENT_SHARDS` | [ ] |
| L3-02 | Tampered shard y-value yields wrong secret | Recovered value does not equal original | [ ] |
| L3-03 | total = 1, threshold = 1 is allowed for single-custodian backups | Returns one shard equal to secret? (degenerate case) | [ ] |
| L3-04 | Existing Tracks 10–16 tests still pass | No regressions | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | Any `M - 1` or fewer shards leak zero secret bits | [ ] |
| S-02 | Random polynomial coefficients are generated with `crypto.randomBytes` / `randomInt` over the field | [ ] |
| S-03 | Shards never include the raw secret or private key | [ ] |
| S-04 | Reconstruction verifies `y ≡ f(x) (mod p)`? Optional integrity check | [ ] |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________
