# Track 75 PQ Energy Certificate Gating Test Plan

## Branch
`feature/track75-extensions`

## Scope
Phase 2 extensions to PQC Energy Certificate Gating Hub and ZK Energy Claim Validator.

## Files
- `ai-platform/server/lib/hsm-adapter/pqc-energy-certificate-gating-hub.cjs`
- `ai-platform/server/lib/hsm-adapter/zk-energy-claim-validator.cjs`
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-energy-certificate-gating-extensions.test.cjs`

## Level 1 — Deterministic

- [x] `node -c` on all changed files
- [x] `npm test` — 69 tests pass (15 existing + 54 new)
- [x] SimpleBeacon gate scan: PASS

## Level 2 — Behavioral

- [x] Batch pool initialization with mixed valid/invalid requests
- [x] Production metric depth rebalancing (increase/decrease)
- [x] Committee signature aggregation with quorum enforcement
- [x] Pool cancellation (rejects accredited/settled pools)
- [x] Cross-chain settlement with chain mismatch detection
- [x] HW-SNARK proof generation with pool validation
- [x] Batch energy claim verification with per-claim results
- [x] Slashing window validation (within/outside bounds)
- [x] Partial signature aggregation with banned-peer rejection
- [x] Slash event recording with reason codes
- [x] Summary statistics (getStats)

## Level 3 — Reflection

- [x] Logic mirrors Track 73/74 extension pattern
- [x] No ghost files or hallucinated API paths
- [x] Energy-specific terminology throughout (ENERGYGATE, ENERGYCLAIM, productionMetricDepth, etc.)
- [x] 14 new hsm_egate_* metrics added to both initial values and help definitions
- [x] 2 existing hsm_energy_* counters remain untouched
