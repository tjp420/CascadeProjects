# test_plan.md

> Epoch-Frame Verification Hardening — protect against malicious state transitions during
> network re-sharding. Then: KEY_REJECT / ISOLATION_VIOLATION alerting hooks for SIEM visibility.

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Epoch-frame verification hardening + SIEM alerting hooks |
| Author (Builder) | Devin |
| Date | 2026-08-04 |
| Branch | feat/epoch-frame-hardening |
| Packages touched | ai-platform |

## Scope

### Background

The cluster-keyring-sync layer tracks an `epoch` counter in `_state.epoch` that increments on
leader changes, quorum loss, and key rotations. However, the epoch was never validated on
incoming HEARTBEAT or KEY_COMMIT messages — peers could report any epoch without rejection.
The key-rotation-store did not persist epoch state, so a node that restarts begins at epoch 0
regardless of cluster state. This creates attack vectors during network re-sharding where a
malicious node could inject stale or future-epoch messages to confuse cluster state.

### Design

**Part A: Epoch-frame hardening** (cluster-keyring-sync.cjs + key-rotation-store.cjs)

1. **Epoch validation on HEARTBEAT**: Compare `msg.epoch` against `_state.epoch`. If peer epoch
   is lower, record `EPOCH_STALE`. If higher (within threshold), adopt and record
   `EPOCH_DRIFT` + `EPOCH_RECONCILED`.

2. **Epoch validation on KEY_COMMIT**: Reject KEY_COMMIT with `msg.epoch` lower than local
   epoch — prevents replay of stale key commits. Record `KEY_REJECT` with reason `stale_epoch`.

3. **Hard reject unreconcilable jumps**: If peer epoch is >5 ahead (EPOCH_RECONCILE_THRESHOLD),
   reject the message and record `EPOCH_DRIFT` with reason `unreconcilable_jump`.

4. **Epoch persistence in key-rotation-store.cjs**: Add `epoch` field to persisted state. On
   load, restore epoch. This ensures a restarted node doesn't begin at epoch 0.

5. **New event types**: `EPOCH_STALE`, `EPOCH_DRIFT`, `EPOCH_RECONCILED`

**Part B: SIEM alerting hooks** (cluster-keyring-sync.cjs only)

1. **Structured SIEM fields**: Add `siemSeverity`, `siemCategory`, `siemSource` to
   `KEY_REJECT` and `ISOLATION_VIOLATION` event details.

2. **Alerting hook**: `registerSiemHook(callback)` — fires on high-severity events
   (KEY_REJECT, ISOLATION_VIOLATION, EPOCH_DRIFT, SPLIT_BRAIN_DETECTED).

3. **Rate limiting**: SIEM hook calls rate-limited per event type (max 100/min). Excess
   calls dropped silently.

### Files in scope

- `ai-platform/server/lib/cluster-keyring-sync.cjs` — epoch validation, reconciliation, SIEM hooks
- `ai-platform/server/lib/key-rotation-store.cjs` — epoch persistence
- `ai-platform/server/lib/hsm-adapter/__tests__/epoch-frame.test.cjs` — new test file

### APIs

- `registerSiemHook(callback)` — register a SIEM alert callback
- `getEpochState()` — return current epoch, peer epochs, and reconciliation status
- `keyRotationStore.loadState()` — load persisted epoch from disk
- `keyRotationStore.setEpoch(n)` — set epoch directly
- `keyRotationStore.getEpoch()` — get current epoch

---

## Level 1 — Deterministic

| ID | Check | Command | Pass |
|----|-------|---------|------|
| L1-01 | Syntax cluster-keyring-sync | `node -c cluster-keyring-sync.cjs` | [ ] |
| L1-02 | Syntax key-rotation-store | `node -c key-rotation-store.cjs` | [ ] |
| L1-03 | Syntax test file | `node -c epoch-frame.test.cjs` | [ ] |
| L1-04 | Epoch-frame tests | `npx jest epoch-frame.test.cjs` | [ ] |
| L1-05 | Regression dkg-gossip | `npx jest dkg-gossip.test.cjs` | [ ] |
| L1-06 | Regression track11 | `npx jest track11-integration.test.cjs` | [ ] |
| L1-07 | SimpleBeacon gate | `npx simplebeacon scan --full --gate` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Expected | Pass |
|----|----------|----------|------|
| L2-01 | HEARTBEAT with matching epoch | Accepted, no epoch events | [ ] |
| L2-02 | HEARTBEAT with stale epoch | EPOCH_STALE recorded, local unchanged | [ ] |
| L2-03 | HEARTBEAT with higher epoch | EPOCH_DRIFT + EPOCH_RECONCILED, epoch adopted | [ ] |
| L2-04 | KEY_COMMIT with stale epoch | Rejected with KEY_REJECT stale_epoch | [ ] |
| L2-05 | KEY_COMMIT with matching epoch | Accepted, key commit applied | [ ] |
| L2-06 | SIEM hook fires on KEY_REJECT | Hook invoked with siemSeverity high | [ ] |
| L2-07 | SIEM hook fires on ISOLATION_VIOLATION | Hook invoked with siemSeverity critical | [ ] |
| L2-08 | SIEM hook rate limiting | Max 100 calls/min, excess dropped | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Epoch persistence across restart | Epoch restored from persisted state | [ ] |
| L3-02 | Epoch reconciliation after partition | Node adopts higher epoch from peer | [ ] |
| L3-04 | Existing keyring sync unaffected | track11 + dkg-gossip pass | [ ] |
| L3-05 | SIEM hook doesn't fire on info events | LEADER_ELECTED does not trigger hook | [ ] |
| L3-06 | Multiple SIEM hooks | All hooks invoked | [ ] |
| L3-07 | SIEM hook error isolation | Throwing hook doesn't break recording | [ ] |
| L3-08 | Unreconcilable epoch jump >5 | Hard reject, EPOCH_DRIFT unreconcilable_jump | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-02 | Epoch from unknown peers ignored (whitelist first) | [ ] |
| S-03 | Stale-epoch KEY_COMMIT rejected (replay prevention) | [ ] |
| S-04 | Epoch persistence prevents restart-to-epoch-0 downgrade | [ ] |
| S-05 | SIEM hook callbacks cannot throw into event recording | [ ] |
| S-06 | SIEM rate limiting prevents alert storms | [ ] |
| S-07 | Epoch reconciliation only adopts higher (never lower) | [ ] |

---

## Approval

- [x] User approved this plan
- Approved by: user  Date: 2026-08-04
