# Test Plan — Master Key Rotation & Migration Dashboard Panel

**Date:** 2026-01-30
**Branch:** feat/agentic-orchestration
**Feature:** Backend admin routes + frontend key management card for SecurityView

---

## Objective Check-Items

### Positive Paths

| # | Check | Level | File/Route |
|---|-------|-------|------------|
| 1 | `GET /api/audit/key/status` returns rotation status with fingerprints | L1 | `audit-routes.cjs` |
| 2 | `POST /api/audit/key/rotate` accepts newKeyRaw + graceMs, calls rotateKey() | L1 | `audit-routes.cjs` |
| 3 | `POST /api/audit/key/rekey-now` triggers runAutonomousReKeying() | L1 | `audit-routes.cjs` |
| 4 | `GET /api/audit/key/rekey-stats` returns migration statistics | L1 | `audit-routes.cjs` |
| 5 | Frontend `keyManagementService.fetchKeyStatus()` returns status object | L2 | `keyManagementService.js` |
| 6 | Frontend `MasterKeyRotationCard` renders active fingerprint | L2 | `SecurityView.js` |
| 7 | Frontend rotation form posts to `/api/audit/key/rotate` | L2 | `SecurityView.js` |
| 8 | Frontend "Force Re-Key Sweep" button calls `/api/audit/key/rekey-now` | L2 | `SecurityView.js` |

### Edge Cases

| # | Check | Level | File/Route |
|---|-------|-------|------------|
| 9 | `POST /api/audit/key/rotate` rejects empty key with 400 | L1 | `audit-routes.cjs` |
| 10 | `POST /api/audit/key/rotate` rejects short key (<32 chars) with 400 | L1 | `audit-routes.cjs` |
| 11 | Non-admin user gets 403 on all key management routes | L1 | `audit-routes.cjs` |
| 12 | Frontend shows "No rotation active" when hasPrevious is false | L2 | `SecurityView.js` |
| 13 | Frontend shows grace window countdown when rotation is active | L2 | `SecurityView.js` |

### Security

| # | Check | Level | File/Route |
|---|-------|-------|------------|
| 14 | Status response only contains fingerprints, not raw keys | L2 | `audit-routes.cjs` |
| 15 | Frontend never logs or displays raw key input after rotation | L2 | `SecurityView.js` |
| 16 | All key management routes wrapped with `authorize('admin:all')` | L1 | `audit-routes.cjs` |

---

## Files Touched

| File | Action |
|------|--------|
| `ai-platform/server/routes/audit-routes.cjs` | UPDATE — add 4 new admin routes |
| `ai-platform/web/simplebeacon-dashboard/js-es2018/services/keyManagementService.js` | NEW — frontend service |
| `ai-platform/web/simplebeacon-dashboard/js-es2018/views/SecurityView.js` | UPDATE — add MasterKeyRotationCard section |

## Commands

```powershell
node -c ai-platform/server/routes/audit-routes.cjs
node -c ai-platform/web/simplebeacon-dashboard/js-es2018/services/keyManagementService.js
cd ai-platform && npx jest --config jest.config.cjs --testPathPatterns="audit-routes"
npx simplebeacon scan --full --gate --format json
```
