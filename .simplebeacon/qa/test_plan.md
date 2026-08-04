# Test Plan: Track 31 Post-Quantum Primitive Foundations

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Scaffold Track 31 PQC Homomorphic Database Lookup Gating Hub primitives |
| Author (Builder) | Devin |
| Date | 2026-08-03 |
| Branch | `feat/track31-primitive-groundwork` |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs` *(assumed registry location; create if absent)*

### APIs / routes

N/A — schema and metrics registration groundwork only.

### UI / IDE surfaces

None.

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | JSON syntax on schema | `node -c ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json` | [ ] |
| L1-02 | Syntax on crypto-policy-engine | `node -c ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs` | [ ] |
| L1-03 | Syntax on hsm-metrics | `node -c ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs` | [ ] |
| L1-04 | Track 31 gating tests | `cd ai-platform && npx jest track31` | [ ] |
| L1-05 | Parallel orchestrator | `cd ai-platform && npm run test:parallel` | [ ] |
| L1-06 | Full SimpleBeacon gate | `node packages/simplebeacon-cli/bin/simplebeacon.js scan --gate` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Policy engine recognizes lookup gating | `engine.validate('t1', 'lookupGating', {...})` | No throw | [ ] |
| L2-02 | Metrics registry exposes lookup gate counters | Read `hsm_lookupgate_*` keys | Counters present | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | No changes to existing tracks | Existing tests (30 and prior) pass | [ ] |
| L3-02 | No new modules | Only schema, engine stub, metrics touched | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No credentials / PII in logs or commits | [ ] |
| S-02 | No new dependencies required | [ ] |

---

## Approval

- [x] User approved this plan (or task included approved scope)
- Approved by: user  Date: 2026-08-03
