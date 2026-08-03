# Track 93 PQ Cultural Heritage Provenance Gating Extensions Test Plan

## Branch
`feature/track93-extensions`

## Scope
Phase 2 extensions to PQC Cultural Heritage Provenance Gating Hub and ZK Authentication Claim Validator.

## Files
- `ai-platform/server/lib/hsm-adapter/pqc-cultural-heritage-provenance-gating-hub.cjs`
- `ai-platform/server/lib/hsm-adapter/zk-authentication-claim-validator.cjs`
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-cultural-heritage-provenance-gating-extensions.test.cjs`

## Level 1 — Deterministic

- [x] `node -c` on all changed files
- [x] `npm test` — 69 tests pass (15 existing + 54 new)
- [x] SimpleBeacon gate scan: PASS

## Level 2 — Behavioral

- [x] Batch pool initialization with mixed valid/invalid requests
- [x] Provenance chain depth rebalancing (increase/decrease)
- [x] Committee signature aggregation with quorum enforcement (minAuthenticationQuorum = 4)
- [x] Pool cancellation (rejects accredited/settled pools)
- [x] Cross-chain settlement with chain mismatch detection
- [x] HW-SNARK proof generation with pool validation
- [x] Batch authentication claim verification with per-claim results
- [x] Slashing window validation (within/outside bounds)
- [x] Fuzzy match proof aggregation with banned-peer rejection (UNIQUE: fuzzyMatchProofHash + fuzzyMatchThreshold, not partialSignature — first fuzzy verification primitive)
- [x] Slash event recording with reason codes
- [x] Summary statistics (getStats)

## Level 3 — Reflection

- [x] Logic mirrors Track 73-92 extension pattern
- [x] No ghost files or hallucinated API paths
- [x] Heritage-specific terminology throughout (HERITAGEGATE, HERITAGECLAIM, provenanceChainDepth, authenticationWindowSeconds, etc.)
- [x] 14 new hsm_hgate_* metrics added to both initial values and help definitions
- [x] 3 existing hsm_heritage_* / hsm_zk_authentication_* / hsm_provenance_* baseline counters remain untouched
- [x] Default maxProvenanceChainDepth correctly set to 20 (not 24 from education template)
- [x] Default maxAuthenticationWindowSeconds correctly set to 15552000 (180 days, not 31536000 from education template)
- [x] Default minAuthenticationQuorum correctly set to 4 (not 3 from education template)
- [x] Phase 1 event contract preserved (HERITAGE_GATING_POOL_INITIALIZED, ZK_AUTHENTICATION_CLAIM_VERIFIED, PROVENANCE_ACCREDITATION_COMPLETED)
- [x] Phase 1 committee attestation contract preserved (requireCulturalHeritageOversightCommitteeAttestation, culturalHeritageOversightCommitteeAttestation)
- [x] Phase 1 UNESCO authority attestation contract preserved (requireUnescoAuthorityInitializerAttestation, unescoAuthorityInitializerAttestation)
- [x] SLASH_REASON uses AUTHENTICATION_WINDOW_OUT_OF_BOUNDS (not TRANSCRIPT_EXPIRATION_OUT_OF_BOUNDS)
- [x] Ban policy uses banMalformedOrOutOfOrderAuthenticationClaims (not banMalformedOrOutOfOrderCredentialClaims)
- [x] UNIQUE: fuzzyMatchProofHash + fuzzyMatchThreshold field preserved (not partialSignature) — first fuzzy verification primitive for aged/restored artwork authentication
