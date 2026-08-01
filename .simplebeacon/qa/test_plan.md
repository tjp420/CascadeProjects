# Test Plan — Compliance Report Exporter

**Date:** 2026-07-31
**Branch:** feat/agentic-orchestration
**Feature:** SOC 2 / GDPR / ISO 27001 compliance report generator

---

## Objective Check-Items

### Positive Paths

| # | Check | Level | File |
|---|-------|-------|------|
| 1 | `generateComplianceReport()` returns report object with `generatedAt`, `frameworks`, `orgs` | L1 | `audit-logger.cjs` |
| 2 | Report includes per-org `chainIntegrity` with `valid`, `totalEntries`, `quarantined` | L1 | `audit-logger.cjs` |
| 3 | Report includes per-org `retentionPolicy` with `retentionDays`, `maxEntries`, `archive` | L1 | `audit-logger.cjs` |
| 4 | Report includes per-org `retentionStats` with `total`, `purgeableCount`, `oldest`, `newest` | L1 | `audit-logger.cjs` |
| 5 | Report includes global `autoPurgeStats` with `totalSweeps`, `totalPurged`, `totalArchived` | L1 | `audit-logger.cjs` |
| 6 | Report includes global `healStats` with `totalRuns`, `totalQuarantined`, `totalRelinked` | L1 | `audit-logger.cjs` |
| 7 | Report includes `piiScrubbing` with `enabled`, `policyCount` per org | L1 | `audit-logger.cjs` |
| 8 | Report includes `keyRotation` with `hasPrevious`, `activeKeyId`, `graceWindowEnds` | L1 | `audit-logger.cjs` |
| 9 | Report includes `frameworks` array: `['SOC 2', 'GDPR', 'ISO 27001']` | L1 | `audit-logger.cjs` |
| 10 | GET /api/audit/compliance/report returns report as JSON | L1 | `audit-routes.cjs` |
| 11 | GET /api/audit/compliance/report?format=csv returns CSV download | L1 | `audit-routes.cjs` |

### Edge Cases

| # | Check | Level | File |
|---|-------|-------|------|
| 12 | Report for empty store (no orgs) returns empty orgs array, valid structure | L2 | test |
| 13 | Report handles missing key-rotation-store gracefully (no crash) | L2 | test |
| 14 | Report handles missing pii-policy-store gracefully (no crash) | L2 | test |
| 15 | CSV format includes header row and one row per org | L2 | test |
| 16 | Report includes `reportId` (unique per generation) | L2 | test |

### Security

| # | Check | Level | File |
|---|-------|-------|------|
| 17 | GET /api/audit/compliance/report wrapped with authorize('admin:all') | L1 | `audit-routes.cjs` |
| 18 | Report generation audit-logged with action 'compliance_report_generated' | L1 | `audit-routes.cjs` |
| 19 | Report does not include raw PII (uses scrubbed data from audit log) | L2 | test |

---

## Files Touched

| File | Action |
|------|--------|
| `ai-platform/server/lib/audit-logger.cjs` | UPDATE — add `generateComplianceReport()` |
| `ai-platform/server/routes/audit-routes.cjs` | UPDATE — add GET /api/audit/compliance/report route |
| `ai-platform/server/lib/__tests__/compliance-report.test.cjs` | NEW — 19 tests |

## Design Decisions

1. **Single function in audit-logger.cjs** — Broom strategy. `generateComplianceReport()` aggregates data from existing functions (verifyChain, getAllOrgIds, getRetentionStats, getLifecyclePurgeStats, getHealStats, auditPolicyStore, keyRotationStore, piiPolicyStore). No new module.

2. **JSON + CSV formats** — JSON for API consumption, CSV for auditor export. CSV is a flat per-org summary with key compliance indicators.

3. **Three frameworks in one report** — SOC 2, GDPR, and ISO 27001 share most evidence requirements (audit logging, access controls, retention, encryption). A single report with framework tags is more useful than three separate reports with 90% overlap.

4. **reportId** — UUID-style unique ID per report generation, for traceability.

5. **No PII in report** — The report uses metadata from the audit log (which is already PII-scrubbed) and aggregate counts. No raw entry data is exposed.

6. **Audit-logged** — Generating a compliance report is itself an auditable action, recorded with action 'compliance_report_generated'.

7. **Defensive loading** — key-rotation-store and pii-policy-store are loaded lazily with try/catch, matching the existing pattern in audit-logger.cjs. Missing modules don't crash the report.

## Report Structure (JSON)

```json
{
  "reportId": "cr-abc123",
  "generatedAt": "2026-07-31T22:00:00.000Z",
  "frameworks": ["SOC 2", "GDPR", "ISO 27001"],
  "global": {
    "autoPurgeStats": { "totalSweeps": 12, "totalPurged": 47, ... },
    "healStats": { "totalRuns": 144, "totalQuarantined": 3, ... },
    "keyRotation": { "hasPrevious": false, "activeKeyId": "...", ... },
    "piiScrubbing": { "enabled": true }
  },
  "orgs": [
    {
      "orgId": "acme",
      "chainIntegrity": { "valid": true, "totalEntries": 1247, "quarantined": 0 },
      "retentionPolicy": { "retentionDays": 90, "maxEntries": 10000, "archive": false },
      "retentionStats": { "total": 1247, "purgeableCount": 42, "oldestTimestamp": "...", "newestTimestamp": "..." },
      "piiPolicyCount": 5
    }
  ]
}
```

## Commands

```powershell
node -c ai-platform/server/lib/audit-logger.cjs
node -c ai-platform/server/routes/audit-routes.cjs
node -c ai-platform/server/lib/__tests__/compliance-report.test.cjs
cd ai-platform && npx jest --config jest.config.cjs --ci
npx simplebeacon scan --full --gate --format json
```
