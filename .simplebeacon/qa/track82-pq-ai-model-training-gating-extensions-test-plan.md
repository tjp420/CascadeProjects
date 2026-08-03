# Track 82 PQ AI Model Training Gating Extensions Test Plan

## Branch
`feature/track82-extensions`

## Scope
Phase 2 extensions to PQC AI Model Training Gating Hub and ZK Training Claim Validator.

## Files
- `ai-platform/server/lib/hsm-adapter/pqc-ai-model-training-gating-hub.cjs`
- `ai-platform/server/lib/hsm-adapter/zk-training-claim-validator.cjs`
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-ai-model-training-gating-extensions.test.cjs`

## Level 1 — Deterministic

- [x] `node -c` on all changed files
- [x] `npm test` — 69 tests pass (15 existing + 54 new)
- [x] SimpleBeacon gate scan: PASS

## Level 2 — Behavioral

- [x] Batch pool initialization with mixed valid/invalid requests
- [x] Provenance depth rebalancing (increase/decrease)
- [x] Committee signature aggregation with quorum enforcement
- [x] Pool cancellation (rejects accredited/settled pools)
- [x] Cross-chain settlement with chain mismatch detection
- [x] HW-SNARK proof generation with pool validation
- [x] Batch training claim verification with per-claim results
- [x] Slashing window validation (within/outside bounds)
- [x] Partial signature aggregation with banned-peer rejection
- [x] Slash event recording with reason codes
- [x] Summary statistics (getStats)

## Level 3 — Reflection

- [x] Logic mirrors Track 73-81 extension pattern
- [x] No ghost files or hallucinated API paths
- [x] Training-specific terminology throughout (TRAINGATE, TRAINCLAIM, provenanceDepth, trainingWindowSeconds, etc.)
- [x] 14 new hsm_trgate_* metrics added to both initial values and help definitions
- [x] 3 existing hsm_training_* / hsm_zk_training_* / hsm_model_* baseline counters remain untouched
- [x] Default maxProvenanceDepth correctly set to 64 (not 24 from education template)
- [x] Default maxTrainingWindowSeconds correctly set to 63072000 (2 years, not 31536000 from template)
- [x] Phase 1 event contract preserved (TRAINING_GATING_POOL_INITIALIZED, ZK_TRAINING_CLAIM_VERIFIED, MODEL_ACCREDITATION_COMPLETED)
- [x] Phase 1 committee attestation contract preserved (requireModelAuditCommitteeAttestation, modelAuditCommitteeAttestation)
- [x] Phase 1 training authority attestation contract preserved (requireTrainingAuthorityInitializerAttestation, trainingAuthorityInitializerAttestation)
- [x] SLASH_REASON uses TRAINING_WINDOW_OUT_OF_BOUNDS (not TRANSCRIPT_EXPIRATION_OUT_OF_BOUNDS)
- [x] Ban policy uses banMalformedOrOutOfOrderTrainingClaims (not banMalformedOrOutOfOrderCredentialClaims)
