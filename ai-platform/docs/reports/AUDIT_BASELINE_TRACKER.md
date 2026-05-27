# Audit Baseline Tracker

Execution-first tracker for the 12-week Quality & Security Enhancement Plan.

## Current vs Target Board

- Security posture score: `80 -> 88`
- Test count / pass rate: `717 @ 100% -> 760 @ 100%`
- Schema compliance: `100% -> 100%`
- Scan quality score: `100 -> 100`
- Mock file count in scoped scan paths: `56 -> 65`
- Scan path count: `9 -> 10`
- Coverage (line / branch / function / statement): `85.45 / 64.55 / 77.46 / 84.65 -> 88 / 70 / 82 / 87`
- Dependency high/critical findings: `0 -> 0 (hold)`

Machine-readable source of truth: `.simplebeacon/audit-baseline-tracker.json`

## 12-Week Roadmap (Week-by-Week)

- Week 1: establish baseline tracker, CI/local compliance guard, and owners.
- Week 2: expand low-noise scan scope (+safe paths), harden config validation, and maintain dependency guardrails.
- Week 3: add targeted branch-coverage tests for highest-impact uncovered API branches.
- Week 4: stabilize branch uplift and lock weekly reporting cadence.
- Week 5: tighten secret scanning precision with allowlist hygiene and false-positive review.
- Week 6: add compliance evidence packaging (artifacts + review sign-off template).
- Week 7: expand schema and consistency assertions for new data surfaces.
- Week 8: raise branch/function thresholds in CI with opt-in strict mode first.
- Week 9: reduce open engineering security findings through focused remediation set.
- Week 10: verify trend sustainability (2-week hold on coverage and security trajectory).
- Week 11: run pre-closeout audit dry-run and resolve drift findings.
- Week 12: complete closeout report with target attainment and carry-over risks.

## Risk Register (Starter)

- R1: Branch coverage uplift slows delivery velocity. Owner: `<owner-quality>`. Mitigation: keep tests branch-focused and small.
- R2: Broader scans increase false positives. Owner: `<owner-security>`. Mitigation: path-scoped noise controls + explicit ignore rules.
- R3: Compliance artifacts drift from reality. Owner: `<owner-compliance>`. Mitigation: CI guard validating tracker freshness and shape.
- R4: Dependency audit regressions reappear. Owner: `<owner-release>`. Mitigation: keep high-severity gate in PR workflow.

## Weekly Review Checklist

Run from `ai-platform`:

1. `npm run simplebeacon:report`
2. `npm run simplebeacon:assess -- --output .simplebeacon/assessment.json`
3. `npm run test:coverage`
4. `npm audit --audit-level=high`
5. `npm run compliance:check`
6. `npm run compliance:audit-baseline`

## Weekly Update Procedure

1. Run the checklist commands and capture outputs.
2. Update `.simplebeacon/audit-baseline-tracker.json` current metric values from latest artifacts:
   - scan + schema + scan paths + mock count from `.simplebeacon/report.json`
   - coverage from `coverage/dashboard/coverage-summary.json`
   - security posture from `web/data/security-dashboard-sample.json` overview.
3. Update `updatedAt` in tracker JSON.
4. Verify with `npm run compliance:audit-baseline`.
5. If values moved materially, update this markdown board in the same change.
