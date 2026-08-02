# Track 53: Cross-Platform Homomorphic Secret Key Sharding Protocols — Test Plan

## Objective

Build a cross-platform shard distributor that allows a local threshold committee to shard a secret key homomorphically and distribute those pieces across separate runtime platforms without ever reconstructing or exposing the full key material outside the physical hardware enclave boundaries. Building on Track 46 homomorphic computation and Track 48 cross-platform PQC asset bridges.

## Scope

### Core primitives

- **HomomorphicKeyShardDisperser** — performs math blinding weights over secret key components, distributing them securely to target platforms using post-quantum KEM wrappers.
- **MultiPlatformShardCombiner** — allows independent external environments to collectively aggregate and evaluate operations directly on their pieces without reconstructing the original key.
- **ShardingInteroperabilityTelemetry** — emits `HOMOMORPHIC_SHARD_DISPERSED` and `CROSS_PLATFORM_COMBINER_VERIFIED` into the Track 29 ZK-rollup accumulator.

### Canonical cross-platform shard payload layout

```
SHARD:<shardId>:<sourcePlatformId>:<destinationPlatformId>:<blindWeightHash>:<kemWrapKeyHash>:<dispersalEpoch>:<attestationHash>:<disperserSignature>
```

### Policy schema additions

- `homomorphicKeySharding`:
  - `minTargetPlatformQuorum`: 3
  - `maxShardDepth`: 8
  - `signatureTimeoutSeconds`: 300
  - `requireLocalNodeAttestation`: true
  - `requireDestinationAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `kemAlgorithm`: `ML-KEM-1024`
  - `isolateLowQuorumDestinations`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- Both the local dispersing node and all destination platform receivers must pass `EnclaveAttestationClient.verify()` before shard distribution can begin (Track 41 integration).
- The `HomomorphicKeyShardDisperser` applies Pedersen-style blinding weights to each key shard, wraps each blinded shard with ML-KEM-1024, and emits one dispersal event per destination.
- The `MultiPlatformShardCombiner` aggregates shard evaluations from independent platforms and verifies the combined result matches the expected homomorphic evaluation without ever reconstructing the original key.
- Destination hubs that drop below `minTargetPlatformQuorum` are auto-isolated when `isolateLowQuorumDestinations` is true.
- Shards exceeding `maxShardDepth` are rejected at dispersal time.
- Signatures older than `signatureTimeoutSeconds` are rejected at combination time.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `HomomorphicKeyShardDisperser` disperses shards to multiple platforms and emits `HOMOMORPHIC_SHARD_DISPERSED`.
- [ ] `MultiPlatformShardCombiner` aggregates shard evaluations and emits `CROSS_PLATFORM_COMBINER_VERIFIED`.
- [ ] `CryptoPolicyEngine` validates a compliant `homomorphicKeySharding` configuration.
- [ ] `base-adapter.cjs` emits `HOMOMORPHIC_SHARD_DISPERSED` and `CROSS_PLATFORM_COMBINER_VERIFIED`.
- [ ] `ZkRollupAccumulator` ingests `HOMOMORPHIC_SHARD_DISPERSED` events.

### Security / edge cases

- [ ] Reject dispersal without `minTargetPlatformQuorum` destination platforms.
- [ ] Reject un-attested local dispersing node.
- [ ] Reject un-attested destination platform receiver.
- [ ] Reject shards exceeding `maxShardDepth`.
- [ ] Reject KEM algorithm not matching policy (`kemAlgorithm`).
- [ ] Reject combination signatures older than `signatureTimeoutSeconds`.
- [ ] Auto-isolate destination hubs below `minTargetPlatformQuorum` when `isolateLowQuorumDestinations` is true.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validateHomomorphicKeySharding` for `operation === 'homomorphicKeySharding'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `homomorphic-key-sharding` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest homomorphic-key-sharding`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a three-platform shard dispersal with attested local node and verify the combined evaluation.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/homomorphic-key-shard-disperser.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/multi-platform-shard-combiner.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/homomorphic-key-sharding.test.cjs` *(new)*

## Approval

Pending Validator review.
