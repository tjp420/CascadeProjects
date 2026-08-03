# test_plan.md — Track 105: Decentralized Identity Proof Gating UI

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Add dashboard UI and REST endpoints for `pqDecentralizedIdentityProofGating` policy administration and telemetry |
| Author (Builder) | Devin |
| Date | 2026-08-03 |
| Branch | `feat/track105-decentralized-identity-gating-ui` |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/routes/hsm-vault-routes.cjs`
- `ai-platform/web/dashboard/js-es2018/components/DecentralizedIdentityGatingDashboard.js` (new)
- `ai-platform/web/dashboard/js-es2018/views/AdminPanelView.js`
- `ai-platform/server/lib/__tests__/hsm-vault-decentralized-identity-routes.test.cjs` (new)

### APIs / routes

- `GET  /api/hsm/vault/decentralized-identity/policy`
- `POST /api/hsm/vault/decentralized-identity/policy/validate`
- `GET  /api/hsm/vault/decentralized-identity/telemetry`

### UI / IDE surfaces

- HSM dashboard admin panel telemetry grid (`#admin-telemetry-grid`)
- New `DecentralizedIdentityGatingDashboard` card with policy form and telemetry counters

---

## Level 1 — Deterministic

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on new/changed `.cjs` | `node -c <file>` | [ ] |
| L1-02 | New route tests | `cd ai-platform && npx jest hsm-vault-decentralized-identity-routes` | [ ] |
| L1-03 | Existing HSM route tests still pass | `cd ai-platform && npx jest hsm-vault` | [ ] |
| L1-04 | SimpleBeacon gate | `npx simplebeacon scan --full --gate --format json` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | GET policy returns defaults | `GET /api/hsm/vault/decentralized-identity/policy` | JSON with all Track 105 policy fields and bounds | [ ] |
| L2-02 | POST valid policy returns 200 | `POST .../policy/validate` with valid fields | `{ valid: true }` | [ ] |
| L2-03 | POST invalid `identityQuorum` returns 400 | `POST .../policy/validate` with `identityQuorum: 5` | `400 Bad Request` with `POLICY_VIOLATION_BLOCKED` | [ ] |
| L2-04 | POST invalid `pqcSignatureScheme` returns 400 | `POST .../policy/validate` with `pqcSignatureScheme: 'falcon-512'` | `400 Bad Request` with `POLICY_VIOLATION_BLOCKED` | [ ] |
| L2-05 | GET telemetry returns counters | `GET /api/hsm/vault/decentralized-identity/telemetry` | JSON with `hsm_didgate_*` values | [ ] |
| L2-06 | Dashboard card renders | Open `/dashboard/admin` grid | Card with form and telemetry tiles visible | [ ] |
| L2-07 | Form validation reflects backend | Submit invalid form values | Error message from `POLICY_VIOLATION_BLOCKED` shown | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Missing `majorityFingerprint` — not applicable (policy-only) | N/A | [ ] |
| L3-02 | Admin panel still mounts other telemetry cards | Other dashboard cards load | [ ] |
| L3-03 | Form field names match `crypto-policy-schema.json` | `identityQuorum`, `revocationWindowSeconds`, etc. | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No secrets in form defaults or mock payloads | [ ] |
| S-02 | Only admin-authenticated requests served (existing auth middleware) | [ ] |

---

## Approval

- [x] User approved this plan (prior message)
