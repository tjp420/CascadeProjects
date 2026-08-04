# Test Plan: Track 32 Post-Quantum Primitive Foundations

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Track 32 PQC Blinded Threshold Ring-Signature Verification Gating Hub groundwork |
| Author (Builder) | Devin |
| Date | 2026-08-03 |
| Branch | `feat/track32-primitive-groundwork` |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json` *(append Track 32 schema)*
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs` *(add dispatch stub)*
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs` *(register counters)*
- `ai-platform/server/lib/hsm-adapter/__tests__/track32-primitive-groundwork.test.cjs` *(new)*

### APIs / routes

N/A — schema/metrics groundwork only.

### UI / IDE surfaces

None.

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | JSON schema valid | `node -e "JSON.parse(require('fs').readFileSync('ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json','utf8'))"` | [ ] |
| L1-02 | Engine syntax | `node -c ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs` | [ ] |
| L1-03 | Metrics syntax | `node -c ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs` | [ ] |
| L1-04 | Track 32 tests | `cd ai-platform && npx jest track32-primitive-groundwork --coverage=false` | [ ] |
| L1-05 | Parallel orchestrator | `cd ai-platform && npm run test:parallel` | [ ] |
| L1-06 | Full SimpleBeacon gate | `node packages/simplebeacon-cli/bin/simplebeacon.js scan --gate` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Schema includes Track 32 | Load schema | `blindedRingSignatureDigest` and `ringGating` block present | [ ] |
| L2-02 | Engine dispatches `ringGating` | Call `validate` with `ringGating` | Returns `true` | [ ] |
| L2-03 | Metrics registered | Load `hsm-metrics.cjs` | Counters `hsm_ringgate_pool_initialized_total`, `hsm_zk_ring_claim_verified_total`, `hsm_ring_accreditation_completed_total` exist | [ ] |
| L2-04 | Defaults enforced | Build engine with default policy | `minRingSize` 16, `maxRingSize` 128 | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | No new dependencies | Native modules only | [ ] |
| L3-02 | No regression on 107 suites | `npm run test:parallel` passes | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No credentials in code | [ ] |

---

## Approval

- [x] User approved this plan (or task included approved scope)
- Approved by: user  Date: 2026-08-03
