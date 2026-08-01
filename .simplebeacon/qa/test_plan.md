# Test Plan — Real-Time Interdiction Management Card

**Date:** 2026-01-30
**Branch:** feat/agentic-orchestration
**Feature:** Frontend interdiction management card in SecurityView.js

---

## Objective Check-Items

### Positive Paths

| # | Check | Level | File/Route |
|---|-------|-------|------------|
| 1 | `fetchInterdictions()` calls GET /api/audit/interdiction/status | L1 | `interdictionService.js` |
| 2 | `blockKey(apiKey, reason, ttlMs)` calls POST /api/audit/interdiction/block | L1 | `interdictionService.js` |
| 3 | `releaseKey(apiKey)` calls POST /api/audit/interdiction/release | L1 | `interdictionService.js` |
| 4 | `renderInterdictionSection()` renders block list table with masked keys | L2 | `SecurityView.js` |
| 5 | Each row shows masked key, reason, blockedAt, expiresAt, source | L2 | `SecurityView.js` |
| 6 | Manual block form has inputs for apiKey, reason, duration (minutes) | L2 | `SecurityView.js` |
| 7 | "Lift Lock" button per row calls releaseKey() and refreshes list | L2 | `SecurityView.js` |
| 8 | Empty state renders "No active interdictions" message | L2 | `SecurityView.js` |
| 9 | Stats summary shows totalBlocked, totalReleased, totalAutoTriggered | L2 | `SecurityView.js` |
| 10 | Section placed at top of admin panels (most time-sensitive) | L2 | `SecurityView.js` |

### Edge Cases

| # | Check | Level | File/Route |
|---|-------|-------|------------|
| 11 | Block form validates required apiKey field before submission | L2 | `SecurityView.js` |
| 12 | Block form shows toast on success, error toast on failure | L2 | `SecurityView.js` |
| 13 | Release on non-existent key shows toast with wasBlocked: false | L2 | `SecurityView.js` |
| 14 | Background polling refreshes status every 30s when section visible | L2 | `SecurityView.js` |
| 15 | Polling interval is cleaned up on unmount/section hide | L2 | `SecurityView.js` |

### Security

| # | Check | Level | File/Route |
|---|-------|-------|------------|
| 16 | Section only renders for admin users (isCurrentUserAdmin check) | L2 | `SecurityView.js` |
| 17 | Masked keys from backend are never unmasked in the DOM | L2 | `SecurityView.js` |
| 18 | All entry fields escaped with escapeHtml() | L2 | `SecurityView.js` |

---

## Files Touched

| File | Action |
|------|--------|
| `ai-platform/web/simplebeacon-dashboard/js-es2018/services/interdictionService.js` | NEW — frontend service |
| `ai-platform/web/simplebeacon-dashboard/js-es2018/views/SecurityView.js` | UPDATE — add InterdictionCard section |

## Design Decisions

1. **Placement**: Top of admin sections (before key management and quarantine) — most time-sensitive active defense data.
2. **Background polling**: 30-second interval via `setInterval` with `unref()`-like cleanup on unmount. Only polls when section is visible and user is admin.
3. **Duration input**: Minutes (not ms) in the UI form — converted to ms before sending to backend. Default: 15 minutes.
4. **Service pattern**: Matches existing `keyManagementService.js` and `quarantineService.js` — imports `apiBase` from `authService.js`, accepts `authHeaders` parameter.
5. **No new dependencies**: Vanilla JS, existing fetch API, existing escapeHtml utility.

## Commands

```powershell
node -c ai-platform/web/simplebeacon-dashboard/js-es2018/services/interdictionService.js
node -c ai-platform/web/simplebeacon-dashboard/js-es2018/views/SecurityView.js
cd ai-platform && npx jest --config jest.config.cjs --ci
npx simplebeacon scan --full --gate --format json
```
