# Track 84: Post-Quantum Zero-Knowledge Cross-Chain Multi-Party Decentralized Autonomous Organization Treasury Management and Proposal Execution Gating Matrix — Test Plan

## Objective

Establish a privacy-preserving decentralized autonomous organization treasury management and proposal execution gating layer that scales cross-chain. Track 84 enforces non-repudiable governance authority attestation boundaries across shared networks while completely preventing treasury allocation profiling and voter identity harvesting loops. Combines lattice-based aggregate signatures with homomorphically split Pedersen commitments over treasury allocation hashes, proposal execution metrics, and voter identity hashes. This architecture enables sovereign governance authorities, treasury oversight committees, and DAO participants to verify hidden proposal claims (allocation threshold bounds, execution quorum metrics, voter accreditation status) via non-interactive zero-knowledge range proofs without exposing raw treasury allocations, voter identities, or cross-organization governance tracking indices.

## Scope

### Core primitives

- **PqcDaoTreasuryManagementGatingHub** — interlocking governance authority coordinator that instantiates multi-party treasury verification pools using homomorphically split Pedersen commitments over treasury allocation hashes, proposal execution metrics, and voter identity hashes.
- **ZkProposalClaimValidator** — succinct proposal verifier that processes non-interactive zero-knowledge range and allocation proofs with aggregate signature verification, ensuring that an entity's hidden proposal claim status strictly satisfies policy-defined thresholds without disclosing individual treasury or voter attributes.
- **Treasury Gating Lifecycle Telemetry** — emits `TREASURY_GATING_POOL_INITIALIZED`, `ZK_PROPOSAL_CLAIM_VERIFIED`, and `VOTER_ACCREDITATION_COMPLETED` into the Track 29 ZK-rollup accumulator.

### Canonical treasury gating pool initialization payload wire layout

```
TREASURYGATE:<poolId>:<sourceTenantId>:<targetChainId>:<blindedTreasuryAllocationCommitment>:<blindedProposalExecutionCommitment>:<blindedVoterIdentityCommitment>:<proposalWindowSeconds>:<allocationDepth>:<pqcSignatureScheme>:<governanceAuthorityInitializerAttestationHash>:<committeeSignature>
```

### Canonical proposal claim verification payload wire layout

```
TREASURYCLAIM:<claimId>:<poolId>:<blindedProposalExecutionCommitment>:<blindedClaimValueCommitment>:<zkProposalRangeProofHash>:<treasuryOversightCommitteeAttestationHash>:<aggregateSignature>
```

### Canonical voter accreditation completion payload wire layout

```
TREASURYCOMPLETE:<completionId>:<poolId>:<claimSignatureCount>:<pqcSignatureScheme>:<committeeSignatures>
```

### Policy schema additions

- `pqTreasuryGating`:
  - `minProposalQuorum`: 3
  - `maxProposalWindowSeconds`: 2592000
  - `maxAllocationDepth`: 16
  - `allowedPqcSignatureSchemes`: `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`
  - `requireGovernanceAuthorityInitializerAttestation`: true
  - `requireTreasuryOversightCommitteeAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banMalformedOrOutOfOrderProposalClaims`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All decentralized treasury gating criteria—including minimum proposal quorums, maximum proposal window lifetime bounds, allowed allocation depth parameters, and post-quantum signature schemes—are managed dynamically via the dedicated `pqTreasuryGating` stanza in the active `CryptoPolicyEngine` schema.
- Both the governance-authority-initializing endpoint and the processing treasury oversight committee relays must pass `EnclaveAttestationClient.verify()` before a state transition can be signed (Track 41 integration).
- The `PqcDaoTreasuryManagementGatingHub` instantiates multi-party treasury verification pools using homomorphically split Pedersen commitments over treasury allocation hashes, proposal execution metrics, and voter identity hashes, preventing treasury allocation profiling and voter identity harvesting loops.
- The `ZkProposalClaimValidator` processes non-interactive zero-knowledge range and allocation proofs with aggregate signature verification, ensuring that an entity's hidden proposal claim status strictly satisfies policy-defined thresholds without disclosing individual treasury or voter attributes.
- Peers broadcasting malformed or out-of-order proposal claims are automatically banned when `banMalformedOrOutOfOrderProposalClaims` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `PqcDaoTreasuryManagementGatingHub` initializes a treasury gating pool and emits `TREASURY_GATING_POOL_INITIALIZED`.
- [ ] `ZkProposalClaimValidator` verifies a proposal claim and emits `ZK_PROPOSAL_CLAIM_VERIFIED`.
- [ ] `PqcDaoTreasuryManagementGatingHub` completes voter accreditation after quorum and emits `VOTER_ACCREDITATION_COMPLETED`.
- [ ] `CryptoPolicyEngine` validates a compliant `pqTreasuryGating` configuration.

### Security / edge cases

- [ ] Reject proposal quorum below `minProposalQuorum`.
- [ ] Reject proposal window seconds exceeding `maxProposalWindowSeconds`.
- [ ] Reject allocation depth exceeding `maxAllocationDepth`.
- [ ] Reject PQC signature scheme not in `allowedPqcSignatureSchemes`.
- [ ] Reject un-attested governance authority initializer.
- [ ] Reject un-attested treasury oversight committee.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject proposal claims exceeding the proposal window.
- [ ] Reject malformed proposal claims (missing zkProposalRangeProofHash, missing aggregateSignature).
- [ ] Reject duplicate pool initializations.
- [ ] Reject voter accreditation completion before proposal claim verification.
- [ ] Reject voter accreditation completion with insufficient quorum.
- [ ] Automatically ban peers broadcasting malformed or out-of-order proposal claims.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqTreasuryGating` for `operation === 'pqTreasuryGating'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pq-dao-treasury-management-gating` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pq-dao-treasury-management-gating`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a three-signer proposal quorum with attested governance authority initializer and treasury oversight committee relay, verify proposal claim authentication and voter accreditation completion after quorum.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-dao-treasury-management-gating-hub.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-proposal-claim-validator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-dao-treasury-management-gating.test.cjs` *(new)*

## Approval

Pending Validator review.
