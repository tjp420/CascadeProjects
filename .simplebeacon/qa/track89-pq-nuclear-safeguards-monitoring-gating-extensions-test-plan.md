# Track 89 PQ Nuclear Safeguards Monitoring Gating Extensions Test Plan

## Branch
`feature/track89-extensions`

## Scope
Phase 2 extensions to PQC Nuclear Safeguards Monitoring Gating Hub and ZK Safeguards Claim Validator.

## Files
- `ai-platform/server/lib/hsm-adapter/pqc-nuclear-safeguards-monitoring-gating-hub.cjs`
- `ai-platform/server/lib/hsm-adapter/zk-safeguards-claim-validator.cjs`
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-nuclear-safeguards-monitoring-gating-extensions.test.cjs`

## Level 1 — Deterministic

- [x] `node -c` on all changed files
- [x] `npm test` — 69 tests pass (15 existing + 54 new)
- [x] SimpleBeacon gate scan: PASS

## Level 2 — Behavioral

- [x] Batch pool initialization with mixed valid/invalid requests
- [x] Telemetry chain depth rebalancing (increase/decrease)
- [x] Committee signature aggregation with quorum enforcement (minSafeguardsQuorum = 6, HIGHEST quorum yet)
- [x] Pool cancellation (rejects accredited/settled pools)
- [x] Cross-chain settlement with chain mismatch detection
- [x] HW-SNARK proof generation with pool validation
- [x] Batch safeguards claim verification with per-claim results
- [x] Slashing window validation (within/outside bounds)
- [x] Threshold ring signature aggregation with banned-peer rejection (UNIQUE: thresholdRingSignature, not partialSignature)
- [x] Slash event recording with reason codes
- [x] Summary statistics (getStats)

## Level 3 — Reflection

- [x] Logic mirrors Track 73-88 extension pattern
- [x] No ghost files or hallucinated API paths
- [x] Nuclear-safeguards-specific terminology throughout (NUCLEARGATE, NUCLEARCLAIM, telemetryChainDepth, inspectionWindowSeconds, etc.)
- [x] 14 new hsm_ngate_* metrics added to both initial values and help definitions
- [x] 3 existing hsm_nuclear_* / hsm_zk_safeguards_* baseline counters remain untouched
- [x] Default maxTelemetryChainDepth correctly set to 12 (LOWEST depth yet, not 24 from education template)
- [x] Default maxInspectionWindowSeconds correctly set to 7776000 (90 days — SHORTEST window yet, not 31536000 from education template)
- [x] Default minSafeguardsQuorum correctly set to 6 (HIGHEST quorum yet, not 3 from education template)
- [x] Phase 1 event contract preserved (NUCLEAR_GATING_POOL_INITIALIZED, ZK_SAFEGUARDS_CLAIM_VERIFIED, NUCLEAR_ACCREDITATION_COMPLETED)
- [x] Phase 1 committee attestation contract preserved (requireNuclearOversightCommitteeAttestation, nuclearOversightCommitteeAttestation)
- [x] Phase 1 safeguards authority attestation contract preserved (requireSafeguardsAuthorityInitializerAttestation, safeguardsAuthorityInitializerAttestation)
- [x] SLASH_REASON uses INSPECTION_WINDOW_OUT_OF_BOUNDS (not TRANSCRIPT_EXPIRATION_OUT_OF_BOUNDS)
- [x] Ban policy uses banMalformedOrOutOfOrderSafeguardsClaims (not banMalformedOrOutOfOrderCredentialClaims)
- [x] UNIQUE: thresholdRingSignature field preserved (not partialSignature) for IAEA inspector anonymity
