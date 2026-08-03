# Track 92 PQ Global Health Epidemiological Surveillance Gating Extensions Test Plan

## Branch
`feature/track92-extensions`

## Scope
Phase 2 extensions to PQC Global Health Epidemiological Surveillance Gating Hub and ZK Epidemiological Claim Validator.

## Files
- `ai-platform/server/lib/hsm-adapter/pqc-global-health-epidemiological-surveillance-gating-hub.cjs`
- `ai-platform/server/lib/hsm-adapter/zk-epidemiological-claim-validator.cjs`
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-global-health-epidemiological-surveillance-gating-extensions.test.cjs`

## Level 1 — Deterministic

- [x] `node -c` on all changed files
- [x] `npm test` — 69 tests pass (15 existing + 54 new)
- [x] SimpleBeacon gate scan: PASS

## Level 2 — Behavioral

- [x] Batch pool initialization with mixed valid/invalid requests
- [x] Genomic chain depth rebalancing (increase/decrease)
- [x] Committee signature aggregation with quorum enforcement (minEpidemiologyQuorum = 5)
- [x] Pool cancellation (rejects accredited/settled pools)
- [x] Cross-chain settlement with chain mismatch detection
- [x] HW-SNARK proof generation with pool validation
- [x] Batch epidemiological claim verification with per-claim results
- [x] Slashing window validation (within/outside bounds)
- [x] Functional encryption key digest aggregation with banned-peer rejection (UNIQUE: functionalEncryptionKeyDigest, not partialSignature — first non-signature primitive)
- [x] Slash event recording with reason codes
- [x] Summary statistics (getStats)

## Level 3 — Reflection

- [x] Logic mirrors Track 73-91 extension pattern
- [x] No ghost files or hallucinated API paths
- [x] Epidemiological-specific terminology throughout (EPIGATE, EPICLAIM, genomicChainDepth, surveillanceWindowSeconds, etc.)
- [x] 14 new hsm_epigate_* metrics added to both initial values and help definitions
- [x] 3 existing hsm_epidemiology_* / hsm_zk_epidemiological_* / hsm_outbreak_* baseline counters remain untouched
- [x] Default maxGenomicChainDepth correctly set to 16 (not 24 from education template)
- [x] Default maxSurveillanceWindowSeconds correctly set to 604800 (7 days, not 31536000 from education template)
- [x] Default minEpidemiologyQuorum correctly set to 5 (not 3 from education template)
- [x] Phase 1 event contract preserved (EPIDEMIOLOGY_GATING_POOL_INITIALIZED, ZK_EPIDEMIOLOGICAL_CLAIM_VERIFIED, OUTBREAK_ACCREDITATION_COMPLETED)
- [x] Phase 1 committee attestation contract preserved (requireEpidemiologyOversightCommitteeAttestation, epidemiologyOversightCommitteeAttestation)
- [x] Phase 1 WHO authority attestation contract preserved (requireWhoAuthorityInitializerAttestation, whoAuthorityInitializerAttestation)
- [x] SLASH_REASON uses SURVEILLANCE_WINDOW_OUT_OF_BOUNDS (not TRANSCRIPT_EXPIRATION_OUT_OF_BOUNDS)
- [x] Ban policy uses banMalformedOrOutOfOrderEpidemiologicalClaims (not banMalformedOrOutOfOrderCredentialClaims)
- [x] UNIQUE: functionalEncryptionKeyDigest field preserved (not partialSignature) — first non-signature cryptographic primitive for aggregate statistics over encrypted patient data
