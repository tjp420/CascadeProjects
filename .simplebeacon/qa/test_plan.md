# Test Plan: Track 31 Core Gating Hub & ZK Validator

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Implement Track 31 hub state machine and ZK lookup claim validator |
| Author (Builder) | Devin |
| Date | 2026-08-03 |
| Branch | `feat/track31-core-gating` |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/lib/hsm-adapter/pqc-homomorphic-lookup-gating-hub.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-lookup-claim-validator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/__tests__/track31-lookup-gating.test.cjs` *(extend)*
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs` *(telemetry integration if needed)*

### APIs / routes

N/A — internal adapter layer.

### UI / IDE surfaces

None.

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on hub | `node -c ai-platform/server/lib/hsm-adapter/pqc-homomorphic-lookup-gating-hub.cjs` | [ ] |
| L1-02 | Syntax on validator | `node -c ai-platform/server/lib/hsm-adapter/zk-lookup-claim-validator.cjs` | [ ] |
| L1-03 | Syntax on test | `node -c ai-platform/server/lib/hsm-adapter/__tests__/track31-lookup-gating.test.cjs` | [ ] |
| L1-04 | Track 31 tests | `cd ai-platform && npx jest track31-lookup-gating --coverage=false` | [ ] |
| L1-05 | Parallel orchestrator | `cd ai-platform && npm run test:parallel` | [ ] |
| L1-06 | Full SimpleBeacon gate | `node packages/simplebeacon-cli/bin/simplebeacon.js scan --gate` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Valid query advances through state machine | `createPool` → `submitQuery` → `validateProof` → `accredit` | State ends `ACCREDITED` | [ ] |
| L2-02 | Telemetry counters increment | Hub methods invoked | Counter values increase | [ ] |
| L2-03 | Out-of-order transition blocked | `accredit` before `validateProof` | Throws `LOOKUPGATE_INVALID_STATE` | [ ] |
| L2-04 | Validator rejects low quorum | quorum < 12 | Throws `LOOKUPCLAIM_QUORUM_TOO_LOW` | [ ] |
| L2-05 | Validator rejects deep query tree | depth > 32 | Throws `LOOKUPCLAIM_MAX_DEPTH_EXCEEDED` | [ ] |
| L2-06 | Validator rejects unattested query | attestation false, required | Throws `LOOKUPCLAIM_UNATTESTED_QUERY` | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | No state mutation on failed transition | Invalid transition leaves pool in original state | [ ] |
| L3-02 | Repeat validation idempotent | Second `validateProof` on accredited pool is no-op or safe | [ ] |
| L3-03 | No new dependencies | Native crypto + existing big-integer only | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No credentials / PII in logs or commits | [ ] |
| S-02 | Error codes use isolated LOOKUPGATE/LOOKUPCLAIM prefixes | [ ] |

---

## Approval

- [x] User approved this plan (or task included approved scope)
- Approved by: user  Date: 2026-08-03
