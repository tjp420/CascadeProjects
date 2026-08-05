# test_plan.md

> OpenAPI Specification Hardening — Track 114-121 REST route consolidation

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | OpenAPI Specification Hardening for Tracks 114-121 + SIEM telemetry |
| Author (Builder) | Devin |
| Date | 2026-08-04 |
| Branch | feat/openapi-spec-hardening |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/api/openapi.yaml` (modified — expand from 8 Track 79 endpoints to include Tracks 114-121 + SIEM)
- `ai-platform/server/lib/hsm-adapter/__tests__/openapi-contract.test.cjs` (new — schema contract tests)

### APIs / routes

**Track 114-121 governance triplets (7 tracks × 3 endpoints = 21 routes):**

| Track | Route prefix | Endpoints |
|-------|-------------|-----------|
| 114 | `/cluster-isolation` | GET /policy, POST /policy/validate, GET /telemetry |
| 115 | `/bft-shard-sync` | GET /policy, POST /policy/validate, GET /telemetry |
| 117 | `/bft-shard-sync` | (same as 115 — verify track mapping) |
| 118 | `/distributed-consensus-coordinator` | GET /policy, POST /policy/validate, GET /telemetry |
| 119 | `/cross-cluster-migration` | GET /policy, POST /policy/validate, GET /telemetry |
| 120 | `/cluster-key-reconciliation` | GET /policy, POST /policy/validate, GET /telemetry |
| 121 | `/multiparty-re-keying` | GET /policy, POST /policy/validate, GET /telemetry |

**SIEM / audit telemetry routes (from audit-routes.cjs):**

| Route | Method | Purpose |
|-------|--------|---------|
| `/audit/telemetry` | GET | SIEM telemetry counters |
| `/audit/log` | GET | Audit log entries |
| `/audit/export` | GET | Export audit chain |
| `/audit/verify-integrity` | GET | Verify hash chain integrity |
| `/audit/stats` | GET | Audit statistics |

**Total: 26 new endpoints to document in OpenAPI spec**

### UI / IDE surfaces

- [ ] Sidebar webview
- [ ] Main dashboard iframe / address bar
- [ ] Welcome / main window panel
- [ ] Simple Browser / external browser

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on changed JS/CJS | `node -c <file>` | [ ] |
| L1-02 | ai-platform tests (if touched) | `cd ai-platform && npm test` | [ ] |
| L1-03 | OpenAPI YAML validity | `npx js-yaml ai-platform/api/openapi.yaml` parses without error | [ ] |
| L1-04 | SimpleBeacon gate (full) | `npx simplebeacon scan --full --gate --format json` | [ ] |
| L1-05 | No secrets in diff | Manual / gate token rules | [ ] |
| L1-06 | OpenAPI contract tests | `npx jest --testPathPatterns openapi-contract` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | OpenAPI spec covers all 21 Track 114-121 endpoints | Parse openapi.yaml, verify all 7 governance triplets have paths | All 21 paths present with correct methods | [ ] |
| L2-02 | OpenAPI spec covers all 5 SIEM audit endpoints | Parse openapi.yaml, verify audit routes have paths | All 5 paths present with correct methods | [ ] |
| L2-03 | Policy endpoint schema matches actual response | Compare OpenAPI schema for GET /policy against actual route handler response | Schema fields match (success, orgId, policy) | [ ] |
| L2-04 | Validate endpoint schema matches actual response | Compare OpenAPI schema for POST /policy/validate against actual route handler response | Schema fields match (success, valid, error) | [ ] |
| L2-05 | Telemetry endpoint schema matches actual response | Compare OpenAPI schema for GET /telemetry against actual route handler response | Schema fields match (success, orgId, telemetry) | [ ] |
| L2-06 | Error response schema matches POLICY_VIOLATION_BLOCKED | Verify 400 response schema for validate endpoint | Error code and message fields present | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Existing Track 79 endpoints unchanged | Verify original 8 paths still present and correct | All 8 original paths preserved | [ ] |
| L3-02 | OpenAPI tags organize endpoints by track | Verify each governance triplet has a unique tag | 7 track tags + 1 SIEM tag present | [ ] |
| L3-03 | OpenAPI security scheme applied to all new paths | Verify all new paths require admin:all authorization | security field present on all new paths | [ ] |
| L3-04 | No ghost paths in OpenAPI spec | Verify every path in spec corresponds to a real route handler | No hallucinated or non-existent paths | [ ] |
| L3-05 | Schema contract test catches response drift | If route handler response changes, contract test fails | Test validates actual response shape against schema | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No credentials / PII in OpenAPI spec examples | [ ] |
| S-02 | All new paths require authorization (admin:all or oauth2) | [ ] |
| S-03 | No real tenant IDs, node IDs, or key material in schema examples | [ ] |

---

## Implementation Strategy

### Phase 1: OpenAPI Spec Expansion (openapi.yaml)

1. Add 7 new tags for Tracks 114-121 (one per governance track)
2. Add 1 new tag for SIEM/Audit telemetry
3. Add 21 new path objects (7 governance triplets × 3 endpoints each)
4. Add 5 new path objects (SIEM audit routes)
5. Add reusable schemas:
   - `PolicyResponse` (success, orgId, policy)
   - `PolicyValidateRequest` (config fields)
   - `PolicyValidateResponse` (success, valid)
   - `PolicyViolationError` (error, message)
   - `TelemetryResponse` (success, orgId, telemetry)
   - `AuditTelemetryResponse` (success, telemetry counters)
6. Add security scheme for admin:all (if not already present)

### Phase 2: Schema Contract Tests (openapi-contract.test.cjs)

1. Parse openapi.yaml with js-yaml
2. For each of the 26 new endpoints:
   - Verify path exists in spec
   - Verify method matches
   - Verify response schema is defined
3. For 3 representative endpoints (one policy, one validate, one telemetry):
   - Make actual HTTP request via supertest
   - Compare response body fields against OpenAPI schema properties
4. Verify no ghost paths (every spec path has a matching route handler)
5. Verify all new paths have security requirements

### Broom Strategy

- Only 2 files touched (openapi.yaml + openapi-contract.test.cjs)
- No new modules or dependencies
- Reuses existing js-yaml and supertest packages already in the project

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________
