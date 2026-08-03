# Track 59: Decentralized Post-Quantum Cross-Chain Governance Bridges — Test Plan

## Objective

Bridge the high-availability multi-node consensus architecture with external platform ecosystems by introducing an automated, multi-party cross-chain instruction pipeline. Cross-chain governance updates (such as changing multi-tenant bridge parameters or updating globally tracked key definitions) must be collectively signed by an M-of-N quorum of post-quantum threshold validators across independent network topologies before being committed, preventing single-network protocol hijackings. Building on Track 48 post-quantum asset bridges, Track 50 zero-knowledge settlement engines, and Track 58 vesting locks.

## Scope

### Core primitives

- **PqcCrossChainGovernanceBridge** — interlocking cross-chain message coordinator that accepts structured cross-network proposals and verifies their authenticity using partial ML-DSA signature collections mapped to multi-platform quorums.
- **GovernanceProposalVotingMonitor** — atomic instruction execution supervisor that aggregates and counts platform endorsements, strictly locking execution pathways unless a valid consensus threshold is reached within the active epoch block.
- **Bridge Lifecycle Telemetry** — emits `CROSS_CHAIN_PROPOSAL_BROADCAST`, `GOVERNANCE_VOTE_RECORDED`, and `CROSS_CHAIN_PROPOSAL_EXECUTED` into the Track 29 ZK-rollup accumulator.

### Canonical cross-chain governance proposal payload wire layout

```
GOVPROP:<proposalId>:<sourceTenantId>:<targetChainId>:<instructionType>:<instructionHash>:<executionWindowSeconds>:<broadcasterAttestationHash>:<thresholdSignature>
```

### Canonical governance vote payload wire layout

```
GOVVOTE:<voteId>:<proposalId>:<platformId>:<voteDecision>:<verifierRelayAttestationHash>:<partialSignature>
```

### Policy schema additions

- `pqcCrossChainGovernance`:
  - `minPlatformVotingQuorum`: 3
  - `maxConcurrentProposals`: 16
  - `maxProposalExecutionWindowSeconds`: 86400
  - `allowedPqcSignatureSchemes`: `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`
  - `requireProposalBroadcasterAttestation`: true
  - `requireVerifierRelayAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banMalformedOrOutOfOrderVotes`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All cross-chain bridge threshold parameters—including minimum platform voting quorums, maximum concurrent multi-chain proposals, and allowed proposal execution windows—are managed dynamically via the dedicated `pqcCrossChainGovernance` stanza in the active `CryptoPolicyEngine` schema.
- Both the proposal-broadcasting endpoint and the processing verifier node relays must pass `EnclaveAttestationClient.verify()` before an instruction can be staged (Track 41 integration).
- The `PqcCrossChainGovernanceBridge` accepts structured cross-network proposals and verifies their authenticity using partial ML-DSA signature collections mapped to multi-platform quorums.
- The `GovernanceProposalVotingMonitor` aggregates platform endorsements, strictly locking execution pathways unless `minPlatformVotingQuorum` is reached within the execution window.
- Peers broadcasting malformed or out-of-order proposal votes are automatically banned when `banMalformedOrOutOfOrderVotes` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `PqcCrossChainGovernanceBridge` broadcasts a proposal and emits `CROSS_CHAIN_PROPOSAL_BROADCAST`.
- [ ] `GovernanceProposalVotingMonitor` records a valid platform vote and emits `GOVERNANCE_VOTE_RECORDED`.
- [ ] `GovernanceProposalVotingMonitor` executes a proposal after quorum is reached and emits `CROSS_CHAIN_PROPOSAL_EXECUTED`.
- [ ] `CryptoPolicyEngine` validates a compliant `pqcCrossChainGovernance` configuration.

### Security / edge cases

- [ ] Reject platform voting quorum below `minPlatformVotingQuorum`.
- [ ] Reject concurrent proposals exceeding `maxConcurrentProposals`.
- [ ] Reject proposal execution window exceeding `maxProposalExecutionWindowSeconds`.
- [ ] Reject PQC signature scheme not in `allowedPqcSignatureSchemes`.
- [ ] Reject un-attested proposal broadcaster.
- [ ] Reject un-attested verifier relay.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject proposal execution before quorum is reached.
- [ ] Reject proposal execution after execution window expires.
- [ ] Automatically ban peers broadcasting malformed or out-of-order votes.
- [ ] Reject a payload that does not follow the canonical layout.
- [ ] Reject duplicate votes from the same platform.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqcCrossChainGovernance` for `operation === 'pqcCrossChainGovernance'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pqc-cross-chain-governance` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pqc-cross-chain-governance`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a three-platform governance proposal with attested broadcaster and verifier relays, verify quorum execution.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-cross-chain-governance-bridge.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/governance-proposal-voting-monitor.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pqc-cross-chain-governance.test.cjs` *(new)*

## Approval

Pending Validator review.
