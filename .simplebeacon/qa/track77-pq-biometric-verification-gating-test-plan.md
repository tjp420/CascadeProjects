# Track 77 PQ Biometric Verification Gating Test Plan

## Branch
`feature/track77-extensions`

## Scope
Phase 2 extensions to PQC Biometric Verification Gating Hub and ZK Biometric Claim Validator.

## Files
- `ai-platform/server/lib/hsm-adapter/pqc-biometric-verification-gating-hub.cjs`
- `ai-platform/server/lib/hsm-adapter/zk-biometric-claim-validator.cjs`
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-biometric-verification-gating-extensions.test.cjs`

## Level 1 — Deterministic

- [x] `node -c` on all changed files
- [x] `npm test` — 69 tests pass (15 existing + 54 new)
- [x] SimpleBeacon gate scan: PASS

## Level 2 — Behavioral

- [x] Batch pool initialization with mixed valid/invalid requests
- [x] Liveness metric depth rebalancing (increase/decrease)
- [x] Committee signature aggregation with quorum enforcement
- [x] Pool cancellation (rejects accredited/settled pools)
- [x] Cross-chain settlement with chain mismatch detection
- [x] HW-SNARK proof generation with pool validation
- [x] Batch biometric claim verification with per-claim results
- [x] Slashing window validation (within/outside bounds)
- [x] Partial signature aggregation with banned-peer rejection
- [x] Slash event recording with reason codes
- [x] Summary statistics (getStats)

## Level 3 — Reflection

- [x] Logic mirrors Track 73/74/75/76 extension pattern
- [x] No ghost files or hallucinated API paths
- [x] Biometric-specific terminology throughout (BIOMETRICGATE, BIOMETRICCLAIM, livenessMetricDepth, etc.)
- [x] 14 new hsm_bgate_* metrics added to both initial values and help definitions
- [x] 2 existing hsm_biometric_* / hsm_zk_biometric_* baseline counters remain untouched
- [x] Default maxLivenessMetricDepth correctly set to 16 (not 24 from education template)
- [x] Default maxTemplateExpirationSeconds correctly set to 15552000 (180 days)
- [x] Phase 1 event contract preserved (LIVENESS_ATTESTATION_ACCREDITATION_COMPLETED, ZK_BIOMETRIC_CLAIM_VERIFIED)
