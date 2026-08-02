# Track 42: Quantum-Safe Dynamic Group Resharding & Ephemeral Key-State Ratcheting — Test Plan

## Objective

Enable real-time threshold committee scaling (e.g., 3-of-5 to 5-of-7) without exposing historical shares or resetting master secrets. Provide post-quantum forward-secure share ratcheting on each epoch change.

## Scope

### Core primitives

- **GroupReshardEngine** — polynomial interpolation/expansion over changed node configurations; computes Lagrangian coefficient vectors.
- **EphemeralShareRatchet** — post-quantum forward-secure ratchet that advances each node's inner randomness at every epoch.
- **ReshardingPolicy** — enforce maximum resharding bounds, required attestation for new nodes, and allowed threshold windows.

### Policy schema additions

- `resharding`:
  - `allowedThresholdWindows`: `[[2,3], [3,5], [5,7]]`
  - `maxCommitteeExpansionFactor`: `2.0`
  - `maxCommitteeSize`: `11`
  - `requireNewNodeAttestation`: `true`
  - `allowedAttestationAuthorities`: `['mock-authority']`
  - `requireEphemeralRatchet`: `true`
  - `minEpochIntervalMs`: `1000`

## Design decisions

- Resharding is initiated by a consensus checkpoint and produces a signed resharding commitment.
- New incoming nodes must pass `EnclaveAttestationClient.verify()` before share distribution (Track 41 integration).
- Ephemeral share ratchet uses SHA-3 256 (shake256) and ML-KEM encapsulated randomness increments.
- Lagrangian coefficient derivation:
  - For a set of participant indices `S` and target index `j`, the coefficient at `j` is computed via the Lagrange interpolation formula evaluated over the finite field modulo a large safe prime (or over the scalar field of the active curve).
  - Expansion: old shares are combined with fresh additive shares that sum to zero to preserve the master secret.
  - Contraction: excess shares are dropped, and remaining shares are re-randomized using the ephemeral ratchet.

## Test checklist

### Positive paths

- [ ] `GroupReshardEngine` expands a 3-of-5 committee to a 5-of-7 committee without changing the master secret.
- [ ] `GroupReshardEngine` contracts a 5-of-7 committee back to 3-of-5.
- [ ] `EphemeralShareRatchet` advances a node's share to a new epoch and demonstrates old epoch material is not recoverable.
- [ ] `CryptoPolicyEngine` validates a compliant `resharding` configuration.
- [ ] `base-adapter.cjs` emits `COMMITTEE_RESHARDING_INITIATED` and `EPHEMERAL_SHARE_RATCHETED` telemetry events.

### Security / edge cases

- [ ] Reject a threshold window not in `allowedThresholdWindows`.
- [ ] Reject a committee size above `maxCommitteeSize`.
- [ ] Reject an expansion factor above `maxCommitteeExpansionFactor`.
- [ ] Reject a resharding operation when `requireNewNodeAttestation` is true and a new node lacks attestation.
- [ ] Reject an epoch interval below `minEpochIntervalMs`.
- [ ] Reject `requireEphemeralRatchet` being disabled when required.

### Integration

- [ ] `CryptoPolicyEngine` has `_validateResharding` for `operation === 'resharding'`.
- [ ] `EnclaveAttestationClient` is invoked by `GroupReshardEngine` for new nodes.
- [ ] Master track runner passes `dynamic-resharding` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest dynamic-resharding`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a full 3-of-5 → 5-of-7 expansion and verify secret reconstruction.
- **L3 Reflection**: Spec alignment, no ghost finite field libraries, minimal dependencies.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/group-reshard-engine.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/ephemeral-share-ratchet.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/dynamic-resharding.test.cjs` *(new)*

## Approval

Pending Validator review.
