# test_plan.md — Track 61 Recursive Proof Aggregation API & Dashboard

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Wire RecursiveProofAggregationEngine into the REST API and dashboard telemetry |
| Author (Builder) | Devin |
| Date | 2026-08-03 |
| Branch | `feat/track61-recursive-proof-api` |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/routes/hsm-vault-routes.cjs` — new `/api/vault/recursive-aggregation/*` endpoints
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs` — `getRecursiveProofAggregationEngine()` getter / registry
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs` — add `hsm_recursive_*` counters and Prometheus section
- `ai-platform/server/lib/hsm-adapter/__tests__/hsm-vault-routes.test.cjs` or `recursive-proof-aggregation-routes.test.cjs` — new Supertest routes tests
- `ai-platform/web/dashboard/js-es2018/components/RecursiveProofAggregationDashboard.js` — new dashboard card
- `ai-platform/web/dashboard/js-es2018/services/recursiveProofService.js` — fetch service
- `ai-platform/web/dashboard/index.html` — add dashboard card container

### APIs / routes

- `POST /api/vault/recursive-aggregation/proof` — submitProof
- `POST /api/vault/recursive-aggregation/fold` — foldProofs
- `POST /api/vault/recursive-aggregation/aggregate/chain` — aggregateChain
- `POST /api/vault/recursive-aggregation/aggregate/tree` — aggregateTree
- `POST /api/vault/recursive-aggregation/verify` — verifyAggregation
- `GET /api/vault/recursive-aggregation/aggregations/:aggId` — getAggregation
- `GET /api/vault/recursive-aggregation/status` — expose `hsm_recursive_*` counters

### UI / IDE surfaces

- [ ] Main dashboard iframe / card

---

## Level 1 — Deterministic

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on changed JS/CJS | `node -c <file>` | [ ] |
| L1-02 | ai-platform tests | `cd ai-platform && npm test` | [ ] |
| L1-03 | SimpleBeacon gate (full) | `npx simplebeacon scan --full --gate --format json` | [ ] |
| L1-04 | No secrets in diff | Manual / gate token rules | [ ] |
| L1-05 | npm audit | `npm audit` | [ ] |

---

## Level 2 — Behavioral (Supertest)

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Submit a proof | `POST /api/vault/recursive-aggregation/proof` with `{ proofId, proofData }` | returns `success: true` and `proofId` | [ ] |
| L2-02 | Fold two proofs | `POST .../fold` with two previously submitted proofIds | returns folded `proofId` | [ ] |
| L2-03 | Chain aggregate | `POST .../aggregate/chain` with `proofIds` | returns `aggId` with status `COMPLETED` | [ ] |
| L2-04 | Tree aggregate | `POST .../aggregate/tree` with `proofIds` | returns `aggId` with status `COMPLETED` | [ ] |
| L2-05 | Verify aggregation | `POST .../verify` with `aggId` | returns `valid: true` | [ ] |
| L2-06 | Get aggregation | `GET .../aggregations/:aggId` | returns aggregation metadata | [ ] |
| L2-07 | Status endpoint | `GET .../status` | returns `hsm_recursive_*` counters grouped | [ ] |
| L2-08 | Missing engine | any endpoint with no registered engine | returns `503 coordinator_not_registered` style error | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Invalid proof ID | `submitProof` with empty `proofId` | `400 invalid_proof_id` | [ ] |
| L3-02 | Duplicate proof | `submitProof` same `proofId` twice | `400 proof_already_exists` | [ ] |
| L3-03 | Missing auth | endpoint without `admin:all` token | `401` or `403` | [ ] |
| L3-04 | Dashboard fetch | service polls status endpoint without leaking secrets | counters rendered | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No credentials / PII in logs or commits | [ ] |
| S-02 | Admin-only auth on all aggregation endpoints | [ ] |

---

## Approval

- [x] User approved this plan ("Implement the plan" in prior message)
