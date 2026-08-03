# Track 86 PQ Health Insurance Claim Auditing Gating Extensions Test Plan

## Branch
`feature/track86-extensions`

## Scope
Phase 2 extensions to PQC Health Insurance Claim Auditing Gating Hub and ZK Insurance Claim Validator.

## Files
- `ai-platform/server/lib/hsm-adapter/pqc-health-insurance-claim-auditing-gating-hub.cjs`
- `ai-platform/server/lib/hsm-adapter/zk-insurance-claim-validator.cjs`
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-health-insurance-claim-auditing-gating-extensions.test.cjs`

## Level 1 — Deterministic

- [x] `node -c` on all changed files
- [x] `npm test` — 69 tests pass (15 existing + 54 new)
- [x] SimpleBeacon gate scan: PASS

## Level 2 — Behavioral

- [x] Batch pool initialization with mixed valid/invalid requests
- [x] Billing sequence depth rebalancing (increase/decrease)
- [x] Committee signature aggregation with quorum enforcement
- [x] Pool cancellation (rejects accredited/settled pools)
- [x] Cross-chain settlement with chain mismatch detection
- [x] HW-SNARK proof generation with pool validation
- [x] Batch claim audit verification with per-claim results
- [x] Slashing window validation (within/outside bounds)
- [x] tFHE proof aggregation with banned-peer rejection (UNIQUE: tFheProof, not partialSignature)
- [x] Slash event recording with reason codes
- [x] Summary statistics (getStats)

## Level 3 — Reflection

- [x] Logic mirrors Track 73-85 extension pattern
- [x] No ghost files or hallucinated API paths
- [x] Insurance-specific terminology throughout (INSURANCEGATE, INSURANCECLAIM, billingSequenceDepth, claimWindowSeconds, etc.)
- [x] 14 new hsm_igate_* metrics added to both initial values and help definitions
- [x] 3 existing hsm_insurance_* / hsm_zk_claim_audit_* / hsm_actuarial_* baseline counters remain untouched
- [x] Default maxBillingSequenceDepth correctly set to 24 (SAME as education template — no fix needed)
- [x] Default maxClaimWindowSeconds correctly set to 5184000 (60 days, not 31536000 from template)
- [x] Phase 1 event contract preserved (INSURANCE_GATING_POOL_INITIALIZED, ZK_CLAIM_AUDIT_VERIFIED, ACTUARIAL_ACCREDITATION_COMPLETED)
- [x] Phase 1 committee attestation contract preserved (requireActuarialCommitteeAttestation, actuarialCommitteeAttestation)
- [x] Phase 1 insurance authority attestation contract preserved (requireInsuranceAuthorityInitializerAttestation, insuranceAuthorityInitializerAttestation)
- [x] SLASH_REASON uses CLAIM_WINDOW_OUT_OF_BOUNDS (not TRANSCRIPT_EXPIRATION_OUT_OF_BOUNDS)
- [x] Ban policy uses banMalformedOrOutOfOrderClaims (shorter form, not banMalformedOrOutOfOrderCredentialClaims)
- [x] UNIQUE: tFheProof field preserved (not partialSignature) for homomorphic claim verification
