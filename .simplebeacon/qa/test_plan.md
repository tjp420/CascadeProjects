# Test Plan: Track 124 — Per-key / per-op reconciliation tenant isolation

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Port stash@{2} engine-level tenant isolation onto reconciliation, migration, and enclave sync; tag SIEM events with tenant |
| Author (Builder) | Cursor agent |
| Date | 2026-08-05 |
| Branch | feat/track124-reconciliation-isolation |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/lib/hsm-adapter/cluster-key-reconciliation-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/cross-cluster-migration-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/cross-enclave-state-sync.cjs`
- `ai-platform/server/lib/siem/siem-broker.cjs`
- Tests under `ai-platform/server/lib/hsm-adapter/__tests__/` and SIEM tests as needed

### Explicitly out of scope (already on main / Track 125)

- `crypto-policy-engine.cjs` gating policy blocks from stash (energy/biometric/… already present)
- Track 125 ZK claim counters in `hsm-metrics.cjs` (already present)
- Blind `git stash pop` of stash@{2} (context drift; patch does not apply)

### Gap vs current main

Main already has `validateTenantContext` imports and replication-tenant REST routes, but engines lack `_keyTenants` / `_ensureSameTenant` / optional `tenantId` on register/reconcile/migrate/sync ops. SIEM broker imports `tagSIEMEvent` but does not tag on ingest.

### APIs / routes

- No new routes; existing `/api/vault/replication-tenant-isolation/*` unchanged unless callers need `tenantId` passthrough (document only if required)

### UI / IDE surfaces

- [ ] N/A (server-only)

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on changed CJS | `node -c` each changed file | [ ] |
| L1-02 | Reconciliation suite | `cd ai-platform && npx jest server/lib/hsm-adapter/__tests__/cluster-key-reconciliation.test.cjs` | [ ] |
| L1-03 | Migration / enclave sync suites (if present) | matching jest files | [ ] |
| L1-04 | New isolation tests | cross-tenant reject + invalid tenantId + audit includes tenantId | [ ] |
| L1-05 | SimpleBeacon gate (full) | `npx simplebeacon scan --full --gate --format json` | [ ] |
| L1-06 | No secrets in diff | Manual / gate token rules | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Same-tenant happy path | registerKey/beginReconciliation/vote with same tenantId (or default) | Existing tests still pass; tenantId in audit | [ ] |
| L2-02 | Cross-tenant reject | register as tenant-A; beginReconciliation as tenant-B | `CROSS_TENANT_*` error; `hsm_replication_cross_tenant_rejected_total` increments | [ ] |
| L2-03 | Invalid tenant | pass malformed tenantId | `INVALID_TENANT_ID`; isolation violation counter increments | [ ] |
| L2-04 | Migration tenant binding | initiate/attest/commit with mismatched tenant | Rejected with migration tenant error | [ ] |
| L2-05 | SIEM tenant tag | ingest event with tenantId | Dispatched JSON includes tenantId via `tagSIEMEvent` | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Default tenant omitted | Ops without tenantId use `DEFAULT_TENANT` and remain compatible | [ ] |
| L3-02 | First register binds key | Second register different tenant rejected; same tenant OK | [ ] |
| L3-03 | Object.freeze SIEM payload | Tenant tagging must not break freeze/immutability contract (tag before freeze or clone) | [ ] |
| L3-04 | No Track 125 / crypto-policy drive-by | Diff limited to isolation files above | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No raw key material in tenant audit/SIEM fields | [ ] |
| S-02 | Cross-tenant ops never mutate foreign key state | [ ] |

---

## Parallel track — Option D (CDN)

Not code; ops gate before claiming custom-domain fix:

| ID | Check | Pass |
|----|-------|------|
| CDN-01 | `https://simplebeacon.ai/app/` HTML shows `?v=20260804…` (not `20260729settings1`) | [ ] |
| CDN-02 | Worker URL returns JS MIME (not HTML SPA fallback) | [ ] |
| CDN-03 | After purge: `CF-Cache-Status` MISS/EXPIRED then HIT on new ETag | [ ] |

**Blocked:** `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ZONE_ID` unset in agent shell. Need token with **Cache Purge** on zone `simplebeacon.ai`.

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________
