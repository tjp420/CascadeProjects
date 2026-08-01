# Test Plan — Audit Policy & Retention Engine

**Date:** 2026-07-31
**Branch:** feat/agentic-orchestration
**Feature:** Per-org audit retention policies with purge, archive, and stats

---

## Objective Check-Items

### Positive Paths

| # | Check | Level | File/Route |
|---|-------|-------|------------|
| 1 | `audit-policy-store.cjs` loads/saves per-org retention config | L1 | `audit-policy-store.cjs` |
| 2 | `getPolicy(orgId)` returns retention days, max entries, archive flag | L1 | `audit-policy-store.cjs` |
| 3 | `setPolicy(orgId, policy)` validates and persists config | L1 | `audit-policy-store.cjs` |
| 4 | `auditLogger.purgeOldEntries(orgId)` removes entries older than retention days | L1 | `audit-logger.cjs` |
| 5 | `purgeOldEntries` re-links hash chain after removal | L1 | `audit-logger.cjs` |
| 6 | `auditLogger.getRetentionStats(orgId)` returns total, oldest, newest, purgeable count | L1 | `audit-logger.cjs` |
| 7 | `GET /api/audit/retention/config` returns policy for caller's org | L1 | `audit-routes.cjs` |
| 8 | `PUT /api/audit/retention/config` updates policy (admin-only) | L1 | `audit-routes.cjs` |
| 9 | `POST /api/audit/retention/purge` triggers purge and returns count removed | L1 | `audit-routes.cjs` |
| 10 | `GET /api/audit/retention/stats` returns retention stats | L1 | `audit-routes.cjs` |

### Edge Cases

| # | Check | Level | File/Route |
|---|-------|-------|------------|
| 11 | `purgeOldEntries` on empty store returns 0 removed | L1 | `audit-logger.cjs` |
| 12 | `purgeOldEntries` with no policy uses default (90 days) | L1 | `audit-logger.cjs` |
| 13 | `setPolicy` rejects negative retention days | L1 | `audit-policy-store.cjs` |
| 14 | `setPolicy` rejects maxEntries < 100 | L1 | `audit-policy-store.cjs` |
| 15 | Purge preserves at least `maxEntries` most recent entries | L1 | `audit-logger.cjs` |
| 16 | Hash chain remains valid after purge (verifyChain passes) | L1 | `audit-logger.cjs` |

### Security

| # | Check | Level | File/Route |
|---|-------|-------|------------|
| 17 | All retention routes wrapped with `authorize('admin:all')` | L1 | `audit-routes.cjs` |
| 18 | Purge action is audit-logged with actor and count | L1 | `audit-routes.cjs` |
| 19 | Policy updates are audit-logged | L1 | `audit-routes.cjs` |
| 20 | `purgeOldEntries` does not cross org boundaries | L1 | `audit-logger.cjs` |

---

## Files Touched

| File | Action |
|------|--------|
| `ai-platform/server/lib/audit-policy-store.cjs` | NEW — per-org retention policy store |
| `ai-platform/server/lib/audit-logger.cjs` | UPDATE — add purgeOldEntries(), getRetentionStats() |
| `ai-platform/server/routes/audit-routes.cjs` | UPDATE — add 4 retention admin routes |
| `ai-platform/server/lib/__tests__/audit-policy-store.test.cjs` | NEW — policy store tests |
| `ai-platform/server/lib/__tests__/audit-logger-retention.test.cjs` | NEW — retention/purge tests |

## Design Decisions

1. **Per-org policy store** — `audit-policy-store.cjs` uses a JSON file at `.simplebeacon/audit-policy-store.json` with a map of orgId → policy. Default policy: 90 days retention, 10,000 max entries, archive=false (delete).
2. **Archive vs delete** — When `archive: true`, purged entries are moved to a separate archive file before deletion. When `archive: false`, entries are deleted outright.
3. **Hash chain re-linking** — After purge, remaining entries are re-linked with new hashes (same pattern as `healChain()`).
4. **Default policy** — 90 days retention, 10,000 max entries, no archiving. Matches existing `auditConfig.retentionDays: 90` in `audit.cjs`.
5. **Purge safety** — Always preserves at least `maxEntries` most recent entries, even if they're older than retention days.
6. **No background timer** — Purge is triggered manually via API or by the existing auto-heal worker. No new timers.

## Commands

```powershell
node -c ai-platform/server/lib/audit-policy-store.cjs
node -c ai-platform/server/lib/audit-logger.cjs
node -c ai-platform/server/routes/audit-routes.cjs
node -c ai-platform/server/lib/__tests__/audit-policy-store.test.cjs
node -c ai-platform/server/lib/__tests__/audit-logger-retention.test.cjs
cd ai-platform && npx jest --config jest.config.cjs --ci
npx simplebeacon scan --full --gate --format json
```
