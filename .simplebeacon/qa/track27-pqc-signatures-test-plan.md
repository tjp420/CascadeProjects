# Track 27: Post-Quantum Threshold Signatures & Quantum-Resistant Group Consensus — Test Plan

## Objective

Extend the Track 26 DKG group into a fully decentralized, quantum-safe operational signing layer. This track implements threshold post-quantum signing primitives that allow a group of nodes to collectively sign messages without any single node holding the complete private key.

## Scope

### Core primitives

- `PqcThresholdSigner` — generates individual partial signatures using a selected post-quantum scheme (ML-DSA/Dilithium or FN-DSA/Falcon rules).
- `SignatureShareAggregator` — collects partial signature shares, validates them, and combines them into a single group signature.
- `PqcGroupSignature` — canonical payload structure for the aggregated signature, public group key, and signed message digest.
- `PqcTelemetry` — emits `PQC_SIGNATURE_SHARE_VERIFIED` and `PQC_GROUP_SIGNATURE_FINALIZED` events.

### Policy schema additions

- `pqc.thresholdSignature`:
  - `allowedSchemes`: list of approved PQC signature algorithms.
  - `minThreshold`: minimum number of shares required.
  - `minSignatureSizeBytes`: minimum byte size for final signatures.
  - `maxPartialShares`: upper bound on participating signers.
  - `requireShareVerification`: require commitment-based share validation.
  - `requireGroupPublicKeyAttestation`: require attestation of the group public key.

## Test checklist

### Positive paths

- [ ] 3-node group produces a valid partial signature for each node.
- [ ] `SignatureShareAggregator` combines `minThreshold` partial signatures into a `PqcGroupSignature`.
- [ ] Aggregated group signature verifies against the group public key.
- [ ] `PQC_SIGNATURE_SHARE_VERIFIED` telemetry is emitted for every accepted partial signature.
- [ ] `PQC_GROUP_SIGNATURE_FINALIZED` telemetry is emitted when aggregation completes.
- [ ] `CryptoPolicyEngine` validates `pqc.thresholdSignature` configurations.

### Security / edge cases

- [ ] Reject partial signatures generated with an unauthorized scheme.
- [ ] Reject aggregation with fewer than `minThreshold` shares.
- [ ] Reject partial signatures from nodes not in the DKG group.
- [ ] Reject group signatures below `minSignatureSizeBytes`.
- [ ] Detect and reject duplicate or tampered partial signature shares.
- [ ] Reject signing when `requireGroupPublicKeyAttestation` is true and no attestation is provided.

### Integration

- [ ] `PqcThresholdSigner` accepts DKG-derived shares from Track 26.
- [ ] `base-adapter.cjs` emits PQC telemetry via the Track 10 audit pipeline.
- [ ] `CryptoPolicyEngine` blocks PQC threshold signing with insufficient policy.

## Level mapping

- **L1 Deterministic**: `node -c` on all new `.cjs` files, `npx jest pqc-threshold`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: 5-node threshold signing round-trip with `ml-dsa-65` simulation.
- **L3 Reflection**: Spec alignment with Track 26 DKG, no ghost modules, minimal file count.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-threshold-signer.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/signature-share-aggregator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/pqc-group-signature.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`

## Approval

Pending Validator review.
