# test_plan.md

> Copy to `.simplebeacon/qa/test_plan.md` and fill before Builder writes feature code.
> User approval required unless the task explicitly includes an approved plan.

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Regional Replication Router — cross-zone scan report & telemetry sync |
| Author (Builder) | Devin |
| Date | 2026-08-07 |
| Branch | feature/regional-replication-router |
| Packages touched | ai-platform (server backend) |

## Scope

### Files in scope

- `ai-platform/server/lib/regional-replication-router.cjs` (NEW — core router class)
- `ai-platform/server/lib/__tests__/regional-replication-router.test.cjs` (NEW — unit tests)
- `ai-platform/server/routes/replication-routes.cjs` (NEW — Express route handler)
- `ai-platform/server/index.cjs` (mount route)

### APIs / routes

- `POST /api/replication/sync` — trigger a sync to one or all zones
- `GET  /api/replication/status` — get replication status for all zones
- `GET  /api/replication/status/:zone` — get per-zone replication status
- `POST /api/replication/resolve-conflict` — manually resolve a conflict

### UI / IDE surfaces

- [ ] Sidebar webview
- [ ] Main dashboard iframe / address bar
- [ ] Welcome / main window panel
- [ ] Simple Browser / external browser
- N/A — backend-only feature

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on regional-replication-router.cjs | `node -c ai-platform/server/lib/regional-replication-router.cjs` | [ ] |
| L1-02 | Syntax on replication-routes.cjs | `node -c ai-platform/server/routes/replication-routes.cjs` | [ ] |
| L1-03 | Syntax on index.cjs | `node -c ai-platform/server/index.cjs` | [ ] |
| L1-04 | Unit tests pass | `node --test ai-platform/server/lib/__tests__/regional-replication-router.test.cjs` | [ ] |
| L1-05 | SimpleBeacon gate (full) | `npx simplebeacon scan --full --gate --format json` | [ ] |
| L1-06 | No secrets in diff | Manual / gate token rules | [ ] |
| L1-07 | npm audit (no deps changed — skip) | N/A | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Router initializes with default zones | Create router with no config | Three zones (us-east, eu-west, ap-southeast) are registered | [ ] |
| L2-02 | Sync payload to a single zone | Call sync() with target zone and payload | Payload is queued, sync attempt recorded, status updated | [ ] |
| L2-03 | Sync to all zones | Call syncAll() with payload | All zones receive the payload, statuses updated | [ ] |
| L2-04 | Retry on transient failure | Mock fetch to fail once then succeed | Router retries with backoff, sync eventually succeeds | [ ] |
| L2-05 | Conflict detection | Sync same payload version to two zones with different content | Conflict is detected and recorded with both versions | [ ] |
| L2-06 | Conflict resolution (latest-wins) | Resolve conflict with LATEST_WINS strategy | Conflict is resolved, winning version is propagated | [ ] |
| L2-07 | Status endpoint returns all zones | Call getStatus() | Returns map of zone → { lastSync, status, pending, conflicts } | [ ] |
| L2-08 | Max retries exhausted | Mock fetch to always fail | Router exhausts retries, marks zone as failed, records error | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Empty payload | Router rejects empty payload with validation error | [ ] |
| L3-02 | Unknown zone | Router rejects sync to unregistered zone with error | [ ] |
| L3-03 | Concurrent syncs to same zone | No race condition; syncs are queued sequentially | [ ] |
| L3-04 | Zone endpoint unreachable | Router marks zone as degraded after max retries | [ ] |
| L3-05 | Large payload (>1MB) | Router handles large payloads without blocking event loop | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No credentials / PII in logs or commits | [ ] |
| S-02 | Zone endpoints use HTTPS only | [ ] |
| S-03 | API key per zone stored in env vars, not hardcoded | [ ] |
| S-04 | Route handlers use authenticate middleware | [ ] |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________
