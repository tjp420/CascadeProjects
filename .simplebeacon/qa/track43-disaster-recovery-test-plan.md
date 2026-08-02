# Track 43B: Decentralized Multi-Region Disaster Recovery Fallback Matrix — Test Plan

## Objective

Prevent transaction starvation during total regional drop-offs by orchestrating decentralized, quorum-backed recovery transitions to emergency standby zones. Build on Track 34/35 cross-cluster migration and reconciliation to reconstruct critical KEK rings without central points of failure.

## Scope

### Core primitives

- **ClusterDisasterRecoveryCoordinator** — tracks cross-region heartbeats, declares regional blackouts by BFT majority, and shifts share weights to standby nodes.
- **CrossRegionStateReconstructor** — aggregates surviving cluster shares via Track 35 reconciliation and reconstructs operational KEK rings.
- **DisasterRecoveryTelemetry** — emits `REGIONAL_FAILOVER_INITIATED` and `STANDBY_CLUSTER_PROVISIONED` into the Track 29 ZK-rollup accumulator.

### Policy schema additions

- `disasterRecovery`:
  - `maxCrossRegionHeartbeatLatencyMs`: 5000
  - `minFailoverQuorumNodes`: 3
  - `allowedFailoverModes`: `["bft-vote", "operator-override"]`
  - `requireStandbyAttestation`: true
  - `allowedStandbyAuthorities`: `["mock-authority"]`
  - `maxStateReconstructionAgeSeconds`: 60
  - `requireByzantineFaultProofs`: true
  - `minSurvivingRegions`: 2

## Design decisions

- Cross-region heartbeats are sampled every `heartbeatIntervalMs` (Track 40 consensus).
- A region is declared failed when a BFT majority of monitoring nodes observe a heartbeat timeout beyond `maxCrossRegionHeartbeatLatencyMs`.
- Standby nodes must pass `EnclaveAttestationClient.verify()` before state reconstruction (Track 41 integration).
- State reconstruction uses Track 35 `reconciliation-digest` and `cluster-reconciler` to pull and verify surviving shares.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.
- Byzantine fault boundaries: tolerate up to `f` faulty monitoring nodes where `n = 3f + 1`; quorum is `2f + 1`.

## Test checklist

### Positive paths

- [ ] `ClusterDisasterRecoveryCoordinator` detects a region timeout and initiates a BFT-vote failover.
- [ ] `ClusterDisasterRecoveryCoordinator` reaches failover quorum with `minFailoverQuorumNodes` votes.
- [ ] `CrossRegionStateReconstructor` aggregates shares from surviving regions and reconstructs a KEK ring.
- [ ] `CryptoPolicyEngine` validates a compliant `disasterRecovery` configuration.
- [ ] `base-adapter.cjs` emits `REGIONAL_FAILOVER_INITIATED` and `STANDBY_CLUSTER_PROVISIONED`.
- [ ] `ZkRollupAccumulator` ingests `REGIONAL_FAILOVER_INITIATED` events.

### Security / edge cases

- [ ] Reject a failover without `minFailoverQuorumNodes` agreeing votes.
- [ ] Reject a `failoverMode` not in `allowedFailoverModes`.
- [ ] Reject state reconstruction when a standby node lacks attestation and `requireStandbyAttestation` is true.
- [ ] Reject reconstruction when surviving regions are below `minSurvivingRegions`.
- [ ] Reject state older than `maxStateReconstructionAgeSeconds`.
- [ ] Reject disabling `requireByzantineFaultProofs` when required.

### Integration

- [ ] `CryptoPolicyEngine` has `_validateDisasterRecovery` for `operation === 'disasterRecovery'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `disaster-recovery` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest disaster-recovery`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a 3-region cluster losing one region and failing over to a standby.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/cluster-disaster-recovery-coordinator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/cross-region-state-reconstructor.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/disaster-recovery.test.cjs` *(new)*

## Approval

Pending Validator review.
