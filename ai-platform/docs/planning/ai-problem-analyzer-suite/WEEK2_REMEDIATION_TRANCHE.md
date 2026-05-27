# Week 2 Remediation Tranche (Next Smallest Scope)

## Scope source
- Week 1 completion handoff from Codebase Analyzer 5-week plan (420 findings baseline).
- Focus categories deferred from Week 1: `lorem ipsum`, `coming-soon`, `KPI`, `duplicate`, `eslint`.

## Priority order (Week 2)
1. `coming-soon` placeholders in production-facing UI text and docs linked to active execution plans.
2. `lorem ipsum` placeholders in user-visible templates/components.
3. KPI hard-coded values requiring source-of-truth reconciliation (keep deterministic values only).
4. Duplicate hotspots in production paths (start with highest-impact clusters, avoid broad rewrites).
5. ESLint fixes for touched production files only (no repo-wide formatting churn).

## Tranche tasks (smallest executable units)
- [ ] `coming-soon`: replace placeholders in `web/` and `src/web/` runtime UI strings with status-tagged copy (`planned`, `not-in-scope`, or `blocked`) plus owner lane/date.
- [ ] `lorem ipsum`: remove or replace any placeholder prose in active docs under `docs/planning/` and user-visible HTML templates.
- [ ] KPI: run `npm run scan:kpi:source:docs` and reconcile each flagged KPI in analyzer planning docs against `docs/ai-problem-analyzer-finance-model.json`.
- [ ] Duplicate: use `reports/technical-debt/raw/jscpd/jscpd-report.json` summary pointer to pick top 3 production clusters and remediate surgically.
- [ ] ESLint: run focused lint on files touched in Week 2 and fix only direct-rule violations in those files.

## Validation checklist (Week 2 exit criteria)
- [ ] `npm run simplebeacon:report` passes and no new high-severity regressions are introduced.
- [ ] `npm run test:integration` passes for impacted routes/pages.
- [ ] `npm run verify:production-deploy` passes.
- [ ] Before/after counts recorded for all five Week 2 categories in this file.

## Ownership/assignment policy carried from Week 1
- Use lane-style placeholders only when assignee is genuinely unknown.
- `confirm by <date>` = currently active lane; must map to named assignee by date.
- `assign by <date>` = not yet active; must be assigned before sprint entry.
