# Simplebeacon 3-Week Quality Maintenance Roadmap

## Purpose

Practical, low-friction quality optimization plan that keeps gate enforcement strong while avoiding developer workflow disruption.

## Week 1 (Stability + Quality Baseline)

- Keep gate blockers at zero (`gate.pass=true`, `blockingCount=0`).
- Target consistency at 100 and preserve it with anchored sample set checks.
- Expand **non-blocking** schema visibility using `schema:coverage:extended` for operational JSONs beyond core page samples.
- Track combined schema coverage (`schemaChecked + extendedTargetsChecked`) to drive toward 60+ validated artifacts.
- Run low-risk data hygiene scans:
  - `npm run scan:kpi:source`
  - `npm run scan:oversized`
  - `npm run validate:json:all`

### Exit criteria

- Gate pass confirmed from `.simplebeacon/report.json`.
- `consistencyScore=100`.
- Extended schema artifact present: `.simplebeacon/extended-schema-coverage.json`.

## Week 2 (Automation + Monitoring)

- Maintain default non-disruptive behavior:
  - Local fiction guard warns by default (`guard:fiction-kpi`).
  - CI fiction/schema checks are visibility-first (`|| true` in workflows).
- Keep optional strict path available:
  - `npm run guard:fiction-kpi:strict` (manual/local strict mode).
- Publish machine-readable metrics each run:
  - `.simplebeacon/quality-maintenance-metrics.json`.

### Alert thresholds and owners

- **Critical** (owner: platform maintainer): `gate.pass !== true` or `severityCounts.high > 0`.
- **Warning** (owner: quality reviewer): extended schema pass-rate drops below 90%.
- **Ops visibility** (owner: CI maintainer): metrics artifact missing in CI uploads.

## Week 3 (Strategic Sustainment)

- Establish monthly trend review over:
  - gate pass-rate,
  - consistency score,
  - schema coverage (core + extended),
  - fiction guard finding rate.
- Keep scan scope stable and canonical unless intentionally expanded for forensic runs.
- Cost/scalability guidance:
  - keep strict checks on demand, not default,
  - publish artifacts once per run for async review,
  - avoid full-repo heavyweight checks in every local commit.

## Operational command set

From `ai-platform/`:

```bash
npm run simplebeacon:report
npm run schema:coverage:extended
npm run guard:fiction-kpi:ci
npm run metrics:quality:build
npm run simplebeacon:assess -- --output .simplebeacon/assessment.json
```

## Ownership handoff

- **Platform maintainer**: gate scope, baseline upkeep, release readiness.
- **Quality reviewer**: weekly artifact review and fiction drift triage.
- **CI maintainer**: workflow health, artifact retention, branch protection checks.
