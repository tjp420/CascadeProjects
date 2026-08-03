# Track 51: Multi-Party Post-Quantum KEM Network Identity Hubs — Test Plan

## Objective

Evolve the platform's localized identity management into a completely decentralized, post-quantum network identity infrastructure, eliminating central registry points of failure. Build on Track 30 PQC identity ratchets and Track 41 hardware enclave attestation.

## Scope

### Core primitives

- **PqcIdentityHubRouter** — processes network identity updates using post-quantum key encapsulation mechanisms (ML-KEM-1024) and synchronizes peer identity state across the decentralized registry.
- **ThresholdIdentityIssuer** — requires an active M-of-N threshold committee signature approval before validating or altering a network entity's identity status.
- **HubRoutingTelemetry** — emits `PQC_IDENTITY_HUB_REGISTERED` and `IDENTITY_ISSUANCE_QUORUM_COMMITTED` into the Track 29 ZK-rollup accumulator.

### Canonical network identity block payload layout

```
IDENTITY:<entityId>:<kemPublicKeyHash>:<committeeSignatures...>:<registrationEpoch>:<attestationHash>:<hubRouterSignature>
```

### Policy schema additions

- `pqcIdentityHub`:
  - `minIssuanceQuorum`: 3
  - `maxCommitteeSize`: 10
  - `kemAlgorithm`: `ML-KEM-1024`
  - `requireHostAttestation`: true
  - `requireCommitteeAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `maxIdentityAgeSeconds`: 86400
  - `banUnattestedPeers`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- Both the registering host and all issuing committee nodes must pass `EnclaveAttestationClient.verify()` before an identity change can be broadcast (Track 41 integration).
- The `PqcIdentityHubRouter` encapsulates peer identity updates using ML-KEM-1024 key pairs, rejecting any identity package whose KEM algorithm does not match policy.
- The `ThresholdIdentityIssuer` collects committee signatures and only commits an identity change once the M-of-N quorum is reached.
- Peers broadcasting un-attested identity packages are automatically banned when `banUnattestedPeers` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `PqcIdentityHubRouter` registers a new network identity and emits `PQC_IDENTITY_HUB_REGISTERED`.
- [ ] `ThresholdIdentityIssuer` reaches quorum and commits an identity issuance, emitting `IDENTITY_ISSUANCE_QUORUM_COMMITTED`.
- [ ] `CryptoPolicyEngine` validates a compliant `pqcIdentityHub` configuration.
- [ ] `base-adapter.cjs` emits `PQC_IDENTITY_HUB_REGISTERED` and `IDENTITY_ISSUANCE_QUORUM_COMMITTED`.
- [ ] `ZkRollupAccumulator` ingests `PQC_IDENTITY_HUB_REGISTERED` events.

### Security / edge cases

- [ ] Reject identity registration from un-attested host.
- [ ] Reject committee signatures from un-attested committee nodes.
- [ ] Reject identity issuance without `minIssuanceQuorum` signatures.
- [ ] Reject KEM algorithm not matching policy (`kemAlgorithm`).
- [ ] Reject identity packages exceeding `maxIdentityAgeSeconds`.
- [ ] Auto-ban peers broadcasting un-attested identity packages when `banUnattestedPeers` is true.
- [ ] Reject committee size exceeding `maxCommitteeSize`.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqcIdentityHub` for `operation === 'pqcIdentityHub'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pqc-identity-hub` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pqc-identity-hub`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a three-node committee identity issuance with attested host and verify quorum commit.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-identity-hub-router.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/threshold-identity-issuer.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pqc-identity-hub.test.cjs` *(new)*

## Approval

Pending Validator review.
