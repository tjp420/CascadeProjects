# Track 78 PQ Financial Derivatives Gating Test Plan

## Branch
`feature/track78-extensions`

## Scope
Phase 2 extensions to PQC Financial Derivatives Gating Hub and ZK Derivative Claim Validator.

## Files
- `ai-platform/server/lib/hsm-adapter/pqc-financial-derivatives-gating-hub.cjs`
- `ai-platform/server/lib/hsm-adapter/zk-derivative-claim-validator.cjs`
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-financial-derivatives-gating-extensions.test.cjs`

## Level 1 — Deterministic

- [x] `node -c` on all changed files
- [x] `npm test` — 69 tests pass (15 existing + 54 new)
- [x] SimpleBeacon gate scan: PASS

## Level 2 — Behavioral

- [x] Batch pool initialization with mixed valid/invalid requests
- [x] Risk metric depth rebalancing (increase/decrease)
- [x] Committee signature aggregation with quorum enforcement
- [x] Pool cancellation (rejects accredited/settled pools)
- [x] Cross-chain settlement with chain mismatch detection
- [x] HW-SNARK proof generation with pool validation
- [x] Batch derivative claim verification with per-claim results
- [x] Slashing window validation (within/outside bounds)
- [x] Partial signature aggregation with banned-peer rejection
- [x] Slash event recording with reason codes
- [x] Summary statistics (getStats)

## Level 3 — Reflection

- [x] Logic mirrors Track 73/74/75/76/77 extension pattern
- [x] No ghost files or hallucinated API paths
- [x] Financial-derivatives-specific terminology throughout (DERIVGATE, DERIVCLAIM, riskMetricDepth, etc.)
- [x] 14 new hsm_dgate_* metrics added to both initial values and help definitions
- [x] 3 existing hsm_derivative_* / hsm_zk_derivative_* / hsm_counterparty_risk_* baseline counters remain untouched
- [x] Default maxRiskMetricDepth correctly set to 32 (not 24 from education template)
- [x] Default maxContractExpirationSeconds correctly set to 31536000 (365 days)
- [x] Phase 1 event contract preserved (COUNTERPARTY_RISK_ACCREDITATION_COMPLETED, ZK_DERIVATIVE_CLAIM_VERIFIED, DERIVATIVE_GATING_POOL_INITIALIZED)
- [x] Phase 1 committee attestation contract preserved (requireRiskCommitteeAttestation, riskCommitteeAttestation, DERIVGATE_RISK_COMMITTEE_UNATTESTED, DERIVGATE_RISK_COMMITTEE_ATTESTATION_MISSING)
- [x] SLASH_REASON uses CONTRACT_EXPIRATION_OUT_OF_BOUNDS (not TRANSCRIPT_EXPIRATION_OUT_OF_BOUNDS)
