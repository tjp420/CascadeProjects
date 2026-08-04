# Test Plan: Track 32 Core Gating Hub & ZK Validator

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Track 32 PQC Blinded Threshold Ring-Signature Gating Hub & ZK Ring Claim Validator |
| Author (Builder) | Devin |
| Date | 2026-08-03 |
| Branch | `feat/track32-core-gating` |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/lib/hsm-adapter/pqc-blinded-ring-signature-gating-hub.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-ring-claim-validator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs` *(telemetry hook import)*
- `ai-platform/server/lib/hsm-adapter/__tests__/track32-core-gating.test.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/__tests__/run-all-tracks.cjs` *(registration)*

---

## Level 1 — Deterministic

| ID | Check | Command | Pass |
|----|-------|---------|------|
| L1-01 | Hub syntax | `node -c ai-platform/server/lib/hsm-adapter/pqc-blinded-ring-signature-gating-hub.cjs` | [ ] |
| L1-02 | Validator syntax | `node -c ai-platform/server/lib/hsm-adapter/zk-ring-claim-validator.cjs` | [ ] |
| L1-03 | Track 32 tests | `cd ai-platform && npx jest track32-core-gating --coverage=false` | [ ] |
| L1-04 | Parallel suite | `cd ai-platform && npm run test:parallel` | [ ] |
| L1-05 | SimpleBeacon gate | `node packages/simplebeacon-cli/bin/simplebeacon.js scan --gate` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Hub advances through FSM | `open()` → `collectKeys()` → `validateProof()` → `accredit()` | State transitions to `ACCREDITED` | [ ] |
| L2-02 | Invalid ring size | Validator called with ring of 8 keys | Throws `RINGCLAIM_INVALID_ANONYMITY_SET_SIZE` | [ ] |
| L2-03 | Missing linkability | `requireBlindedLinkabilityAttestation=true`, no linkability | Throws `RINGCLAIM_UNATTESTED_LINKABILITY` | [ ] |
| L2-04 | Telemetry increments | Hub complete flow | Three ring counters increased | [ ] |

---

## Level 3 — Edge cases

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Out-of-order `accredit()` | Throws `RINGGATE_INVALID_TRANSITION` | [ ] |
| L3-02 | Ring too large (200) | Throws `RINGCLAIM_INVALID_ANONYMITY_SET_SIZE` | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No credential material | [ ] |

---

## Approval

- [x] User approved this plan
- Approved by: user  Date: 2026-08-03
