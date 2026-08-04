# Test Plan: Track 33 Post-Quantum Primitive Foundations

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Track 33 PQC Direct Accumulator Membership Proof Gating Hub groundwork |
| Author (Builder) | Devin |
| Date | 2026-08-03 |
| Branch | `feat/track33-primitive-groundwork` |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json` *(append Track 33 schema)*
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs` *(add dispatch stub)*
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs` *(register counters)*
- `ai-platform/server/lib/hsm-adapter/__tests__/track33-primitive-groundwork.test.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/__tests__/run-all-tracks.cjs` *(registration)*

---

## Level 1 — Deterministic

| ID | Check | Command | Pass |
|----|-------|---------|------|
| L1-01 | JSON schema valid | `node -e "JSON.parse(require('fs').readFileSync('ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json','utf8'))"` | [ ] |
| L1-02 | Engine syntax | `node -c ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs` | [ ] |
| L1-03 | Metrics syntax | `node -c ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs` | [ ] |
| L1-04 | Track 33 tests | `cd ai-platform && npx jest track33-primitive-groundwork --coverage=false` | [ ] |
| L1-05 | Parallel suite | `cd ai-platform && npm run test:parallel` | [ ] |
| L1-06 | SimpleBeacon gate | `node packages/simplebeacon-cli/bin/simplebeacon.js scan --gate` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Schema includes Track 33 | Load schema | `accumulatorGating` block present | [ ] |
| L2-02 | Engine dispatches `accumulatorGating` | Call `validate` with `accumulatorGating` | Returns `true` | [ ] |
| L2-03 | Metrics registered | Load `hsm-metrics.cjs` | Counters `hsm_accumulatorgate_*` exist | [ ] |
| L2-04 | Defaults enforced | Build engine with default policy | `maxAccumulatorSize` 65536, `minWitnessQuorum` 8 | [ ] |

---

## Approval

- [x] User approved this plan
- Approved by: user  Date: 2026-08-03
