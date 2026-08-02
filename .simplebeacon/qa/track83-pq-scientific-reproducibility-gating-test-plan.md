# Track 83: Post-Quantum Zero-Knowledge Cross-Chain Multi-Party Decentralized Scientific Research Reproducibility Verification and Anonymous Peer Review Gating Matrix — Test Plan

## Objective

Establish a privacy-preserving decentralized scientific research reproducibility verification and anonymous peer review gating layer that scales cross-chain. Track 83 enforces non-repudiable research authority attestation boundaries across shared networks while completely preventing experiment data profiling and reviewer identity harvesting loops. Combines lattice-based ring signatures with homomorphically split Pedersen commitments over experiment hash commitments, replication result hashes, and reviewer identity hashes. This architecture enables sovereign research integrity authorities, peer review committees, and academic institutions to verify hidden reproducibility claims (replication success thresholds, peer review quorum bounds, citation integrity metrics) via non-interactive zero-knowledge range proofs without exposing raw experiment data, reviewer identities, or cross-institutional review tracking indices.

## Scope

### Core primitives

- **PqcScientificReproducibilityGatingHub** — interlocking research authority coordinator that instantiates multi-party research verification pools using homomorphically split Pedersen commitments over experiment hash commitments, replication result hashes, and reviewer identity hashes.
- **ZkReplicationClaimValidator** — succinct replication verifier that processes non-interactive zero-knowledge range and replication proofs with ring signature verification, ensuring that an entity's hidden reproducibility claim status strictly satisfies policy-defined thresholds without disclosing individual experiment or reviewer attributes.
- **Research Gating Lifecycle Telemetry** — emits `RESEARCH_GATING_POOL_INITIALIZED`, `ZK_REPLICATION_CLAIM_VERIFIED`, and `PEER_REVIEW_ACCREDITATION_COMPLETED` into the Track 29 ZK-rollup accumulator.

### Canonical research gating pool initialization payload wire layout

```
RESEARCHGATE:<poolId>:<sourceTenantId>:<targetChainId>:<blindedExperimentHashCommitment>:<blindedReplicationResultCommitment>:<blindedReviewerIdentityCommitment>:<replicationWindowSeconds>:<citationDepth>:<pqcSignatureScheme>:<researchAuthorityInitializerAttestationHash>:<committeeSignature>
```

### Canonical replication claim verification payload wire layout

```
RESEARCHCLAIM:<claimId>:<poolId>:<blindedReplicationResultCommitment>:<blindedClaimValueCommitment>:<zkReplicationRangeProofHash>:<integrityCommitteeAttestationHash>:<ringSignature>
```

### Canonical peer review accreditation completion payload wire layout

```
RESEARCHCOMPLETE:<completionId>:<poolId>:<claimSignatureCount>:<pqcSignatureScheme>:<committeeSignatures>
```

### Policy schema additions

- `pqResearchGating`:
  - `minPeerReviewQuorum`: 3
  - `maxReplicationWindowSeconds`: 15768000
  - `maxCitationDepth`: 48
  - `allowedPqcSignatureSchemes`: `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`
  - `requireResearchAuthorityInitializerAttestation`: true
  - `requireIntegrityCommitteeAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banMalformedOrOutOfOrderReplicationClaims`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All decentralized research gating criteria—including minimum peer review quorums, maximum replication window lifetime bounds, allowed citation depth parameters, and post-quantum signature schemes—are managed dynamically via the dedicated `pqResearchGating` stanza in the active `CryptoPolicyEngine` schema.
- Both the research-authority-initializing endpoint and the processing integrity committee relays must pass `EnclaveAttestationClient.verify()` before a state transition can be signed (Track 41 integration).
- The `PqcScientificReproducibilityGatingHub` instantiates multi-party research verification pools using homomorphically split Pedersen commitments over experiment hash commitments, replication result hashes, and reviewer identity hashes, preventing experiment data profiling and reviewer identity harvesting loops.
- The `ZkReplicationClaimValidator` processes non-interactive zero-knowledge range and replication proofs with ring signature verification, ensuring that an entity's hidden reproducibility claim status strictly satisfies policy-defined thresholds without disclosing individual experiment or reviewer attributes.
- Peers broadcasting malformed or out-of-order replication claims are automatically banned when `banMalformedOrOutOfOrderReplicationClaims` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `PqcScientificReproducibilityGatingHub` initializes a research gating pool and emits `RESEARCH_GATING_POOL_INITIALIZED`.
- [ ] `ZkReplicationClaimValidator` verifies a replication claim and emits `ZK_REPLICATION_CLAIM_VERIFIED`.
- [ ] `PqcScientificReproducibilityGatingHub` completes peer review accreditation after quorum and emits `PEER_REVIEW_ACCREDITATION_COMPLETED`.
- [ ] `CryptoPolicyEngine` validates a compliant `pqResearchGating` configuration.

### Security / edge cases

- [ ] Reject peer review quorum below `minPeerReviewQuorum`.
- [ ] Reject replication window seconds exceeding `maxReplicationWindowSeconds`.
- [ ] Reject citation depth exceeding `maxCitationDepth`.
- [ ] Reject PQC signature scheme not in `allowedPqcSignatureSchemes`.
- [ ] Reject un-attested research authority initializer.
- [ ] Reject un-attested integrity committee.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject replication claims exceeding the replication window.
- [ ] Reject malformed replication claims (missing zkReplicationRangeProofHash, missing ringSignature).
- [ ] Reject duplicate pool initializations.
- [ ] Reject peer review accreditation completion before replication claim verification.
- [ ] Reject peer review accreditation completion with insufficient quorum.
- [ ] Automatically ban peers broadcasting malformed or out-of-order replication claims.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqResearchGating` for `operation === 'pqResearchGating'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pq-scientific-reproducibility-gating` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pq-scientific-reproducibility-gating`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a three-signer peer review quorum with attested research authority initializer and integrity committee relay, verify replication claim authentication and peer review accreditation completion after quorum.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-scientific-reproducibility-gating-hub.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-replication-claim-validator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-scientific-reproducibility-gating.test.cjs` *(new)*

## Approval

Pending Validator review.
