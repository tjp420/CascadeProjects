# Test Plan: Vulnerability Trend Export Engine

## Objective
Build cross-project PDF audit report builders and CSV bulk log extractors in the dashboard views. Compliance teams get pre-packaged vulnerability trend data (CSV) and printable audit reports (PDF via browser print) without server-side PDF libraries.

## Scope

### In Scope
- **Trend CSV builder**: `buildVulnerabilityTrendCsv(report, history)` in `dashboard-export.browser.js` — aggregates severity counts over scan history into a single CSV with per-scan rows
- **Audit PDF builder**: `buildAuditPrintableHtml(report, history)` in `dashboard-export.browser.js` — generates a self-contained printable HTML document (opens `window.print()` → Save as PDF)
- **Bulk issues CSV**: `buildBulkIssuesCsv(reports)` — merges issues from multiple scan reports into one CSV with project column
- **Vanilla JS ResultsView**: Add "Export Trend CSV" and "Export Audit PDF" buttons to the Actions sidebar
- **React OrganizationView**: Add "Compliance Exports" card with CSV/PDF export buttons using the active org's scan history
- **scanService.js**: Add `exportTrendCsv()` and `exportAuditPdf()` methods

### Out of Scope
- Server-side PDF generation (no puppeteer/jspdf dependency — uses browser print-to-PDF)
- New API endpoints (uses existing report + history data already in `app.state`)
- Database schema changes

## Test Matrix

| ID | Description | Command | Expected | Level |
|----|-------------|---------|----------|-------|
| L1-01 | dashboard-export.browser.js syntax | `node -c js-es2018/utils/dashboard-export.browser.js` | Exit 0 | L1 |
| L1-02 | ResultsView.js syntax | `node -c js-es2018/views/ResultsView.js` | Exit 0 | L1 |
| L1-03 | scanService.js syntax | `node -c js-es2018/services/scanService.js` | Exit 0 | L1 |
| L1-04 | OrganizationView.tsx compiles | `cd web/simplebeacon-dashboard && npx tsc --noEmit` | No errors | L1 |
| L1-05 | Gate scan regression | `npx simplebeacon scan --full --gate` | Gate PASS | L1 |
| L1-06 | Trend CSV builder output | Node script: call `buildVulnerabilityTrendCsv` with mock report+history | CSV string with header + rows | L1 |
| L1-07 | Audit HTML builder output | Node script: call `buildAuditPrintableHtml` with mock report | HTML string with `<html>`, `<table>`, `window.print()` | L1 |
| L1-08 | Bulk issues CSV builder | Node script: call `buildBulkIssuesCsv` with 2 mock reports | CSV with project column | L1 |
| L2-01 | ResultsView export buttons render | Open dashboard Results view with a loaded report | "Export Trend CSV" and "Export Audit PDF" buttons visible | L2 |
| L2-02 | Trend CSV download works | Click "Export Trend CSV" button | File downloads as `.csv` with trend data | L2 |
| L2-03 | Audit PDF print dialog | Click "Export Audit PDF" button | New window opens with printable HTML, print dialog triggers | L2 |
| L2-04 | OrgView export card renders | Open Organization view with active org | "Compliance Exports" card visible with CSV/PDF buttons | L2 |

## Files to Modify

| File | Action | Purpose |
|------|--------|---------|
| `js-es2018/utils/dashboard-export.browser.js` | Modify | Add `buildVulnerabilityTrendCsv`, `buildAuditPrintableHtml`, `buildBulkIssuesCsv` |
| `js-es2018/views/ResultsView.js` | Modify | Add export trend CSV + audit PDF buttons and handlers |
| `js-es2018/services/scanService.js` | Modify | Add `exportTrendCsv()` and `exportAuditPdf()` methods |
| `src/views/OrganizationView.tsx` | Modify | Add Compliance Exports card with CSV/PDF buttons |
| `.simplebeacon/qa/test_plan.md` | Update | This file |
