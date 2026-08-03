# Track 85 PQ Telecom Routing Gating Extensions Test Plan

## Branch
`feature/track85-extensions`

## Scope
Phase 2 extensions to PQC Telecom Routing Gating Hub and ZK Bandwidth Claim Validator.

## Files
- `ai-platform/server/lib/hsm-adapter/pqc-telecom-routing-gating-hub.cjs`
- `ai-platform/server/lib/hsm-adapter/zk-bandwidth-claim-validator.cjs`
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-telecom-routing-gating-extensions.test.cjs`

## Level 1 — Deterministic

- [x] `node -c` on all changed files
- [x] `npm test` — 69 tests pass (15 existing + 54 new)
- [x] SimpleBeacon gate scan: PASS

## Level 2 — Behavioral

- [x] Batch pool initialization with mixed valid/invalid requests
- [x] Network routing depth rebalancing (increase/decrease)
- [x] Committee signature aggregation with quorum enforcement
- [x] Pool cancellation (rejects accredited/settled pools)
- [x] Cross-chain settlement with chain mismatch detection
- [x] HW-SNARK proof generation with pool validation
- [x] Batch bandwidth claim verification with per-claim results
- [x] Slashing window validation (within/outside bounds)
- [x] Blind signature aggregation with banned-peer rejection (UNIQUE: blindSignature, not partialSignature)
- [x] Slash event recording with reason codes
- [x] Summary statistics (getStats)

## Level 3 — Reflection

- [x] Logic mirrors Track 73-84 extension pattern
- [x] No ghost files or hallucinated API paths
- [x] Telecom-specific terminology throughout (TELECOMGATE, TELECOMCLAIM, networkRoutingDepth, allocationWindowSeconds, etc.)
- [x] 14 new hsm_cgate_* metrics added to both initial values and help definitions
- [x] 3 existing hsm_telecom_* / hsm_zk_bandwidth_* / hsm_routing_* baseline counters remain untouched
- [x] Default maxNetworkRoutingDepth correctly set to 32 (not 24 from education template)
- [x] Default maxAllocationWindowSeconds correctly set to 2592000 (30 days, not 31536000 from template)
- [x] Phase 1 event contract preserved (TELECOM_ROUTING_POOL_INITIALIZED, ZK_BANDWIDTH_CLAIM_VERIFIED, ROUTING_ACCREDITATION_COMPLETED)
- [x] Phase 1 committee attestation contract preserved (requireRoutingCommitteeAttestation, routingCommitteeAttestation)
- [x] Phase 1 carrier endpoint attestation contract preserved (requireCarrierEndpointInitializerAttestation, carrierEndpointInitializerAttestation)
- [x] SLASH_REASON uses ALLOCATION_WINDOW_OUT_OF_BOUNDS (not TRANSCRIPT_EXPIRATION_OUT_OF_BOUNDS)
- [x] Ban policy uses banMalformedOrOutOfOrderTelecomClaims (not banMalformedOrOutOfOrderCredentialClaims)
- [x] UNIQUE: blindSignature field preserved (not partialSignature) for telecom privacy
