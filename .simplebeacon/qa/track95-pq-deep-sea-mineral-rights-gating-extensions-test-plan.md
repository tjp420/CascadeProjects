# Track 95 PQ Deep-Sea Mineral Rights Gating Extensions Test Plan

## Branch
`feature/track95-extensions`

## Scope
Phase 2 extensions to PQC Deep-Sea Mineral Rights Gating Hub and ZK Extraction Claim Validator.

## Files
- `ai-platform/server/lib/hsm-adapter/pqc-deep-sea-mineral-rights-gating-hub.cjs`
- `ai-platform/server/lib/hsm-adapter/zk-extraction-claim-validator.cjs`
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-deep-sea-mineral-rights-gating-extensions.test.cjs`

## Level 1 — Deterministic

- [x] `node -c` on all changed files
- [x] `npm test` — 69 tests pass (15 existing + 54 new)
- [x] SimpleBeacon gate scan: PASS

## Level 2 — Behavioral

- [x] Batch pool initialization with mixed valid/invalid requests
- [x] Extraction chain depth rebalancing (increase/decrease)
- [x] Committee signature aggregation with quorum enforcement (minSovereignQuorum = 6)
- [x] Pool cancellation (rejects accredited/settled pools)
- [x] Cross-chain settlement with chain mismatch detection
- [x] HW-SNARK proof generation with pool validation
- [x] Batch extraction claim verification with per-claim results
- [x] Slashing window validation (within/outside bounds)
- [x] ABE key policy digest aggregation with banned-peer rejection (UNIQUE: abeKeyPolicyDigest, not partialSignature — third non-signature primitive)
- [x] Slash event recording with reason codes
- [x] Summary statistics (getStats)

## Level 3 — Reflection

- [x] Logic mirrors Track 73-94 extension pattern
- [x] No ghost files or hallucinated API paths
- [x] Seabed-specific terminology throughout (SEABEDGATE, SEABEDCLAIM, extractionChainDepth, leaseWindowSeconds, etc.)
- [x] 14 new hsm_sgate_* metrics added to both initial values and help definitions
- [x] 3 existing hsm_seabed_* / hsm_zk_extraction_* / hsm_lease_* baseline counters remain untouched
- [x] Default maxExtractionChainDepth correctly set to 15 (not 24 from education template)
- [x] Default maxLeaseWindowSeconds correctly set to 31536000 (1 year — same as education template, no fix needed)
- [x] Default minSovereignQuorum correctly set to 6 (not 3 from education template — highest quorum in series)
- [x] Phase 1 event contract preserved (SEABED_GATING_POOL_INITIALIZED, ZK_EXTRACTION_CLAIM_VERIFIED, LEASE_ACCREDITATION_COMPLETED)
- [x] Phase 1 committee attestation contract preserved (requireSeabedOversightCommitteeAttestation, seabedOversightCommitteeAttestation)
- [x] Phase 1 ISA authority attestation contract preserved (requireIsaAuthorityInitializerAttestation, isaAuthorityInitializerAttestation)
- [x] SLASH_REASON uses LEASE_WINDOW_OUT_OF_BOUNDS (not TRANSCRIPT_EXPIRATION_OUT_OF_BOUNDS)
- [x] Ban policy uses banMalformedOrOutOfOrderExtractionClaims (not banMalformedOrOutOfOrderCredentialClaims)
- [x] UNIQUE: abeKeyPolicyDigest field preserved (not partialSignature) — third non-signature cryptographic primitive for attribute-based access control over encrypted extraction claims
