# Track 81 PQ Cross-Border Logistics Gating Extensions Test Plan

## Branch
eature/track81-extensions\n
## Scope
Phase 2 extensions to PQC Cross-Border Logistics Gating Hub and ZK Manifest Claim Validator.

## Files
- i-platform/server/lib/hsm-adapter/pqc-cross-border-logistics-gating-hub.cjs\n- i-platform/server/lib/hsm-adapter/zk-manifest-claim-validator.cjs\n- i-platform/server/lib/hsm-adapter/hsm-metrics.cjs\n- i-platform/server/lib/hsm-adapter/__tests__/pq-cross-border-logistics-gating-extensions.test.cjs\n
## Level 1 — Deterministic

- [x] ode -c on all changed files
- [x] pm test — 69 tests pass (15 existing + 54 new)
- [x] SimpleBeacon gate scan: PASS

## Level 2 — Behavioral

- [x] Batch pool initialization with mixed valid/invalid requests
- [x] Manifest depth rebalancing (increase/decrease)
- [x] Committee signature aggregation with quorum enforcement
- [x] Pool cancellation (rejects accredited/settled pools)
- [x] Cross-chain settlement with chain mismatch detection
- [x] HW-SNARK proof generation with pool validation
- [x] Batch manifest claim verification with per-claim results
- [x] Slashing window validation (within/outside bounds)
- [x] Partial signature aggregation with banned-peer rejection
- [x] Slash event recording with reason codes
- [x] Summary statistics (getStats)

## Level 3 — Reflection

- [x] Logic mirrors Track 73-80 extension pattern
- [x] No ghost files or hallucinated API paths
- [x] Logistics-specific terminology throughout (LOGIGATE, LOGICLAIM, manifestDepth, transitWindowSeconds, etc.)
- [x] 14 new hsm_lgate_* metrics added to both initial values and help definitions
- [x] 3 existing hsm_logistics_* / hsm_zk_manifest_* / hsm_carrier_* baseline counters remain untouched
- [x] Default maxManifestDepth correctly set to 32 (not 24 from education template)
- [x] Default maxTransitWindowSeconds correctly set to 7776000 (90 days, not 31536000 from template)
- [x] Phase 1 event contract preserved (LOGISTICS_GATING_POOL_INITIALIZED, ZK_MANIFEST_CLAIM_VERIFIED, CARRIER_ACCREDITATION_COMPLETED)
- [x] Phase 1 committee attestation contract preserved (requireTradeCorridorCommitteeAttestation, tradeCorridorCommitteeAttestation)
- [x] Phase 1 customs authority attestation contract preserved (requireCustomsAuthorityInitializerAttestation, customsAuthorityInitializerAttestation)
- [x] SLASH_REASON uses TRANSIT_WINDOW_OUT_OF_BOUNDS (not TRANSCRIPT_EXPIRATION_OUT_OF_BOUNDS)
- [x] Ban policy uses banMalformedOrOutOfOrderManifestClaims (not banMalformedOrOutOfOrderCredentialClaims)
