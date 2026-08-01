# Test Plan — Frontend Retention Dashboard Card

**Date:** 2026-07-31
**Branch:** feat/agentic-orchestration
**Feature:** Frontend retention management card in SecurityView.js

---

## Objective Check-Items

### Positive Paths

| # | Check | Level | File/Route |
|---|-------|-------|------------|
| 1 | `fetchConfig()` calls GET /api/audit/retention/config | L1 | `retentionService.js` |
| 2 | `updateConfig(config)` calls PUT /api/audit/retention/config | L1 | `retentionService.js` |
| 3 | `fetchStats()` calls GET /api/audit/retention/stats | L1 | `retentionService.js` |
| 4 | `triggerPurge()` calls POST /api/audit/retention/purge | L1 | `retentionService.js` |
| 5 | `renderRetentionSection()` renders stats grid (total, purgeable, oldest, newest) | L2 | `SecurityView.js` |
| 6 | Policy form has inputs for retentionDays, maxEntries, archive toggle | L2 | `SecurityView.js` |
| 7 | "Save Policy" button calls updateConfig() and refreshes | L2 | `SecurityView.js` |
| 8 | "Execute Purge" button shows confirmation dialog before executing | L2 | `SecurityView.js` |
| 9 | Purge result shows toast with purged/remaining/archived counts | L2 | `SecurityView.js` |
| 10 | Section placed at bottom of admin panels (after quarantine) | L2 | `SecurityView.js` |

### Edge Cases

| # | Check | Level | File/Route |
|---|-------|-------|------------|
| 11 | Empty store renders "0 total entries" stats | L2 | `SecurityView.js` |
| 12 | Form validates retentionDays >= 1 before submission | L2 | `SecurityView.js` |
| 13 | Form validates maxEntries >= 100 before submission | L2 | `SecurityView.js` |
| 14 | Purge with 0 purgeable entries shows "Nothing to purge" toast | L2 | `SecurityView.js` |
| 15 | Confirmation dialog can be cancelled (no purge executed) | L2 | `SecurityView.js` |

### Security

| # | Check | Level | File/Route |
|---|-------|-------|------------|
| 16 | Section only renders for admin users (isCurrentUserAdmin check) | L2 | `SecurityView.js` |
| 17 | All entry fields escaped with escapeHtml() | L2 | `SecurityView.js` |
| 18 | Purge button requires explicit confirmation (destructive action guard) | L2 | `SecurityView.js` |

---

## Files Touched

| File | Action |
|------|--------|
| `ai-platform/web/simplebeacon-dashboard/js-es2018/services/retentionService.js` | NEW — frontend service |
| `ai-platform/web/simplebeacon-dashboard/js-es2018/views/SecurityView.js` | UPDATE — add RetentionCard section |

## Design Decisions

1. **Placement**: Bottom of admin sections (after quarantine inspector) — retention is lower-urgency than interdiction (top) and key rotation (middle).
2. **Confirmation dialog**: Purge is a destructive action. A two-step confirmation (click button → confirm dialog → execute) prevents accidental data loss.
3. **Client-side validation**: Form validates retentionDays >= 1 and maxEntries >= 100 before sending to backend, matching backend validation.
4. **Service pattern**: Matches existing services (apiBase from authService.js, authHeaders parameter, credentials: 'include').
5. **No background polling**: Retention stats don't change frequently — manual refresh button only. Avoids unnecessary load.
6. **Stats grid**: 4 cards showing Total Entries, Purgeable Count, Oldest Timestamp, Newest Timestamp.

## Commands

```powershell
node -c ai-platform/web/simplebeacon-dashboard/js-es2018/services/retentionService.js
node -c ai-platform/web/simplebeacon-dashboard/js-es2018/views/SecurityView.js
cd ai-platform && npx jest --config jest.config.cjs --ci
npx simplebeacon scan --full --gate --format json
```
