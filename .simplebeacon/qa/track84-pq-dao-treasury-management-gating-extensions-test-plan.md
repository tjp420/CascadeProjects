# Track 84 PQ DAO Treasury Management Gating Extensions Test Plan

## Branch
`feature/track84-extensions`

## Scope
Phase 2 extensions to PQC DAO Treasury Management Gating Hub and ZK Proposal Claim Validator.

## Files
- `ai-platform/server/lib/hsm-adapter/pqc-dao-treasury-management-gating-hub.cjs`
- `ai-platform/server/lib/hsm-adapter/zk-proposal-claim-validator.cjs`
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-dao-treasury-management-gating-extensions.test.cjs`

## Level 1 — Deterministic

- [x] `node -c` on all changed files
- [x] `npm test` — 69 tests pass (15 existing + 54 new)
- [x] SimpleBeacon gate scan: PASS

## Level 2 — Behavioral

- [x] Batch pool initialization with mixed valid/invalid requests
- [x] Allocation depth rebalancing (increase/decrease)
- [x] Committee signature aggregation with quorum enforcement
- [x] Pool cancellation (rejects accredited/settled pools)
- [x] Cross-chain settlement with chain mismatch detection
- [x] HW-SNARK proof generation with pool validation
- [x] Batch proposal claim verification with per-claim results
- [x] Slashing window validation (within/outside bounds)
- [x] Aggregate signature aggregation with banned-peer rejection (UNIQUE: aggregateSignature, not partialSignature)
- [x] Slash event recording with reason codes
- [x] Summary statistics (getStats)

## Level 3 — Reflection

- [x] Logic mirrors Track 73-83 extension pattern
- [x] No ghost files or hallucinated API paths
- [x] Treasury-specific terminology throughout (TREASURYGATE, TREASURYCLAIM, allocationDepth, proposalWindowSeconds, etc.)
- [x] 14 new hsm_tgate_* metrics added to both initial values and help definitions
- [x] 3 existing hsm_treasury_* / hsm_zk_proposal_* / hsm_voter_* baseline counters remain untouched
- [x] Default maxAllocationDepth correctly set to 16 (not 24 from education template)
- [x] Default maxProposalWindowSeconds correctly set to 2592000 (30 days, not 31536000 from template)
- [x] Phase 1 event contract preserved (TREASURY_GATING_POOL_INITIALIZED, ZK_PROPOSAL_CLAIM_VERIFIED, VOTER_ACCREDITATION_COMPLETED)
- [x] Phase 1 committee attestation contract preserved (requireTreasuryOversightCommitteeAttestation, treasuryOversightCommitteeAttestation)
- [x] Phase 1 governance authority attestation contract preserved (requireGovernanceAuthorityInitializerAttestation, governanceAuthorityInitializerAttestation)
- [x] SLASH_REASON uses PROPOSAL_WINDOW_OUT_OF_BOUNDS (not TRANSCRIPT_EXPIRATION_OUT_OF_BOUNDS)
- [x] Ban policy uses banMalformedOrOutOfOrderProposalClaims (not banMalformedOrOutOfOrderCredentialClaims)
- [x] UNIQUE: aggregateSignature field preserved (not partialSignature) for DAO governance
- [x] No aggregateAggregateSignatures intermediate artifact present
