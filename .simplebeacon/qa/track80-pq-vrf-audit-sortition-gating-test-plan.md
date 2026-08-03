# Track 80: Post-Quantum Zero-Knowledge Cross-Chain Multi-Party Decentralized Verifiable Random Function Audit Sortition and Validator Selection Gating Matrix — Test Plan

## Objective

Establish a privacy-preserving decentralized audit sortition and validator selection gating layer that scales cross-chain. Track 80 enforces non-repudiable sortition authority attestation boundaries across shared networks while completely preventing validator stake profiling and sortition seed harvesting loops. Combines lattice-based verifiable random functions (VRFs) with homomorphically split Pedersen commitments over validator stake hashes, sortition seed metrics, and selection entropy hashes. This architecture enables sovereign audit authorities, governance committees, and network validators to verify hidden sortition claims (stake thresholds, selection probability scores, entropy contribution metrics) via non-interactive zero-knowledge range proofs without exposing raw validator stake distributions, sortition seed values, or cross-organization selection tracking indices.

## Scope

### Core primitives

- **PqcVrfAuditSortitionGatingHub** — interlocking sortition authority coordinator that instantiates multi-party sortition verification pools using homomorphically split Pedersen commitments over validator stake hashes, sortition seed metrics, and selection entropy hashes.
- **ZkSortitionClaimValidator** — succinct sortition verifier that processes non-interactive zero-knowledge range and entropy proofs, ensuring that an entity's hidden sortition claim status strictly satisfies policy-defined thresholds without disclosing individual validator or sortition attributes.
- **Sortition Gating Lifecycle Telemetry** — emits `SORTITION_GATING_POOL_INITIALIZED`, `ZK_SORTITION_CLAIM_VERIFIED`, and `VALIDATOR_ACCREDITATION_COMPLETED` into the Track 29 ZK-rollup accumulator.

### Canonical sortition gating pool initialization payload wire layout

```
SORTGATE:<poolId>:<sourceTenantId>:<targetChainId>:<blindedStakeHashCommitment>:<blindedSortitionSeedCommitment>:<blindedEntropyHashCommitment>:<sortitionEpochSeconds>:<entropyDepth>:<pqcSignatureScheme>:<sortitionAuthorityInitializerAttestationHash>:<committeeSignature>
```

### Canonical sortition claim verification payload wire layout

```
SORTCLAIM:<claimId>:<poolId>:<blindedSortitionSeedCommitment>:<blindedClaimValueCommitment>:<zkSortitionRangeProofHash>:<auditCommitteeAttestationHash>:<partialSignature>
```

### Canonical validator accreditation completion payload wire layout

```
SORTCOMPLETE:<completionId>:<poolId>:<claimSignatureCount>:<pqcSignatureScheme>:<committeeSignatures>
```

### Policy schema additions

- `pqSortitionGating`:
  - `minSortitionQuorum`: 3
  - `maxSortitionEpochSeconds`: 2592000
  - `maxEntropyDepth`: 16
  - `allowedPqcSignatureSchemes`: `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`
  - `requireSortitionAuthorityInitializerAttestation`: true
  - `requireAuditCommitteeAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banMalformedOrOutOfOrderSortitionClaims`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All decentralized sortition gating criteria—including minimum sortition quorums, maximum sortition epoch lifetime bounds, allowed entropy depth parameters, and post-quantum signature schemes—are managed dynamically via the dedicated `pqSortitionGating` stanza in the active `CryptoPolicyEngine` schema.
- Both the sortition-authority-initializing endpoint and the processing audit committee relays must pass `EnclaveAttestationClient.verify()` before a state transition can be signed (Track 41 integration).
- The `PqcVrfAuditSortitionGatingHub` instantiates multi-party sortition verification pools using homomorphically split Pedersen commitments over validator stake hashes, sortition seed metrics, and selection entropy hashes, preventing validator stake profiling and sortition seed harvesting loops.
- The `ZkSortitionClaimValidator` processes non-interactive zero-knowledge range and entropy proofs, ensuring that an entity's hidden sortition claim status strictly satisfies policy-defined thresholds without disclosing individual validator or sortition attributes.
- Peers broadcasting malformed or out-of-order sortition claims are automatically banned when `banMalformedOrOutOfOrderSortitionClaims` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `PqcVrfAuditSortitionGatingHub` initializes a sortition gating pool and emits `SORTITION_GATING_POOL_INITIALIZED`.
- [ ] `ZkSortitionClaimValidator` verifies a sortition claim and emits `ZK_SORTITION_CLAIM_VERIFIED`.
- [ ] `PqcVrfAuditSortitionGatingHub` completes validator accreditation after quorum and emits `VALIDATOR_ACCREDITATION_COMPLETED`.
- [ ] `CryptoPolicyEngine` validates a compliant `pqSortitionGating` configuration.

### Security / edge cases

- [ ] Reject sortition quorum below `minSortitionQuorum`.
- [ ] Reject sortition epoch seconds exceeding `maxSortitionEpochSeconds`.
- [ ] Reject entropy depth exceeding `maxEntropyDepth`.
- [ ] Reject PQC signature scheme not in `allowedPqcSignatureSchemes`.
- [ ] Reject un-attested sortition authority initializer.
- [ ] Reject un-attested audit committee.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject sortition claims exceeding the sortition epoch window.
- [ ] Reject malformed sortition claims (missing zkSortitionRangeProofHash, missing partialSignature).
- [ ] Reject duplicate pool initializations.
- [ ] Reject validator accreditation completion before sortition claim verification.
- [ ] Reject validator accreditation completion with insufficient quorum.
- [ ] Automatically ban peers broadcasting malformed or out-of-order sortition claims.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqSortitionGating` for `operation === 'pqSortitionGating'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pq-vrf-audit-sortition-gating` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pq-vrf-audit-sortition-gating`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a three-signer sortition quorum with attested sortition authority initializer and audit committee relay, verify sortition claim authentication and validator accreditation completion after quorum.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-vrf-audit-sortition-gating-hub.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-sortition-claim-validator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-vrf-audit-sortition-gating.test.cjs` *(new)*

## Approval

Pending Validator review.
