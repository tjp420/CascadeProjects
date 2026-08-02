# Track 32: Distributed Key-Sharding Cross-Node Sync Protocols — Test Plan

## Objective

Build a resilient, BFT-backed shard synchronization layer that keeps threshold secret shares consistent across independent nodes while preventing split-brain and rollback attacks.

## Scope

### Core primitives

- **ShardVectorClock** — monotonic logical sequence tracker per shard. Nodes reject packets with `sequence <= local`.
- **KeyShardSyncOrchestrator** — BFT-style coordinator that gathers signed sync proposals from cluster nodes and commits once `minClusterQuorum` valid responses agree.
- **SyncPacket** — canonical payload for cross-node shard sync.

### Policy schema additions

- `shardSync`:
  - `minClusterQuorum`
  - `maxAllowedDriftMs`
  - `maxSyncRetryAttempts`
  - `requireBftValidation`
  - `allowedConsensusModes`
  - `maxInFlightProposals`

## Canonical synchronization packet layout

```json
{
  "packetId": "uuid",
  "shardId": "shard-123",
  "sequence": 42,
  "payloadHash": "sha256-of-encrypted-share-blob",
  "timestamp": 1722470400000,
  "originNode": "node-a",
  "proposedBy": ["node-a", "node-b", "node-c"],
  "consensusMode": "pbft"
}
```

Each participating node signs the canonical string:

```
{packetId}|{shardId}|{sequence}|{payloadHash}|{timestamp}|{originNode}|{nodeId}
```

Responses are `{nodeId, signature}` arrays.

## Test checklist

### Positive paths

- [ ] `ShardVectorClock` increments and compares monotonic sequences.
- [ ] `KeyShardSyncOrchestrator` commits a sync proposal with `minClusterQuorum` valid node signatures.
- [ ] `SyncPacket` sequence greater than local is accepted.
- [ ] `CryptoPolicyEngine` validates a compliant `shardSync` configuration.
- [ ] Telemetry emits `SHARD_SYNC_INITIATED` and `NODE_CONSENSUS_COMMITTED`.

### Security / edge cases

- [ ] Reject packet with `sequence <= local` (rollback protection).
- [ ] Reject packet older than `maxAllowedDriftMs`.
- [ ] Reject proposal below `minClusterQuorum`.
- [ ] Reject unauthorized consensus mode.
- [ ] Reject signatures from non-cluster nodes.
- [ ] Reject duplicate node signatures.
- [ ] Reject more than `maxInFlightProposals` active syncs.

### Integration

- [ ] `CryptoPolicyEngine` has `_validateShardSync` for `operation === 'shardSync'`.
- [ ] `base-adapter.cjs` emits `SHARD_SYNC_INITIATED` and `NODE_CONSENSUS_COMMITTED`.

## Level mapping

- **L1 Deterministic**: `node -c` on new `.cjs` files, `npx jest shard-sync`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Multi-node sync proposal with monotonic vector clock end-to-end.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/shard-vector-clock.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/key-shard-sync-orchestrator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/shard-sync.test.cjs` *(new)*

## Approval

Pending Validator review.
