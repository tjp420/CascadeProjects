# AI Problem Analyzer Suite Definition of Done Checklist

Use this checklist as a release gate for analyzer milestones.

## Per-analyzer minimum gate (status transition control)
- [ ] Analyzer returns required fields: `id`, `analyzerId`, `status`, `score`, `severity`, `riskBand`, `metrics`, `findings`, `recommendations`, `evidence`.
- [ ] Analyzer reports `status: implemented` only after deterministic fixture coverage is added.
- [ ] Analyzer has at least one positive-path and one adverse/edge fixture in `tests/unit/ai-systems-issue-analyzer.test.js`.
- [ ] Schema/payload compatibility remains valid for dashboard/reporting consumers.

## Contract completeness
- [ ] Every in-scope analyzer returns required result fields (`id`, `analyzerId`, `status`, `score`, `severity`, `riskBand`, `metrics`, `findings`, `recommendations`, `evidence`).
- [ ] Registry entries remain complete in `ANALYZER_CATALOG`.
- [ ] Payload consumers (dashboard/reporting) remain schema-compatible.

## Test and quality gates
- [ ] Targeted analyzer unit suite passes:
  - `npm test -- --no-coverage tests/unit/ai-systems-issue-analyzer.test.js`
- [ ] Repository quality gate passes:
  - `npm run simplebeacon:report`
- [ ] Integration baseline passes for release candidate:
  - `npm run test:integration`

## Security and reliability gates
- [ ] A-39 and A-46 evidence-aware moderation behavior remains intact.
- [ ] High-risk and insufficient-data fixtures are covered and passing.
- [ ] No unresolved critical findings in release-candidate analyzer outputs.

## Operational readiness
- [ ] `ANALYZER_BACKLOG_MATRIX.md` updated for all 47 analyzers.
- [ ] `analyzer-tracker.json` updated (`status`, `owner`, `phase`, `targetSprint`, `risk`, `validationChecklist`).
- [ ] `RISK_REGISTER.md` reviewed with current mitigation assignments.
- [ ] `NEXT_8_WEEKS_MVP_PLAN.md` and `SPRINT_EXECUTION_BOARD.md` stop/go criteria evaluated this sprint.

## Documentation readiness
- [ ] `MASTER_ROADMAP.md` reflects current phase and milestone.
- [ ] Active tranche notes updated (`docs/analyzers-tranche-2026-05-a39-a46.md` or successor note).
- [ ] Weekly execution review completed and recorded by owners.
