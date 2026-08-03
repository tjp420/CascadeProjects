# Track 94 PQ Ocean Fisheries Allocation Gating Extensions Test Plan

## Branch
`feature/track94-extensions`

## Scope
Phase 2 extensions to PQC Ocean Fisheries Allocation Gating Hub and ZK Catch Claim Validator.

## Files
- `ai-platform/server/lib/hsm-adapter/pqc-ocean-fisheries-allocation-gating-hub.cjs`
- `ai-platform/server/lib/hsm-adapter/zk-catch-claim-validator.cjs`
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-ocean-fisheries-allocation-gating-extensions.test.cjs`

## Level 1 — Deterministic

- [x] `node -c` on all changed files
- [x] `npm test` — 69 tests pass (15 existing + 54 new)
- [x] SimpleBeacon gate scan: PASS

## Level 2 — Behavioral

- [x] Batch pool initialization with mixed valid/invalid requests
- [x] Vessel telemetry chain depth rebalancing (increase/decrease)
- [x] Committee signature aggregation with quorum enforcement (minMaritimeQuorum = 5)
- [x] Pool cancellation (rejects accredited/settled pools)
- [x] Cross-chain settlement with chain mismatch detection
- [x] HW-SNARK proof generation with pool validation
- [x] Batch catch claim verification with per-claim results
- [x] Slashing window validation (within/outside bounds)
- [x] Proxy re-encryption key digest aggregation with banned-peer rejection (UNIQUE: proxyReEncryptionKeyDigest, not partialSignature — second non-signature primitive)
- [x] Slash event recording with reason codes
- [x] Summary statistics (getStats)

## Level 3 — Reflection

- [x] Logic mirrors Track 73-93 extension pattern
- [x] No ghost files or hallucinated API paths
- [x] Fisheries-specific terminology throughout (FISHERIESGATE, FISHERIESCLAIM, vesselTelemetryChainDepth, catchTrackingWindowSeconds, etc.)
- [x] 14 new hsm_fgate_* metrics added to both initial values and help definitions
- [x] 3 existing hsm_fisheries_* / hsm_zk_catch_* / hsm_quota_* baseline counters remain untouched
- [x] Default maxVesselTelemetryChainDepth correctly set to 12 (not 24 from education template)
- [x] Default maxCatchTrackingWindowSeconds correctly set to 2592000 (30 days, not 31536000 from education template)
- [x] Default minMaritimeQuorum correctly set to 5 (not 3 from education template)
- [x] Phase 1 event contract preserved (FISHERIES_GATING_POOL_INITIALIZED, ZK_CATCH_CLAIM_VERIFIED, QUOTA_ACCREDITATION_COMPLETED)
- [x] Phase 1 committee attestation contract preserved (requireMarineSanctuaryOversightCommitteeAttestation, marineSanctuaryOversightCommitteeAttestation)
- [x] Phase 1 RFMO authority attestation contract preserved (requireRfmoAuthorityInitializerAttestation, rfmoAuthorityInitializerAttestation)
- [x] SLASH_REASON uses TRACKING_WINDOW_OUT_OF_BOUNDS (not TRANSCRIPT_EXPIRATION_OUT_OF_BOUNDS)
- [x] Ban policy uses banMalformedOrOutOfOrderCatchClaims (not banMalformedOrOutOfOrderCredentialClaims)
- [x] UNIQUE: proxyReEncryptionKeyDigest field preserved (not partialSignature) — second non-signature cryptographic primitive for cross-jurisdictional catch data sharing
