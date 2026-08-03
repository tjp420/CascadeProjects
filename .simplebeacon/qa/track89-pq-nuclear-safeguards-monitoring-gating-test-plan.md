# Track 89: Post-Quantum Zero-Knowledge Cross-Chain Multi-Party Decentralized Nuclear Safeguards Monitoring and Facility Verification Gating Matrix — Test Plan

## Objective

Establish a privacy-preserving decentralized nuclear safeguards monitoring and facility verification gating layer that scales cross-chain. Track 89 enforces non-repudiable IAEA safeguards authority endpoint attestation boundaries across shared networks while completely preventing reactor telemetry stream profiling and inspector identity harvesting loops. Combines lattice-based threshold ring signatures with homomorphically split Pedersen commitments over reactor telemetry hashes, inspection report digests, and facility identity hashes. This architecture enables IAEA inspectors, national regulatory authorities, and facility operators to verify hidden safeguards claims (inspection threshold bounds, facility quorum metrics, safeguards accreditation status) via non-interactive zero-knowledge range proofs without exposing raw inspection reports, facility configurations, or inspector identities.

## Scope

### Core primitives

- **PqcNuclearSafeguardsMonitoringGatingHub** — interlocking IAEA safeguards authority endpoint coordinator that instantiates multi-party safeguards verification pools using homomorphically split Pedersen commitments over reactor telemetry hashes, inspection report digests, and facility identity hashes.
- **ZkSafeguardsClaimValidator** — succinct safeguards claim verifier that processes non-interactive zero-knowledge range and telemetry proofs with threshold ring signature verification, ensuring that an entity's hidden safeguards claim status strictly satisfies policy-defined thresholds without disclosing individual facility or inspector attributes.
- **Nuclear Gating Lifecycle Telemetry** — emits `NUCLEAR_GATING_POOL_INITIALIZED`, `ZK_SAFEGUARDS_CLAIM_VERIFIED`, and `NUCLEAR_ACCREDITATION_COMPLETED` into the Track 29 ZK-rollup accumulator.

### Canonical nuclear gating pool initialization payload wire layout

```
NUCLEARGATE:<poolId>:<sourceTenantId>:<targetChainId>:<blindedReactorTelemetryCommitment>:<blindedInspectionReportCommitment>:<blindedFacilityIdentityCommitment>:<inspectionWindowSeconds>:<telemetryChainDepth>:<pqcSignatureScheme>:<safeguardsAuthorityInitializerAttestationHash>:<committeeSignature>
```

### Canonical safeguards claim verification payload wire layout

```
NUCLEARCLAIM:<claimId>:<poolId>:<blindedInspectionReportCommitment>:<blindedClaimValueCommitment>:<zkSafeguardsRangeProofHash>:<nuclearOversightCommitteeAttestationHash>:<thresholdRingSignature>
```

### Canonical nuclear accreditation completion payload wire layout

```
NUCLEARCOMPLETE:<completionId>:<poolId>:<claimSignatureCount>:<pqcSignatureScheme>:<committeeSignatures>
```

### Policy schema additions

- `pqNuclearGating`:
  - `minSafeguardsQuorum`: 6
  - `maxInspectionWindowSeconds`: 7776000
  - `maxTelemetryChainDepth`: 12
  - `allowedPqcSignatureSchemes`: `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`
  - `requireSafeguardsAuthorityInitializerAttestation`: true
  - `requireNuclearOversightCommitteeAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banMalformedOrOutOfOrderSafeguardsClaims`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All decentralized nuclear safeguards monitoring criteria—including minimum safeguards quorums, maximum inspection window lifetime bounds, allowed telemetry chain depth parameters, and post-quantum signature schemes—are managed dynamically via the dedicated `pqNuclearGating` stanza in the active `CryptoPolicyEngine` schema.
- Both the safeguards-authority-initializing endpoint and the processing nuclear oversight committee relays must pass `EnclaveAttestationClient.verify()` before a state transition can be signed (Track 41 integration).
- The `PqcNuclearSafeguardsMonitoringGatingHub` instantiates multi-party IAEA safeguards verification pools using homomorphically split Pedersen commitments over reactor telemetry hashes, inspection report digests, and facility identity hashes, preventing reactor telemetry stream profiling and inspector identity harvesting loops.
- The `ZkSafeguardsClaimValidator` processes non-interactive zero-knowledge range and telemetry proofs with threshold ring signature verification, ensuring that an entity's hidden safeguards claim status strictly satisfies policy-defined thresholds without disclosing individual facility or inspector attributes.
- Peers broadcasting malformed or out-of-order safeguards claims are automatically banned when `banMalformedOrOutOfOrderSafeguardsClaims` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.
- The quorum minimum of 6 (highest in the matrix) reflects the critical infrastructure nature of nuclear safeguards, aligning with IAEA Additional Protocol frameworks requiring broad consensus across inspectors, national regulators, and IAEA oversight.
- Threshold ring signatures combine the anonymity of ring signatures (T83) with the threshold consensus of threshold signatures (T87), creating a new primitive where multiple inspectors can collaboratively sign safeguards reports without revealing which inspectors participated.

## Test checklist

### Positive paths

- [ ] `PqcNuclearSafeguardsMonitoringGatingHub` initializes a nuclear gating pool and emits `NUCLEAR_GATING_POOL_INITIALIZED`.
- [ ] `ZkSafeguardsClaimValidator` verifies a safeguards claim and emits `ZK_SAFEGUARDS_CLAIM_VERIFIED`.
- [ ] `PqcNuclearSafeguardsMonitoringGatingHub` completes nuclear accreditation after quorum and emits `NUCLEAR_ACCREDITATION_COMPLETED`.
- [ ] `CryptoPolicyEngine` validates a compliant `pqNuclearGating` configuration.

### Security / edge cases

- [ ] Reject safeguards quorum below `minSafeguardsQuorum` (6).
- [ ] Reject inspection window seconds exceeding `maxInspectionWindowSeconds`.
- [ ] Reject telemetry chain depth exceeding `maxTelemetryChainDepth`.
- [ ] Reject PQC signature scheme not in `allowedPqcSignatureSchemes`.
- [ ] Reject un-attested safeguards authority initializer.
- [ ] Reject un-attested nuclear oversight committee.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject safeguards claims exceeding the inspection window.
- [ ] Reject malformed safeguards claims (missing zkSafeguardsRangeProofHash, missing thresholdRingSignature).
- [ ] Reject duplicate pool initializations.
- [ ] Reject nuclear accreditation completion before safeguards claim verification.
- [ ] Reject nuclear accreditation completion with insufficient quorum.
- [ ] Automatically ban peers broadcasting malformed or out-of-order safeguards claims.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqNuclearGating` for `operation === 'pqNuclearGating'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pq-nuclear-safeguards-monitoring-gating` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pq-nuclear-safeguards-monitoring-gating`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a six-signer safeguards quorum with attested IAEA safeguards authority initializer and nuclear oversight committee relay, verify safeguards claim authentication and nuclear accreditation completion after quorum.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules, domain isolation (no existing track covers nuclear/safeguards operations), primitive isolation (threshold ring signatures new to gating matrix).

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-nuclear-safeguards-monitoring-gating-hub.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-safeguards-claim-validator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-nuclear-safeguards-monitoring-gating.test.cjs` *(new)*

## Approval

Pending Validator review.
