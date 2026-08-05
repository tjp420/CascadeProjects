# Test Plan: Track 113 — Rotation Scheduler for Hybrid Identity Ratchet

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | In-memory rotation scheduler: message count + time thresholds, pre-rotation warning, and explicit `QUANTUM_ROTATE_PENDING` event. |
| Author (Builder) | Devin |
| Date | 2026-08-05 |
| Branch | feat/track113-pqc-ratchet-migration |
| Packages touched | ai-platform/server/lib/crypto/ratchet |

## Scope

### Files in scope

- `ai-platform/server/lib/crypto/ratchet/identity-ratchet.cjs`
- `ai-platform/server/lib/crypto/ratchet/__tests__/identity-ratchet.test.cjs`

### Out of scope

- Shared-state / Redis epoch coordination
- UI/IDE surfaces
- New npm dependencies

---

## Level 1 — Deterministic

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on changed CJS | `node -c` on changed files | [ ] |
| L1-02 | Identity ratchet tests | `npx jest identity-ratchet` | [ ] |
| L1-03 | No secrets in diff | manual review | [ ] |

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Message-count rotation | Step the ratchet `maxMessages` times | A `QUANTUM_ROTATE_REQUIRED` event fires and the chain is re-initialized | [ ] |
| L2-02 | Time-based rotation | Wait `maxDurationMs` (use stub clock) | Rotation fires after threshold | [ ] |
| L2-03 | Pre-rotation warning | Step to 80% of `maxMessages` | `QUANTUM_ROTATE_PENDING` fires once | [ ] |
| L2-04 | No double warning | Continue stepping | `QUANTUM_ROTATE_PENDING` emitted only once | [ ] |
| L2-05 | Manual rotation | Call `rotateNow()` | New chain key is generated and `IDENTITY_RATCHET_ROTATED` fired | [ ] |

## Level 3 — Edge cases & reflection

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Rotation before initialization | Call `rotateNow()` without `encapsulate/decapsulate` | Throws `IDENTITY_RATCHET_NOT_INITIALIZED` | [ ] |
| L3-02 | Warning threshold not triggered | Step only to 79% | No pending warning | [ ] |
| L3-03 | Timer cleanup | Call `close()` | Pending timeouts cleared | [ ] |

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No raw private keys logged on rotation | [ ] |
| S-02 | Rotation does not reuse previous chain key | [ ] |

## Approval

- [ ] User approved this plan
- Approved by: __________  Date: __________
