# Test Plan: Track 31 REST Route Integration

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Expose Track 31 primitives via HSM vault REST routes |
| Author (Builder) | Devin |
| Date | 2026-08-03 |
| Branch | `feat/track31-rest-routes` |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/routes/hsm-vault-routes.cjs` *(append endpoints)*
- `ai-platform/server/lib/__tests__/hsm-vault-lookup-gating-routes.test.cjs` *(new)*

### APIs / routes

- `POST /api/vault/lookup-gating/pool` — create a lookup gating pool
- `POST /api/vault/lookup-gating/:poolId/query` — submit a blinded query
- `POST /api/vault/lookup-gating/:poolId/validate` — validate a ZK lookup claim
- `POST /api/vault/lookup-gating/:poolId/accredit` — finalize accreditation
- `GET /api/vault/lookup-gating/:poolId` — get pool status
- `GET /api/vault/lookup-gating/telemetry` — expose Track 31 telemetry counters

### UI / IDE surfaces

None.

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on route file | `node -c ai-platform/server/routes/hsm-vault-routes.cjs` | [ ] |
| L1-02 | Syntax on test file | `node -c ai-platform/server/lib/__tests__/hsm-vault-lookup-gating-routes.test.cjs` | [ ] |
| L1-03 | Track 31 route tests | `cd ai-platform && npx jest hsm-vault-lookup-gating-routes --coverage=false` | [ ] |
| L1-04 | Parallel orchestrator | `cd ai-platform && npm run test:parallel` | [ ] |
| L1-05 | Full SimpleBeacon gate | `node packages/simplebeacon-cli/bin/simplebeacon.js scan --gate` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Create pool | POST `/api/vault/lookup-gating/pool` | Returns `poolId` and `state: OPEN` | [ ] |
| L2-02 | Submit query | POST `.../:poolId/query` | Returns `state: QUERY_BLINDED` | [ ] |
| L2-03 | Validate proof | POST `.../:poolId/validate` with valid claim | Returns `state: PROOF_VALIDATED` | [ ] |
| L2-04 | Accredit | POST `.../:poolId/accredit` | Returns `state: ACCREDITED` | [ ] |
| L2-05 | Out-of-order blocked | `accredit` before validate | 400 LOOKUPGATE_INVALID_STATE | [ ] |
| L2-06 | Telemetry endpoint | GET `/api/vault/lookup-gating/telemetry` | Returns Track 31 counters | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Unknown pool | GET/POST on missing `poolId` | 404 not_found | [ ] |
| L3-02 | Validator rejects bad claim | POST validate with bad claim | 400 LOOKUPCLAIM_* | [ ] |
| L3-03 | No legacy route regressions | Existing `/api/vault` tests pass | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No credentials / PII in logs or commits | [ ] |
| S-02 | Admin authorization applied | [ ] |

---

## Approval

- [x] User approved this plan (or task included approved scope)
- Approved by: user  Date: 2026-08-03
