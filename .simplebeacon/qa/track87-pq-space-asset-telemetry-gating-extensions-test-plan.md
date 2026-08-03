# Track 87 PQ Space-Asset Telemetry Gating Extensions Test Plan

## Branch
`feature/track87-extensions`

## Scope
Phase 2 extensions to PQC Space-Asset Telemetry Gating Hub and ZK Orbital Slot Claim Validator.

## Files
- `ai-platform/server/lib/hsm-adapter/pqc-space-asset-telemetry-gating-hub.cjs`
- `ai-platform/server/lib/hsm-adapter/zk-orbital-slot-claim-validator.cjs`
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-space-asset-telemetry-gating-extensions.test.cjs`

## Level 1 — Deterministic

- [x] `node -c` on all changed files
- [x] `npm test` — 69 tests pass (15 existing + 54 new)
- [x] SimpleBeacon gate scan: PASS

## Level 2 — Behavioral

- [x] Batch pool initialization with mixed valid/invalid requests
- [x] Telemetry chain depth rebalancing (increase/decrease)
- [x] Committee signature aggregation with quorum enforcement (minOrbitalSlotQuorum = 5, higher than standard 3)
- [x] Pool cancellation (rejects accredited/settled pools)
- [x] Cross-chain settlement with chain mismatch detection
- [x] HW-SNARK proof generation with pool validation
- [x] Batch telemetry claim verification with per-claim results
- [x] Slashing window validation (within/outside bounds)
- [x] Threshold signature aggregation with banned-peer rejection (UNIQUE: thresholdSignature, not partialSignature)
- [x] Slash event recording with reason codes
- [x] Summary statistics (getStats)

## Level 3 — Reflection

- [x] Logic mirrors Track 73-86 extension pattern
- [x] No ghost files or hallucinated API paths
- [x] Space-asset-specific terminology throughout (SPACEGATE, SPACECLAIM, telemetryChainDepth, slotAllocationWindowSeconds, etc.)
- [x] 14 new hsm_sgate_* metrics added to both initial values and help definitions
- [x] 3 existing hsm_orbital_* / hsm_zk_telemetry_* baseline counters remain untouched
- [x] Default maxTelemetryChainDepth correctly set to 16 (not 24 from education template)
- [x] Default maxSlotAllocationWindowSeconds correctly set to 31536000 (SAME as education template — no fix needed)
- [x] Default minOrbitalSlotQuorum correctly set to 5 (higher than standard 3, reflecting orbital security requirements)
- [x] Phase 1 event contract preserved (ORBITAL_GATING_POOL_INITIALIZED, ZK_TELEMETRY_CLAIM_VERIFIED, ORBITAL_ACCREDITATION_COMPLETED)
- [x] Phase 1 committee attestation contract preserved (requireOrbitalOversightCommitteeAttestation, orbitalOversightCommitteeAttestation)
- [x] Phase 1 space authority attestation contract preserved (requireSpaceAuthorityInitializerAttestation, spaceAuthorityInitializerAttestation)
- [x] SLASH_REASON uses SLOT_WINDOW_OUT_OF_BOUNDS (not TRANSCRIPT_EXPIRATION_OUT_OF_BOUNDS)
- [x] Ban policy uses banMalformedOrOutOfOrderOrbitalClaims (not banMalformedOrOutOfOrderCredentialClaims)
- [x] UNIQUE: thresholdSignature field preserved (not partialSignature) for multi-party orbital slot verification
