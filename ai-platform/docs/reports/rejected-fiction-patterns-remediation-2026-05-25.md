# Rejected Fiction Patterns Remediation (2026-05-25)

Investigation and remediation of 24 baseline `rejectedFiction` detection patterns across `web/data/` samples and dashboard source fallbacks.

## Summary

| Metric | Before | After |
|--------|--------|-------|
| Baseline detection patterns | 24 | 24 (catalog unchanged) |
| Documented narrative exceptions | 0 | 5 |
| JSON fiction hits (high) | 0 | 0 |
| Source fiction hits (medium) | 14 | **0** |
| Gate | PASS | PASS |
| Compliance rules | 8/8 | 8/8 |
| Schema compliance | 100% | 100% |

## Pattern categorization (all 24)

| # | Pattern | Type | Category | Source(s) | Action |
|---|---------|------|----------|-----------|--------|
| 1 | `74.17` | completion_rate | B | `cascade-roadmap-sample.json` (narrative), `fiction-pattern-registry.md` | Already neutralized in prior tranche; detection catalog retained |
| 2 | `87` | completion_rate | C→fixed | `DebtAnalyticsDashboard.js`, `temp_dashboard.js`, `dashboard.html` | Neutralized: confidence→null/85; XSS field renamed `detectionScore` |
| 3 | `94.3` | completion_rate | B | `data/roadmap/*.json` rejectedFiction.claims | Narrative-only; no active KPI field |
| 4 | `66` | completion_rate | C→fixed | Legacy dashboard fallbacks (excluded paths) | Prior tranche + unified-dashboard export neutralized |
| 5 | `62` | completion_rate | B | `implementation-plan-sample.json` risk mitigation text | Documented anti-fiction warning in notes |
| 6 | `47` | feature_count | C→fixed | `unified-dashboard-core.js` export template | `totalFeatures: null` in reportData block |
| 7 | `100` | feature_count | — | No active KPI occurrence | Detection catalog only |
| 8 | `156` | feature_count | B | `assets-library-sample.json`, narrative refs | Appears in description strings only, not KPI keys |
| 9 | `8` | feature_count | B | `cascade-roadmap-sample.json` deprecatedNarrative | Neutralized to null in prior tranche |
| 10 | `9` | feature_count | — | No active KPI occurrence | Detection catalog only |
| 11 | `1247` | mock_file_count | B | `data-maintenance-analyzers-sample.json` previousMockFiles | deprecatedNarrative field; skipped by consistency checker |
| 12 | `999` | mock_file_count | — | No active KPI occurrence | Detection catalog only |
| 13 | `1000` | mock_file_count | — | No active KPI occurrence | Detection catalog only |
| 14 | `156` | open_issues | C→fixed | 6 dashboard component fallbacks + unified-dashboard export | All `issuesFound`/`issuesDetected`/`patternsIdentified` → `null` |
| 15 | `999` | open_issues | — | No active KPI occurrence | Detection catalog only |
| 16 | `unbreakable-oracle` | model_name | B | 20+ samples `deprecatedNarrative.previousModel`; `local-models-sample.json` demo registry | Documented exception; active model is `phi-2.Q4_K_M.gguf` |
| 17 | `gpt-5-oracle` | model_name | — | Detection catalog only | No active occurrence in samples or source |
| 18 | `demo-oracle` | model_name | B | `ai-analysis-sample.json` deprecatedNarrative | Anti-fiction provenance block |
| 19 | `1559` | throughput_claim | B | `ai-tools-sample.json`, `analytics-sample.json` previousThroughput | deprecatedNarrative only |
| 20 | `1,559` | throughput_claim | B | `fictional-patterns-sample.json` catalog | Self-describing reject list |
| 21 | `9999` | throughput_claim | — | CSS z-index only (not throughput) | Detection catalog only |
| 22 | `98.5` | ai_confidence | C→fixed | `AIAnalysisDashboard.js`, `unified-dashboard-core.js` (3 hits) | All hardcoded confidence/aiConfidence → `null` |
| 23 | `94.3` | ai_confidence | B | `data/roadmap/*.json` rejectedFiction narrative | Placeholder text, not model output |
| 24 | `87` | ai_confidence | C→fixed | `DebtAnalyticsDashboard.js`, `temp_dashboard.js` | Aligned to sample baseline (85) or renamed field |

**Category key:** A = legitimate measured real; B = documented sample/narrative; C = fictional hardcoded (remediated); D = unknown (none remain).

## Source remediation (Category C)

| File | Fields changed | Replacement |
|------|----------------|-------------|
| `web/components/ai-analysis/AIAnalysisDashboard.js` | `issuesFound`, `confidence`, `analysisSpeed` | `null` in fallback + mock blocks |
| `web/components/analysis/AnalysisDashboard.js` | `issuesDetected`, `patternsIdentified` | `null` |
| `web/components/analysis/AnalysisOverview.js` | `patternsIdentified` | `null` |
| `web/components/analytics/AnalyticsDashboard.js` | `issuesDetected` | `null` |
| `web/components/debt-analytics/DebtAnalyticsDashboard.js` | `predictions.nextMonth.confidence` | `85` (matches `debt-analytics-sample.json`) |
| `web/scripts/temp_dashboard.js` | XSS `confidence` | Renamed to `detectionScore` (not AI KPI) |
| `web/scripts/unified-dashboard-core.js` | `aiConfidence`, `confidence`, `totalFeatures`, `issuesDetected`, model branding | Neutralized export template to repository-audit posture |

## Sample JSON validation (42 files)

All 42 `web/data/*-sample.json` files pass schema and consistency checks. Measured baseline fields use `repository-audit` dataSource. Legacy fiction references appear only in:

- `deprecatedNarrative` / `rejectedFiction` / `fictionRemoved` blocks (skipped by consistency checker)
- `fictional-patterns-sample.json` (self-describing catalog)
- Free-text `notes`, `description`, `warning` fields (non-KPI)

Zero active KPI fields contain rejected values per remediation map scan.

## Validation results

```text
npm run simplebeacon:report
  issueCount: 0
  sourceFictionPatternHits: 0
  gate.pass: true
  schemaCompliance: 100%

npm run compliance:check
  8/8 applicable rules pass
```

## Baseline changes

- **Detection catalog:** 24 patterns retained (required for ongoing prevention)
- **Added:** 5 `documentedExceptions` entries with category, scope, reason, and review date
- **Removed:** 0 detection patterns (all remain valid banned values)

## Files changed

- `web/components/ai-analysis/AIAnalysisDashboard.js`
- `web/components/analysis/AnalysisDashboard.js`
- `web/components/analysis/AnalysisOverview.js`
- `web/components/analytics/AnalyticsDashboard.js`
- `web/components/debt-analytics/DebtAnalyticsDashboard.js`
- `web/scripts/temp_dashboard.js`
- `web/scripts/unified-dashboard-core.js`
- `.simplebeacon/baseline.json`
- `docs/reports/rejected-fiction-patterns-remediation-2026-05-25.md`
- `docs/fiction-pattern-registry.md`

## Follow-up (out of scope)

Legacy dashboard HTML/inline-core files under excluded scan paths still contain historical fiction literals (`dashboard-inline-core.part*.js`, `unified-dashboard.html`). Prevention controls flag these; broad refactor deferred per prior tranche guidance.

## Live KPI wiring (2026-05-25, phase 2)

Subagent neutralization (null placeholders) was replaced with `web/services/DashboardMetricsService.js` live fetches in the seven affected dashboard source files.

| KPI | Primary endpoint | Fallbacks |
|-----|------------------|-----------|
| Open issues | `GET /api/issues` | `/api/gguf/issues`, `/api/backlog` |
| AI confidence | `GET /api/ai-analysis` | `/api/gguf/analysis`, `POST /api/models/active/analyze` |
| Feature count | `GET /api/feature-backlog/statistics` | `/api/roadmap/data?type=gguf`, `/api/project-structure` |

Loading state shows `—`; API failure shows `Unavailable` (no fiction backfill). Unit tests: `tests/unit/dashboard-metrics-service.test.js`.
