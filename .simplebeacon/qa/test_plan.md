# Test Plan: Track 32 Vault REST Route Integration

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Track 32 ring-gating REST endpoints on the vault router |
| Author (Builder) | Devin |
| Date | 2026-08-03 |
| Branch | `feat/track32-rest-routes` |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/lib/hsm-adapter/hsm-vault-routes.cjs` *(extend with ring-gating endpoints)*
- `ai-platform/server/lib/hsm-adapter/__tests__/hsm-vault-ring-gating-routes.test.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/__tests__/run-all-tracks.cjs` *(registration)*

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/vault/ring-gating/pool` | Initialize ring pool (OPEN) |
| POST | `/api/vault/ring-gating/:poolId/keys` | Collect anonymity set |
| POST | `/api/vault/ring-gating/:poolId/validate` | Validate ZK ring proof |
| POST | `/api/vault/ring-gating/:poolId/accredit` | Finalize accreditation |
| GET  | `/api/vault/ring-gating/telemetry` | Emit non-sensitive counters |

---

## Level 1 — Deterministic

| ID | Check | Command | Pass |
|----|-------|---------|------|
| L1-01 | Routes syntax | `node -c ai-platform/server/lib/hsm-adapter/hsm-vault-routes.cjs` | [ ] |
| L1-02 | Track 32 route tests | `cd ai-platform && npx jest hsm-vault-ring-gating-routes --coverage=false` | [ ] |
| L1-03 | Parallel suite | `cd ai-platform && npm run test:parallel` | [ ] |
| L1-04 | SimpleBeacon gate | `node packages/simplebeacon-cli/bin/simplebeacon.js scan --gate` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Full happy path | POST /pool → /keys → /validate → /accredit | 201, 200, 200, 200 with `ACCREDITED` | [ ] |
| L2-02 | Out-of-order accredit | POST /pool → POST /accredit | 400 with `RINGGATE_INVALID_TRANSITION` | [ ] |
| L2-03 | Ring size below min | POST /pool → /keys (8 keys) → /validate | 400 with `RINGCLAIM_INVALID_ANONYMITY_SET_SIZE` | [ ] |
| L2-04 | Missing linkability | POST /pool → /keys (32) → /validate (no token) | 400 with `RINGCLAIM_UNATTESTED_LINKABILITY` | [ ] |
| L2-05 | Telemetry redaction | GET /telemetry | No raw keys, tokens, or linkability vectors | [ ] |

---

## Level 3 — Edge cases

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Unknown poolId on /keys | 404 | [ ] |
| L3-02 | Unknown poolId on /accredit | 404 | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | Telemetry never emits raw keys/tokens | [ ] |
| S-02 | No credentials in code | [ ] |

---

## Approval

- [x] User approved this plan
- Approved by: user  Date: 2026-08-03
