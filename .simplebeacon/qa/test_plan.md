# Test Plan — Compliance Dashboard UI Integration

**Date:** 2026-07-31
**Branch:** feat/agentic-orchestration
**Feature:** Compliance Reports section in SecurityView.js with CSV download

---

## Objective Check-Items

### Positive Paths

| # | Check | Level | File |
|---|-------|-------|------|
| 1 | `fetchComplianceReport()` calls GET /api/audit/compliance/report | L1 | `complianceService.js` |
| 2 | `downloadComplianceCsv()` triggers CSV download via blob | L1 | `complianceService.js` |
| 3 | Section renders "Compliance Reports" card at bottom of admin panels | L2 | `SecurityView.js` |
| 4 | Card shows framework checkboxes: SOC 2, GDPR, ISO 27001 | L2 | `SecurityView.js` |
| 5 | "Generate Report (JSON)" button fetches and displays report summary | L2 | `SecurityView.js` |
| 6 | "Download CSV" button triggers file download | L2 | `SecurityView.js` |
| 7 | Report summary shows: reportId, generatedAt, org count, chain integrity status | L2 | `SecurityView.js` |
| 8 | Per-org summary table: orgId, chain valid, total entries, retention days | L2 | `SecurityView.js` |

### Edge Cases

| # | Check | Level | File |
|---|-------|-------|------|
| 9 | Loading spinner shown during report generation | L2 | `SecurityView.js` |
| 10 | Error state with retry button on fetch failure | L2 | `SecurityView.js` |
| 11 | Empty report (no orgs) shows "No organizations found" | L2 | `SecurityView.js` |
| 12 | Generate button disabled while loading | L2 | `SecurityView.js` |

### Security

| # | Check | Level | File |
|---|-------|-------|------|
| 13 | Section only renders for admin users (isCurrentUserAdmin check) | L2 | `SecurityView.js` |
| 14 | All dynamic fields escaped with escapeHtml() | L2 | `SecurityView.js` |
| 15 | No raw PII displayed in report summary | L2 | `SecurityView.js` |

---

## Files Touched

| File | Action |
|------|--------|
| `ai-platform/web/simplebeacon-dashboard/js-es2018/services/complianceService.js` | NEW — frontend service |
| `ai-platform/web/simplebeacon-dashboard/js-es2018/views/SecurityView.js` | UPDATE — add Compliance Reports section |

## Design Decisions

1. **Placement**: Bottom of admin panels (after retention card). Compliance is the lowest-urgency admin function — it's a periodic export, not a daily operation.

2. **Two actions**: "Generate Report (JSON)" for in-browser preview, "Download CSV" for auditor export. Both call the same backend endpoint with different format parameters.

3. **Framework checkboxes**: SOC 2, GDPR, ISO 27001 — all checked by default. Admins can deselect frameworks they don't need. (Note: backend currently ignores per-framework selection and always returns all three, but the UI prepares for future framework-specific reports.)

4. **Report summary display**: After generating, show a summary card with reportId, timestamp, org count, and a per-org table with chain status and entry counts. Full JSON is kept in memory for potential future expansion.

5. **CSV download via blob**: The service fetches CSV text from the backend and creates a Blob for download. This avoids navigating away from the dashboard.

6. **No background polling**: Reports are generated on-demand. No need to poll.

7. **Service pattern**: Matches existing retentionService.js pattern (apiBase from authService.js, authHeaders parameter, credentials: 'include').

## Commands

```powershell
node -c ai-platform/web/simplebeacon-dashboard/js-es2018/services/complianceService.js
node -c ai-platform/web/simplebeacon-dashboard/js-es2018/views/SecurityView.js
cd ai-platform && npx jest --config jest.config.cjs --ci
npx simplebeacon scan --full --gate --format json
```
