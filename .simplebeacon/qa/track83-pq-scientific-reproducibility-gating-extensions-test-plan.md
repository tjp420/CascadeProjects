# Track 83 PQ Scientific Reproducibility Gating Extensions Test Plan

## Branch
`feature/track83-extensions`

## Scope
Phase 2 extensions to PQC Scientific Reproducibility Gating Hub and ZK Replication Claim Validator.

## Files
- `ai-platform/server/lib/hsm-adapter/pqc-scientific-reproducibility-gating-hub.cjs`
- `ai-platform/server/lib/hsm-adapter/zk-replication-claim-validator.cjs`
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-scientific-reproducibility-gating-extensions.test.cjs`

## Level 1 — Deterministic

- [x] `node -c` on all changed files
- [x] `npm test` — 69 tests pass (15 existing + 54 new)
- [x] SimpleBeacon gate scan: PASS

## Level 2 — Behavioral

- [x] Batch pool initialization with mixed valid/invalid requests
- [x] Citation depth rebalancing (increase/decrease)
- [x] Committee signature aggregation with quorum enforcement
- [x] Pool cancellation (rejects accredited/settled pools)
- [x] Cross-chain settlement with chain mismatch detection
- [x] HW-SNARK proof generation with pool validation
- [x] Batch replication claim verification with per-claim results
- [x] Slashing window validation (within/outside bounds)
- [x] Ring signature aggregation with banned-peer rejection (UNIQUE: ringSignature, not partialSignature)
- [x] Slash event recording with reason codes
- [x] Summary statistics (getStats)

## Level 3 — Reflection

- [x] Logic mirrors Track 73-82 extension pattern
- [x] No ghost files or hallucinated API paths
- [x] Research-specific terminology throughout (RESEARCHGATE, RESEARCHCLAIM, citationDepth, replicationWindowSeconds, etc.)
- [x] 14 new hsm_rgate_* metrics added to both initial values and help definitions
- [x] 3 existing hsm_research_* / hsm_zk_replication_* / hsm_peer_review_* baseline counters remain untouched
- [x] Default maxCitationDepth correctly set to 48 (not 24 from education template)
- [x] Default maxReplicationWindowSeconds correctly set to 15768000 (~6 months, not 31536000 from template)
- [x] Phase 1 event contract preserved (RESEARCH_GATING_POOL_INITIALIZED, ZK_REPLICATION_CLAIM_VERIFIED, PEER_REVIEW_ACCREDITATION_COMPLETED)
- [x] Phase 1 committee attestation contract preserved (requireIntegrityCommitteeAttestation, integrityCommitteeAttestation)
- [x] Phase 1 research authority attestation contract preserved (requireResearchAuthorityInitializerAttestation, researchAuthorityInitializerAttestation)
- [x] SLASH_REASON uses REPLICATION_WINDOW_OUT_OF_BOUNDS (not TRANSCRIPT_EXPIRATION_OUT_OF_BOUNDS)
- [x] Ban policy uses banMalformedOrOutOfOrderReplicationClaims (not banMalformedOrOutOfOrderCredentialClaims)
- [x] UNIQUE: ringSignature field preserved (not partialSignature) for anonymous peer review
