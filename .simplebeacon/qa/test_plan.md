# Test Plan — Forensic Log Viewer & Quarantine Evidence Inspector

**Date:** 2026-01-30
**Branch:** feat/agentic-orchestration
**Feature:** Backend row-level verification route + frontend quarantine inspector drawer in SecurityView

---

## Objective Check-Items

### Positive Paths

| # | Check | Level | File/Route |
|---|-------|-------|------------|
| 1 | `POST /api/audit/quarantine/verify-entry` recomputes hash for a single entry | L1 | `audit-routes.cjs` |
| 2 | Verification result includes `hashMatches`, `expectedHash`, `actualHash`, `quarantineReason` | L1 | `audit-routes.cjs` |
| 3 | Frontend `fetchQuarantineEntries()` calls existing `GET /api/audit/quarantine` | L2 | `quarantineService.js` |
| 4 | Frontend `verifyQuarantineEntry()` calls new verification endpoint | L2 | `quarantineService.js` |
| 5 | QuarantineInspector renders entries table with id, action, timestamp, reason | L2 | `SecurityView.js` |
| 6 | Each row has an expandable detail drawer showing full entry payload | L2 | `SecurityView.js` |
| 7 | Each row has a "Verify" button that triggers row-level hash check | L2 | `SecurityView.js` |
| 8 | Verify result shows green check (match) or red warning (mismatch) inline | L2 | `SecurityView.js` |

### Edge Cases

| # | Check | Level | File/Route |
|---|-------|-------|------------|
| 9 | Empty quarantine store renders "No quarantined entries" empty state | L2 | `SecurityView.js` |
| 10 | `?allOrgs=true` query param shows cross-tenant entries for admins | L2 | `SecurityView.js` |
| 11 | Verify endpoint returns 404 if entry ID not found in quarantine | L1 | `audit-routes.cjs` |
| 12 | Decryption error metadata is surfaced in the UI | L2 | `SecurityView.js` |

### Security

| # | Check | Level | File/Route |
|---|-------|-------|------------|
| 13 | All quarantine routes wrapped with `authorize('admin:all')` | L1 | `audit-routes.cjs` |
| 14 | Quarantine entries never expose raw encryption keys | L2 | `audit-routes.cjs` |
| 15 | Frontend escapes all entry payload fields with `escapeHtml()` | L2 | `SecurityView.js` |

---

## Files Touched

| File | Action |
|------|--------|
| `ai-platform/server/routes/audit-routes.cjs` | UPDATE — add `POST /quarantine/verify-entry` route |
| `ai-platform/server/lib/audit-logger.cjs` | UPDATE — add `verifyQuarantineEntry(orgId, entryId)` function |
| `ai-platform/web/simplebeacon-dashboard/js-es2018/services/quarantineService.js` | NEW — frontend service |
| `ai-platform/web/simplebeacon-dashboard/js-es2018/views/SecurityView.js` | UPDATE — add QuarantineInspector section |

## Commands

```powershell
node -c ai-platform/server/routes/audit-routes.cjs
node -c ai-platform/server/lib/audit-logger.cjs
node -c ai-platform/web/simplebeacon-dashboard/js-es2018/services/quarantineService.js
node -c ai-platform/web/simplebeacon-dashboard/js-es2018/views/SecurityView.js
cd ai-platform && npx jest --config jest.config.cjs --ci
npx simplebeacon scan --full --gate --format json
```
