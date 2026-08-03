# Track 90 PQ Wildlife Conservation Tracking Gating Extensions Test Plan

## Branch
`feature/track90-extensions`

## Scope
Phase 2 extensions to PQC Wildlife Conservation Tracking Gating Hub and ZK Conservation Claim Validator.

## Files
- `ai-platform/server/lib/hsm-adapter/pqc-wildlife-conservation-tracking-gating-hub.cjs`
- `ai-platform/server/lib/hsm-adapter/zk-conservation-claim-validator.cjs`
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-wildlife-conservation-tracking-gating-extensions.test.cjs`

## Level 1 — Deterministic

- [x] `node -c` on all changed files
- [x] `npm test` — 69 tests pass (15 existing + 54 new)
- [x] SimpleBeacon gate scan: PASS

## Level 2 — Behavioral

- [x] Batch pool initialization with mixed valid/invalid requests
- [x] Telemetry chain depth rebalancing (increase/decrease)
- [x] Committee signature aggregation with quorum enforcement (minConservationQuorum = 4)
- [x] Pool cancellation (rejects accredited/settled pools)
- [x] Cross-chain settlement with chain mismatch detection
- [x] HW-SNARK proof generation with pool validation
- [x] Batch conservation claim verification with per-claim results
- [x] Slashing window validation (within/outside bounds)
- [x] Linkable ring signature aggregation with banned-peer rejection (UNIQUE: linkableRingSignature, not partialSignature)
- [x] Linkability tag double-report prevention (UNIQUE to Track 90)
- [x] Slash event recording with reason codes
- [x] Summary statistics (getStats)

## Level 3 — Reflection

- [x] Logic mirrors Track 73-89 extension pattern
- [x] No ghost files or hallucinated API paths
- [x] Wildlife-conservation-specific terminology throughout (WILDLIFEGATE, WILDLIFECLAIM, telemetryChainDepth, monitoringWindowSeconds, etc.)
- [x] 14 new hsm_wlgate_* metrics added to both initial values and help definitions
- [x] 3 existing hsm_wildlife_* / hsm_zk_conservation_* / hsm_biodiversity_* baseline counters remain untouched
- [x] Default maxTelemetryChainDepth correctly set to 14 (not 24 from education template)
- [x] Default maxMonitoringWindowSeconds correctly set to 2592000 (30 days, not 31536000 from education template)
- [x] Default minConservationQuorum correctly set to 4 (not 3 from education template)
- [x] Phase 1 event contract preserved (WILDLIFE_GATING_POOL_INITIALIZED, ZK_CONSERVATION_CLAIM_VERIFIED, BIODIVERSITY_ACCREDITATION_COMPLETED)
- [x] Phase 1 committee attestation contract preserved (requireBiodiversityOversightCommitteeAttestation, biodiversityOversightCommitteeAttestation)
- [x] Phase 1 conservation authority attestation contract preserved (requireConservationAuthorityInitializerAttestation, conservationAuthorityInitializerAttestation)
- [x] SLASH_REASON uses MONITORING_WINDOW_OUT_OF_BOUNDS (not TRANSCRIPT_EXPIRATION_OUT_OF_BOUNDS)
- [x] Ban policy uses banMalformedOrOutOfOrderConservationClaims (not banMalformedOrOutOfOrderCredentialClaims)
- [x] UNIQUE: linkableRingSignature field preserved (not partialSignature) for ranger anonymity
- [x] UNIQUE: linkabilityTag field preserved for double-report prevention
- [x] UNIQUE: _seenLinkabilityTags Set preserved in constructor
- [x] UNIQUE: WILDLIFECLAIM_DOUBLE_REPORT_DETECTED error preserved
- [x] UNIQUE: isLinkabilityTagSeen method preserved
