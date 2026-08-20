# ai-agent Scan vs. Roadmap Delta Report

Comparing the previous scan report against the remediation roadmap.

## High-level Delta

| Metric                 | Previous Scan            | Roadmap                  | Delta |
| ---------------------- | ------------------------ | ------------------------ | ----- |
| Quality / Health Score | 66                       | 40                       | -26   |
| Total Issues           | 2335                     | 17 roadmap tasks         | -2318 |
| Files Analyzed         | 5415                     | —                        | —     |
| Report Generated       | 2026-07-07T03:56:46.812Z | 2026-07-07T04:08:26.764Z | —     |

## Interpretation

The roadmap is a remediation plan derived from the scan. The health score (40) is lower than the scan quality score (66) because the roadmap only counts the subset of findings selected for manual remediation. The 17 roadmap tasks represent a focused subset of the 2,335 total scan issues.

## Roadmap Task Categories vs. Scan Findings

| Category                  | Scan Count | Roadmap Tasks | Notes                                   |
| ------------------------- | ---------- | ------------- | --------------------------------------- |
| Credential Pattern        | 135        | 8             | Focused on concrete credential snippets |
| Debug Artifact            | 1681       | 9             | Sample of console.log/error findings    |
| License/Governance Marker | 428        | 0             | Not in roadmap                          |
| Maintainability Issue     | 85         | 0             | Not in roadmap                          |
| Architecture Drift        | 6          | 0             | Not in roadmap                          |

## New Task Locations in Roadmap (Not in Previous Scan Top Files)

The roadmap introduces specific file-level tasks in:

- `ai-tools/ai-math-audit.py`
- `api-server/lib/db.cjs`
- `api-server/migrations/run-migrations.cjs`
- `api-server/server.cjs`
- `coming-soon/FilterAndRecalculate.js`
- `coming-soon/analyze-directory.js`
- `coming-soon/build-public.js`
- `coming-soon/js-es2018/terminal-simulation.js`
- `coming-soon/js/terminal-simulation.js`
- `coming-soon/public/js-es2018/terminal-simulation.js`
- `coming-soon/public/js/terminal-simulation.js`
- `inspect_vsix.js`
- `inspect_vsix2.js`
- `packages/simplebeacon-cli/src/doctor.js`
- `scripts/ci-stress-test.cjs`
- `test-jwt-rotation.cjs`

## Recommendation

Start with the 8 credential tasks, then tackle the 9 debug artifacts. Completing these 17 tasks should raise the roadmap health score and improve the next scan quality score.
