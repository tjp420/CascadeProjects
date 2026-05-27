# Compliance Monitoring Runbook

Continuous DevSecOps monitoring for Simplebeacon compliance automation.

## Scope

This runbook covers daily/weekly checks, thresholds, incident response, and rollback policy for compliance regressions.

Primary automation points:

- `.github/workflows/simplebeacon-perimeter.yml` (PR/push + scheduled daily run)
- `.github/workflows/simplebeacon-pr-gate.yml` (PR gate)
- `.github/workflows/simplebeacon.yml` (lightweight gate)
- Local hooks in `.husky/pre-commit` and `.husky/pre-push`

## Daily checks

1. Review latest perimeter and PR gate workflow runs.
2. Download artifacts when a run warns/fails:
   - `.simplebeacon/report.json`
   - `.simplebeacon/assessment.json`
   - `.simplebeacon/compliance-monitoring.json`
   - `.simplebeacon/npm-audit.json` (PR gate)
3. Confirm gate status in `report.json`:
   - `gate.pass === true` expected
   - `severityCounts.high === 0` expected
4. Confirm trust payload publication step completed (local artifact write is always expected).

## Weekly checks

1. Trend review from `.simplebeacon/history.json` and workflow summaries:
   - gate pass rate
   - high severity findings count
   - scan duration drift
2. Validate baseline alignment:
   - `npm test -- --no-coverage --passWithNoTests`
   - `npm run simplebeacon:baseline-sync` (only when Jest/page baselines legitimately changed)
3. Validate deployment readiness script output:
   - `npm run verify:production-deploy`
4. Review quality maintenance artifacts:
   - `.simplebeacon/extended-schema-coverage.json`
   - `.simplebeacon/fiction-kpi-guard-report.json`
   - `.simplebeacon/quality-maintenance-metrics.json`

## Thresholds and alert handling

- **Critical threshold (blocker):**
  - `severityCounts.high > 0`
  - gate fail (`gate.pass !== true`)
  - missing compliance artifact generation in CI after scan step succeeded
- **Warning threshold (triage in next business day):**
  - repeated medium findings in same rule category for 3+ consecutive runs
  - repeated npm audit high advisories in PR gate artifact
  - trust publish remote warnings with `TRUST_PUBLISH_STRICT=false`
  - extended schema pass-rate below 90% (`extended-schema-coverage.json`)

## Incident response path (compliance regression)

1. **Detect:** CI failure or scheduled-run warning.
2. **Contain:** pause production deploy job for affected branch/release.
3. **Triage:**
   - inspect `.simplebeacon/report.json` `rawIssues`
   - inspect `.simplebeacon/assessment.json` executive summary
   - inspect `.simplebeacon/compliance-monitoring.json` for quick gate snapshot
4. **Remediate:** fix offending code/config and rerun local checks.
5. **Verify:** rerun workflows and confirm artifact + gate pass.
6. **Document:** add short note to PR/release thread with issue type and fix.

Escalate to security owner when issue type is credential leak, production leak, or repeated supply-chain advisories.

## Rollback policy

If compliance regression is discovered post-merge:

1. Revert the smallest change set that introduced the failing finding.
2. Re-run:
   - `npm run simplebeacon:report`
   - `npm run simplebeacon:assess -- --output .simplebeacon/assessment.json`
   - `npm run compliance:check`
3. Confirm CI gate pass before redeploy.
4. If rollback is not immediately possible, disable deploy trigger while mitigation PR is in progress.

## Local and CI commands

Run from repo root:

```bash
sh scripts/simplebeacon-pre-commit.sh
sh scripts/simplebeacon-pre-push.sh
SIMPLEBEACON_ENFORCE_LOCAL_COMPLIANCE=true sh scripts/simplebeacon-pre-commit.sh
```

Run from `ai-platform/`:

```bash
npm run simplebeacon:report
npm run schema:coverage:extended
npm run guard:fiction-kpi:ci
npm run metrics:quality:build
npm run simplebeacon:assess -- --output .simplebeacon/assessment.json
npm run compliance:check
npm audit --audit-level=high --json > .simplebeacon/npm-audit.json
npm run verify:production-deploy
```

## Enforcement notes

- Local hooks remain fast by default.
- Additional local compliance checks are opt-in via:
  - `SIMPLEBEACON_ENFORCE_LOCAL_COMPLIANCE=true`
  - or running `sh scripts/simplebeacon-compliance-check.sh`
  - strict fiction guard locally: `npm run guard:fiction-kpi:strict`
- CI remains the source of merge enforcement through existing gate workflows and branch protection.
