# Track 88 PQ Water Rights Allocation Gating Extensions Test Plan

## Branch
`feature/track88-extensions`

## Scope
Phase 2 extensions to PQC Water Rights Allocation Gating Hub and ZK Water Rights Claim Validator.

## Files
- `ai-platform/server/lib/hsm-adapter/pqc-water-rights-allocation-gating-hub.cjs`
- `ai-platform/server/lib/hsm-adapter/zk-water-rights-claim-validator.cjs`
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-water-rights-allocation-gating-extensions.test.cjs`

## Level 1 — Deterministic

- [x] `node -c` on all changed files
- [x] `npm test` — 69 tests pass (15 existing + 54 new)
- [x] SimpleBeacon gate scan: PASS

## Level 2 — Behavioral

- [x] Batch pool initialization with mixed valid/invalid requests
- [x] Flow chain depth rebalancing (increase/decrease)
- [x] Committee signature aggregation with quorum enforcement (minWatershedQuorum = 4, higher than standard 3)
- [x] Pool cancellation (rejects accredited/settled pools)
- [x] Cross-chain settlement with chain mismatch detection
- [x] HW-SNARK proof generation with pool validation
- [x] Batch water claim verification with per-claim results
- [x] Slashing window validation (within/outside bounds)
- [x] MPC proof aggregation with banned-peer rejection (UNIQUE: mpcProof, not partialSignature)
- [x] Slash event recording with reason codes
- [x] Summary statistics (getStats)

## Level 3 — Reflection

- [x] Logic mirrors Track 73-87 extension pattern
- [x] No ghost files or hallucinated API paths
- [x] Water-rights-specific terminology throughout (WATERGATE, WATERCLAIM, flowChainDepth, allocationWindowSeconds, etc.)
- [x] 14 new hsm_wgate_* metrics added to both initial values and help definitions
- [x] 3 existing hsm_water_* / hsm_zk_water_* baseline counters remain untouched
- [x] Default maxFlowChainDepth correctly set to 20 (not 24 from education template)
- [x] Default maxAllocationWindowSeconds correctly set to 31536000 (SAME as education template — no fix needed)
- [x] Default minWatershedQuorum correctly set to 4 (higher than standard 3, lower than Track 87's 5)
- [x] Phase 1 event contract preserved (WATER_GATING_POOL_INITIALIZED, ZK_WATER_CLAIM_VERIFIED, WATERSHED_ACCREDITATION_COMPLETED)
- [x] Phase 1 committee attestation contract preserved (requireWatershedOversightCommitteeAttestation, watershedOversightCommitteeAttestation)
- [x] Phase 1 water authority attestation contract preserved (requireWaterAuthorityInitializerAttestation, waterAuthorityInitializerAttestation)
- [x] SLASH_REASON uses ALLOCATION_WINDOW_OUT_OF_BOUNDS (not TRANSCRIPT_EXPIRATION_OUT_OF_BOUNDS)
- [x] Ban policy uses banMalformedOrOutOfOrderWaterClaims (not banMalformedOrOutOfOrderCredentialClaims)
- [x] UNIQUE: mpcProof field preserved (not partialSignature) for multi-party computation verification
