# Test Plan — Automated Purge Schedule (Autonomous ILM)

**Date:** 2026-07-31
**Branch:** feat/agentic-orchestration
**Feature:** Wire purgeOldEntries() into the 5-minute auto-heal background worker

---

## Objective Check-Items

### Positive Paths

| # | Check | Level | File |
|---|-------|-------|------|
| 1 | `runAutonomousLifecyclePurge()` iterates all orgs from getAllOrgIds() | L1 | `audit-logger.cjs` |
| 2 | For each org, calls `purgeOldEntries(orgId)` with the org's active policy | L1 | `audit-logger.cjs` |
| 3 | When `purged > 0`, writes an audit log entry with action `audit_retention_auto_purge` | L1 | `audit-logger.cjs` |
| 4 | Auto-purge log entry includes metadata: purged, remaining, archived, policy snapshot | L1 | `audit-logger.cjs` |
| 5 | Auto-purge log entry uses system actor (`actorId: 'system'`, `actorEmail: 'system@internal'`) | L1 | `audit-logger.cjs` |
| 6 | `runAutonomousLifecyclePurge()` is called from the auto-heal timer tick | L1 | `audit-logger.cjs` |
| 7 | Timer tick order: healAllOrgs → runAutonomousReKeying → runAutonomousLifecyclePurge | L1 | `audit-logger.cjs` |
| 8 | Returns summary `{ totalPurged, totalArchived, orgsProcessed, orgsPurged, errors }` | L1 | `audit-logger.cjs` |
| 9 | `getLifecyclePurgeStats()` returns _lifecyclePurgeStats snapshot | L1 | `audit-logger.cjs` |

### Edge Cases

| # | Check | Level | File |
|---|-------|-------|------|
| 10 | Org with 0 purgeable entries: no audit log entry written, continues to next org | L2 | test |
| 11 | Org with empty store: skipped, no error thrown | L2 | test |
| 12 | Error in one org's purge does not block other orgs (per-org try/catch) | L2 | test |
| 13 | Error in one org recorded in errors array with orgId + message | L2 | test |
| 14 | Safety floor respected: maxEntries most recent entries preserved even if older than cutoff | L2 | test |
| 15 | Hash chain valid after auto-purge (verifyChain passes) | L2 | test |

### Security

| # | Check | Level | File |
|---|-------|-------|------|
| 16 | Auto-purge log entry is itself subject to PII scrubbing (scrubAuditEntry) | L2 | test |
| 17 | Auto-purge does not cross org boundaries (per-org isolation) | L2 | test |

---

## Files Touched

| File | Action |
|------|--------|
| `ai-platform/server/lib/audit-logger.cjs` | UPDATE — add `runAutonomousLifecyclePurge()`, `getLifecyclePurgeStats()`, wire into timer, add `_lifecyclePurgeStats` state |
| `ai-platform/server/lib/__tests__/audit-logger-auto-purge.test.cjs` | NEW — 17 tests covering all check-items |

## Design Decisions

1. **Sequential, not Promise.all()** — Matches existing `healAllOrgs()` pattern (line 937: sequential `for...of` with per-org try/catch). Parallel purges would contend on the single store file lock and spike disk I/O for no benefit on a single-machine deployment.

2. **Timer tick order** — healAllOrgs → runAutonomousReKeying → runAutonomousLifecyclePurge. Purge runs LAST so that any chain healing or re-keying completes first. This ensures the chain is intact before we evict entries and re-link.

3. **Audit log entry for auto-purge** — Uses `log()` directly with `actorId: 'system'`, `actorEmail: 'system@internal'`, `action: 'audit_retention_auto_purge'`, `entity: 'audit_log'`, `entityId: orgId`. Metadata includes `{ purged, remaining, archived, policy: { retentionDays, maxEntries, archive }, autoPurge: true }`.

4. **Only log when purged > 0** — Avoids audit log spam every 5 minutes when there's nothing to purge. The absence of an `audit_retention_auto_purge` entry means no purge was needed.

5. **Stats tracking** — `_lifecyclePurgeStats` mirrors `_healStats` and `_reKeyStats` patterns: `{ totalSweeps, totalPurged, totalArchived, lastResult, lastRun }`.

6. **No new module** — Broom strategy. All changes inline in `audit-logger.cjs`. The `auditPolicyStore` is already required at the top of the file.

7. **Guard flag** — `_lifecyclePurgeRunning` prevents concurrent purge sweeps, mirroring `_healRunning`.

## Commands

```powershell
node -c ai-platform/server/lib/audit-logger.cjs
node -c ai-platform/server/lib/__tests__/audit-logger-auto-purge.test.cjs
cd ai-platform && npx jest --config jest.config.cjs --ci
npx simplebeacon scan --full --gate --format json
```
