# Test Plan — Auto-Purge Metrics in Stats API & Dashboard

**Date:** 2026-07-31
**Branch:** feat/agentic-orchestration
**Feature:** Expose _lifecyclePurgeStats via GET /retention/stats and surface in frontend

---

## Objective Check-Items

### Positive Paths

| # | Check | Level | File |
|---|-------|-------|------|
| 1 | GET /retention/stats response includes `autoPurgeStats` object | L1 | `audit-routes.cjs` |
| 2 | `autoPurgeStats` contains totalSweeps, totalPurged, totalArchived, lastResult, lastRun | L1 | `audit-routes.cjs` |
| 3 | Frontend retention card renders "Background Worker Activity" section | L2 | `SecurityView.js` |
| 4 | Worker activity section shows totalSweeps, totalPurged, totalArchived | L2 | `SecurityView.js` |
| 5 | Worker activity section shows lastRun timestamp (human-readable) | L2 | `SecurityView.js` |
| 6 | Stats refresh button also refreshes auto-purge metrics | L2 | `SecurityView.js` |

### Edge Cases

| # | Check | Level | File |
|---|-------|-------|------|
| 7 | Worker activity section shows "Never" when lastRun is null | L2 | `SecurityView.js` |
| 8 | Worker activity section shows "0" counts when no sweeps have run | L2 | `SecurityView.js` |
| 9 | Existing stats fields (total, purgeableCount, oldest, newest) still present | L1 | `audit-routes.cjs` |

### Security

| # | Check | Level | File |
|---|-------|-------|------|
| 10 | Endpoint still wrapped with authorize('admin:all') | L1 | `audit-routes.cjs` |
| 11 | Auto-purge stats fields escaped with escapeHtml() in frontend | L2 | `SecurityView.js` |

---

## Files Touched

| File | Action |
|------|--------|
| `ai-platform/server/routes/audit-routes.cjs` | UPDATE — add autoPurgeStats to stats response |
| `ai-platform/web/simplebeacon-dashboard/js-es2018/views/SecurityView.js` | UPDATE — add Background Worker Activity section |

## Design Decisions

1. **No new endpoint** — Extend the existing GET /retention/stats rather than adding a new endpoint. The auto-purge stats are global (not per-org), but they're only relevant in the context of retention management, so co-locating them is natural.

2. **Flat merge** — `res.json({ success, orgId, ...stats, autoPurgeStats })` — the autoPurgeStats is a nested object to avoid key collisions with the per-org stats.

3. **Frontend placement** — Add a compact "Background Worker Activity" card BELOW the stats grid and ABOVE the policy form. This gives admins visibility into the autonomous worker's activity at a glance.

4. **No new service function** — The existing `fetchRetentionStats()` already returns the full response body. The autoPurgeStats will be included automatically.

5. **Human-readable lastRun** — Format as locale string, or "Never" if null.

## Commands

```powershell
node -c ai-platform/server/routes/audit-routes.cjs
node -c ai-platform/web/simplebeacon-dashboard/js-es2018/views/SecurityView.js
cd ai-platform && npx jest --config jest.config.cjs --ci
npx simplebeacon scan --full --gate --format json
```
