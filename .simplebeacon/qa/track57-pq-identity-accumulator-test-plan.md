# Track 57: Post-Quantum Zero-Knowledge Identity Accumulator Trees — Test Plan

## Objective

Upgrade the network identity topology by combining state accumulators with zero-knowledge membership proofs. Nodes can instantly prove their active authorized status in the decentralized network without exposing their public key, node identifier, or registration history. Track 57 prevents directory profiling attacks by providing anonymous, non-interactive membership attestations over dynamically updated post-quantum identity registries. Building on Track 29 ZK-rollup accumulator, Track 41 enclave attestation, and Track 51 PQC identity hubs.

## Scope

### Core primitives

- **PqIdentityAccumulator** — asynchronous tree-state processor that hashes post-quantum public keys into an immutable cryptographic root while supporting real-time membership additions and state updates.
- **ZkMembershipProofProcessor** — succinct proof validator that verifies zero-knowledge membership and non-membership proofs against the active root hash without disclosing individual parameters.
- **Accumulator State Telemetry** — emits `IDENTITY_ACCUMULATOR_UPDATED` and `ZK_MEMBERSHIP_CLAIM_VALIDATED` into the Track 29 ZK-rollup accumulator.

### Canonical accumulator root update payload wire layout

```
ACCUM:<rootUpdateId>:<sourceTenantId>:<rootHash>:<treeDepth>:<memberCount>:<epochSeconds>:<attestationHash>:<committeeSignature>
```

### Canonical membership proof payload wire layout

```
MEMPROOF:<proofId>:<rootHashReference>:<membershipProofSystem>:<claimType>:<proofHash>:<attestationHash>:<verifierSignature>
```

### Policy schema additions

- `pqIdentityAccumulator`:
  - `maxTreeDepth`: 20
  - `allowedMembershipProofSystems`: `["groth16", "plonk", "marlin"]`
  - `mandatoryUpdateEpochSeconds`: 3600
  - `requireRootUpdateAttestation`: true
  - `requireMembershipProofAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banMalformedMembershipPeers`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All cryptographic threshold counts, epoch validation windows, and tree depth constraints are managed dynamically via the dedicated `pqIdentityAccumulator` stanza in the active `CryptoPolicyEngine` schema.
- Both root update submissions and membership proof contracts must pass `EnclaveAttestationClient.verify()` before being accepted (Track 41 integration).
- The `PqIdentityAccumulator` hashes post-quantum public keys into a Merkle-style root using SHA-256 over sorted leaf hashes, supporting real-time membership additions and state updates.
- The `ZkMembershipProofProcessor` validates zero-knowledge membership and non-membership proofs against the active root hash without revealing which leaf a node occupies.
- Peers broadcasting malformed zero-knowledge membership proofs are automatically banned when `banMalformedMembershipPeers` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `PqIdentityAccumulator` adds a member and emits `IDENTITY_ACCUMULATOR_UPDATED` with a new root hash.
- [ ] `PqIdentityAccumulator` supports real-time state updates within the mandatory epoch window.
- [ ] `ZkMembershipProofProcessor` validates a valid membership proof and emits `ZK_MEMBERSHIP_CLAIM_VALIDATED`.
- [ ] `ZkMembershipProofProcessor` validates a valid non-membership proof.
- [ ] `CryptoPolicyEngine` validates a compliant `pqIdentityAccumulator` configuration.

### Security / edge cases

- [ ] Reject tree depth exceeding `maxTreeDepth`.
- [ ] Reject membership proof system not in `allowedMembershipProofSystems`.
- [ ] Reject update epoch below `mandatoryUpdateEpochSeconds`.
- [ ] Reject un-attested root update submissions.
- [ ] Reject un-attested membership proof contracts.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Automatically ban peers broadcasting malformed membership proofs.
- [ ] Reject a payload that does not follow the canonical layout.
- [ ] Reject a membership proof referencing an unknown root hash.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqIdentityAccumulator` for `operation === 'pqIdentityAccumulator'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pq-identity-accumulator` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pq-identity-accumulator`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a three-node committee root update with attested submitters, verify membership proof validation against the new root.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pq-identity-accumulator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-membership-proof-processor.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-identity-accumulator.test.cjs` *(new)*

## Approval

Pending Validator review.
