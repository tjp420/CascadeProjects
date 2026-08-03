# Track 79 PQ Clinical Trial Verification Gating Test Plan

## Branch
`feature/track79-extensions`

## Scope
Phase 2 extensions to PQC Clinical Trial Verification Gating Hub and ZK Trial Claim Validator.

## Files
- `ai-platform/server/lib/hsm-adapter/pqc-clinical-trial-verification-gating-hub.cjs`
- `ai-platform/server/lib/hsm-adapter/zk-trial-claim-validator.cjs`
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-clinical-trial-verification-gating-extensions.test.cjs`

## Level 1 — Deterministic

- [x] `node -c` on all changed files
- [x] `npm test` — 69 tests pass (15 existing + 54 new)
- [x] SimpleBeacon gate scan: PASS

## Level 2 — Behavioral

- [x] Batch pool initialization with mixed valid/invalid requests
- [x] Cohort metric depth rebalancing (increase/decrease)
- [x] Committee signature aggregation with quorum enforcement
- [x] Pool cancellation (rejects accredited/settled pools)
- [x] Cross-chain settlement with chain mismatch detection
- [x] HW-SNARK proof generation with pool validation
- [x] Batch trial claim verification with per-claim results
- [x] Slashing window validation (within/outside bounds)
- [x] Partial signature aggregation with banned-peer rejection
- [x] Slash event recording with reason codes
- [x] Summary statistics (getStats)

## Level 3 — Reflection

- [x] Logic mirrors Track 73/74/75/76/77/78 extension pattern
- [x] No ghost files or hallucinated API paths
- [x] Clinical-trial-specific terminology throughout (TRIALGATE, TRIALCLAIM, cohortMetricDepth, etc.)
- [x] 14 new hsm_ctgate_* metrics added to both initial values and help definitions
- [x] 3 existing hsm_clinical_trial_* / hsm_zk_trial_* / hsm_cohort_* baseline counters remain untouched
- [x] Default maxCohortMetricDepth correctly set to 24 (matches Phase 1 and education template)
- [x] Default maxTrialDurationSeconds correctly set to 94608000 (~3 years, not 31536000 from education template)
- [x] Phase 1 event contract preserved (COHORT_ACCREDITATION_COMPLETED, ZK_TRIAL_CLAIM_VERIFIED, CLINICAL_TRIAL_GATING_POOL_INITIALIZED)
- [x] Phase 1 committee attestation contract preserved (requireClearingCommitteeAttestation, clearingCommitteeAttestation — matches template, no rename needed)
- [x] SLASH_REASON uses TRIAL_DURATION_OUT_OF_BOUNDS (not TRANSCRIPT_EXPIRATION_OUT_OF_BOUNDS)
