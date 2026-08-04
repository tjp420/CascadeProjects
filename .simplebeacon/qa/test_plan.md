# Test Plan: Distributed State Snapshot Checkpoint Utility

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | State snapshot checkpoint utility to freeze, back up, and recover valid node topologies during EPOCH_DRIFT alerts |
| Author (Builder) | Devin |
| Date | 2026-08-03 |
| Branch | `feat/state-snapshot-checkpoint` |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/lib/cluster-keyring-sync.cjs` *(add `createStateSnapshot()`, `restoreStateSnapshot()`, wire into EPOCH_DRIFT handler)*
- `ai-platform/server/lib/hsm-adapter/__tests__/state-snapshot.test.cjs` *(new test suite)*

### APIs / routes

- `createStateSnapshot(reason)` — freezes all cluster state into a serializable checkpoint object
- `restoreStateSnapshot(snapshot)` — restores cluster state from a previously captured snapshot
- `getSnapshotHistory()` — returns list of recent snapshots (metadata only, no sensitive data)
- `clearSnapshotHistory()` — clears snapshot history (for testing/reset)

### UI / IDE surfaces

- [ ] Not applicable — backend only

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on cluster-keyring-sync.cjs | `node -c ai-platform/server/lib/cluster-keyring-sync.cjs` | [ ] |
| L1-02 | Syntax on test file | `node -c ai-platform/server/lib/hsm-adapter/__tests__/state-snapshot.test.cjs` | [ ] |
| L1-03 | State snapshot tests | `cd ai-platform && npx jest state-snapshot --coverage=false` | [ ] |
| L1-04 | Regression: IPC boundary tests | `cd ai-platform && npx jest ipc-boundary --coverage=false` | [ ] |
| L1-05 | Regression: epoch-frame tests | `cd ai-platform && npx jest epoch-frame --coverage=false` | [ ] |
| L1-06 | Regression: DKG gossip tests | `cd ai-platform && npx jest dkg-gossip --coverage=false` | [ ] |
| L1-07 | Regression: track11 integration | `cd ai-platform && npx jest track11-integration --coverage=false` | [ ] |
| L1-08 | SimpleBeacon gate (full) | `npx simplebeacon scan --full --gate --format json` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Snapshot captures full state | Set epoch=5, peerState for 2 peers, peerEpochs, call `createStateSnapshot('manual')` | Snapshot contains `_state`, `_peerState`, `_peerEpochs`, `stek` state, `dkgSession` (if active), `reason`, `timestamp`, `snapshotId` | [ ] |
| L2-02 | Restore recovers state | Create snapshot, mutate state (change epoch, clear peers), call `restoreStateSnapshot(snapshot)` | State matches original snapshot values | [ ] |
| L2-03 | Snapshot triggered on EPOCH_DRIFT | Trigger EPOCH_DRIFT via `_validateIncomingEpoch` with unreconcilable jump | `STATE_SNAPSHOT` event recorded with reason `epoch_drift` | [ ] |
| L2-04 | Snapshot triggered on EPOCH_RECONCILED | Trigger EPOCH_RECONCILED via epoch adoption | `STATE_SNAPSHOT` event recorded with reason `epoch_reconciled` | [ ] |
| L2-05 | Snapshot history tracks metadata | Create 3 snapshots, call `getSnapshotHistory()` | Returns 3 entries with snapshotId, timestamp, reason — no sensitive key material | [ ] |
| L2-06 | DKG session included in snapshot | Init DKG session, create snapshot | Snapshot contains DKG phase, sessionId, nodeId, contributions (serialized), finalized flag | [ ] |
| L2-07 | STEK state included in snapshot | Set STEK, create snapshot | Snapshot contains stekId, retiredSteks count (not raw STEK bytes) | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Snapshot with no active DKG session | `dkgSession` field is `null` in snapshot | [ ] |
| L3-02 | Snapshot with no STEK | `stek` field shows `stekId: null` | [ ] |
| L3-03 | Restore with corrupted snapshot (missing fields) | Throws error, does not partially mutate state | [ ] |
| L3-04 | Restore with wrong snapshotId format | Throws validation error | [ ] |
| L3-05 | Snapshot excludes raw key material | Snapshot does not contain `_keyRing.active` or `_keyRing.previous` Buffer values | [ ] |
| L3-06 | Snapshot history capped at MAX_SNAPSHOTS=10 | Create 15 snapshots, `getSnapshotHistory()` returns 10 | [ ] |
| L3-07 | Clear snapshot history | Call `clearSnapshotHistory()`, `getSnapshotHistory()` returns empty | [ ] |
| L3-08 | Existing cluster sync behavior unaffected | Run full IPC + epoch + DKG test suites | Zero regressions | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No raw key material in snapshots (only fingerprints) | [ ] |
| S-02 | No raw STEK bytes in snapshots (only stekId) | [ ] |
| S-03 | No DKG private shares in snapshots (only public commitments) | [ ] |
| S-04 | Snapshot restore validates schema before applying | [ ] |
| S-05 | Snapshot events recorded in event timeline for audit | [ ] |

---

## New event types

| Event Type | Description |
|------------|-------------|
| `STATE_SNAPSHOT` | Fired when a state snapshot is created (contains reason, snapshotId, timestamp) |
| `STATE_RESTORED` | Fired when state is restored from a snapshot (contains snapshotId, timestamp) |

---

## Implementation notes

- `createStateSnapshot(reason)` will be added to `cluster-keyring-sync.cjs` following the existing pattern of `_recordEvent` + state capture
- Snapshot object structure:
  ```json
  {
    "snapshotId": "snap-<timestamp>-<random>",
    "timestamp": <Date.now()>,
    "reason": "epoch_drift" | "epoch_reconciled" | "manual",
    "state": { "nodeId", "leaderId", "epoch", "activeFingerprint", "previousFingerprint", "rotatedAt" },
    "peerState": { "<peerKey>": { "lastSeen", "leaderId", "activeFingerprint", "previousFingerprint", "rotatedAt" } },
    "peerEpochs": { "<peerKey>": <number> },
    "stek": { "stekId": "<hex>|null", "retiredCount": <number> },
    "dkgSession": { "phase", "sessionId", "nodeId", "finalized", "contributionCount" } | null
  }
  ```
- `restoreStateSnapshot(snapshot)` validates the snapshot schema before applying
- EPOCH_DRIFT handler (line 603) will call `createStateSnapshot('epoch_drift')` before rejecting
- EPOCH_RECONCILED handler (line 628) will call `createStateSnapshot('epoch_reconciled')` after adopting
- Snapshot history capped at 10 entries (ring buffer)
- All snapshots exclude raw key material, STEK bytes, and DKG private shares

---

## Approval

- [ ] User approved this plan
- Approved by: __________  Date: __________
