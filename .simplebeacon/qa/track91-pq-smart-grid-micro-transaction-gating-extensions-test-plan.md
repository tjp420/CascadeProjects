# Track 91 PQ Smart-Grid Micro-Transaction Gating Extensions Test Plan

## Branch
`feature/track91-extensions`

## Scope
Phase 2 extensions to PQC Smart-Grid Micro-Transaction Gating Hub and ZK Micro-Transaction Claim Validator.

## Files
- `ai-platform/server/lib/hsm-adapter/pqc-smart-grid-micro-transaction-gating-hub.cjs`
- `ai-platform/server/lib/hsm-adapter/zk-micro-transaction-claim-validator.cjs`
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-smart-grid-micro-transaction-gating-extensions.test.cjs`

## Level 1 — Deterministic

- [x] `node -c` on all changed files
- [x] `npm test` — 69 tests pass (15 existing + 54 new)
- [x] SimpleBeacon gate scan: PASS

## Level 2 — Behavioral

- [x] Batch pool initialization with mixed valid/invalid requests
- [x] Consumption chain depth rebalancing (increase/decrease)
- [x] Committee signature aggregation with quorum enforcement (minGridOperatorQuorum = 5)
- [x] Pool cancellation (rejects accredited/settled pools)
- [x] Cross-chain settlement with chain mismatch detection
- [x] HW-SNARK proof generation with pool validation
- [x] Batch micro-transaction claim verification with per-claim results
- [x] Slashing window validation (within/outside bounds)
- [x] Blind threshold signature aggregation with banned-peer rejection (UNIQUE: blindThresholdSignature, not partialSignature)
- [x] Slash event recording with reason codes
- [x] Summary statistics (getStats)

## Level 3 — Reflection

- [x] Logic mirrors Track 73-90 extension pattern
- [x] No ghost files or hallucinated API paths
- [x] Smart-grid-specific terminology throughout (SMARTGRIDGATE, SMARTGRIDCLAIM, consumptionChainDepth, transactionWindowSeconds, etc.)
- [x] 14 new hsm_sggate_* metrics added to both initial values and help definitions
- [x] 3 existing hsm_smartgrid_* / hsm_zk_micro_transaction_* / hsm_load_balance_* baseline counters remain untouched
- [x] Default maxConsumptionChainDepth correctly set to 18 (not 24 from education template)
- [x] Default maxTransactionWindowSeconds correctly set to 86400 (1 day — SHORTEST window yet, not 31536000 from education template)
- [x] Default minGridOperatorQuorum correctly set to 5 (not 3 from education template)
- [x] Phase 1 event contract preserved (SMARTGRID_GATING_POOL_INITIALIZED, ZK_MICRO_TRANSACTION_CLAIM_VERIFIED, LOAD_BALANCE_ACCREDITATION_COMPLETED)
- [x] Phase 1 committee attestation contract preserved (requireLoadBalanceOversightCommitteeAttestation, loadBalanceOversightCommitteeAttestation)
- [x] Phase 1 grid authority attestation contract preserved (requireGridAuthorityInitializerAttestation, gridAuthorityInitializerAttestation)
- [x] SLASH_REASON uses TRANSACTION_WINDOW_OUT_OF_BOUNDS (not TRANSCRIPT_EXPIRATION_OUT_OF_BOUNDS)
- [x] Ban policy uses banMalformedOrOutOfOrderMicroTransactionClaims (not banMalformedOrOutOfOrderCredentialClaims)
- [x] UNIQUE: blindThresholdSignature field preserved (not partialSignature) for prosumer privacy + multi-operator authorization
