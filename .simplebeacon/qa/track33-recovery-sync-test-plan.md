# Track 33: Automated Recovery Re-Syncs & Catch-Up Batch Boundaries — Test Plan

## Objective

Build an automated recovery re-sync layer for dropped or lagging cluster nodes, ensuring they can catch up to the current shard state without introducing split-brain, rollback, or transaction blocking.

## Scope

### Core primitives

- **ShardRecoverySync** — tracks dropped/lagging nodes and schedules catch-up batches.
- **CatchUpBatcher** — groups missing shard sequences into batches bounded by `maxCatchUpBatchSize`.
- **RecoveryBackOff** — exponential back-off bounded by `maxBackOffMs` and `reSyncRetryLimit`.

### Policy schema additions

- `recoverySync`:
  - `maxCatchUpBatchSize`
  - `reSyncRetryLimit`
  - `backoffBaseIntervalMs`
  - `maxBackOffMs`
  - `requireBftCatchUpAck`
  - `allowedCatchUpModes`

## Design notes

### PBFT sliding-window catch-up

Use a **sliding-window batcher** that requests the next `maxCatchUpBatchSize` sequences from a quorum of healthy nodes. Each batch is BFT-acknowledged (`requireBftCatchUpAck`) before the window slides forward. This prevents a lagging node from blocking live transactions because it never needs to replay the full history in one pass and can interleave catch-up with new commits.

### Canonical catch-up request packet

```json
{
  "requestId": "uuid",
  "shardId": "shard-1",
  "fromSequence": 10,
  "toSequence": 73,
  "catchUpMode": "sliding-window",
  "requesterNode": "node-d",
  "timestamp": 1722470400000
}
```

### Telemetry events

- `RECOVERY_SYNC_INITIATED` — lagging node detected and catch-up scheduled.
- `CATCH_UP_BATCH_ACK` — batch verified and accepted.
- `NODE_RECOVERY_SYNCED` — node caught up to current cluster sequence.

## Test checklist

### Positive paths

- [ ] `ShardRecoverySync` detects a lagging node from vector-clock gaps.
- [ ] `CatchUpBatcher` computes batches bounded by `maxCatchUpBatchSize`.
- [ ] `RecoveryBackOff` increments delays up to `maxBackOffMs` and stops at `reSyncRetryLimit`.
- [ ] `CryptoPolicyEngine` validates a compliant `recoverySync` configuration.
- [ ] Telemetry emits `RECOVERY_SYNC_INITIATED`, `CATCH_UP_BATCH_ACK`, `NODE_RECOVERY_SYNCED`.

### Security / edge cases

- [ ] Reject `maxCatchUpBatchSize` exceeding policy.
- [ ] Reject `catchUpMode` not in `allowedCatchUpModes`.
- [ ] Reject catch-up requests that would span uncommitted gaps without BFT ack.
- [ ] Reject requests from non-cluster nodes.
- [ ] Back-off does not exceed `maxBackOffMs`.
- [ ] Recovery does not advance the shard vector clock past the committed cluster sequence.

### Integration

- [ ] `CryptoPolicyEngine` has `_validateRecoverySync` for `operation === 'recoverySync'`.
- [ ] `base-adapter.cjs` emits recovery sync telemetry hooks.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest recovery-sync`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: End-to-end lagging node catch-up with BFT batch acks.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/shard-recovery-sync.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/recovery-sync.test.cjs` *(new)*

## Approval

Pending Validator review.
