# Simplebeacon PR Gate Workflow

This runbook defines the pull-request compliance gate for `ai-platform` changes.

## What the PR gate runs

Workflow file: `.github/workflows/simplebeacon-pr-gate.yml` (canonical; legacy `samplebeacon-pr-gate.yml` removed May 2026)

On every PR to `main`/`master` touching `ai-platform/**`, the job runs:

1. `npm ci`
2. `npm run simplebeacon:report`
3. `npm run guard:fiction-kpi:ci` (visibility-first, non-blocking)
4. `npm run schema:coverage:extended` (visibility-first, non-blocking)
5. `npm run simplebeacon:assess -- --output .simplebeacon/assessment.json`
6. `npm run metrics:quality:build`
7. `npm run trust:publish` (always writes local trust payload, optional remote publish)
8. `npm audit --audit-level=high --json > .simplebeacon/npm-audit.json`
9. `npm test -- --no-coverage --passWithNoTests`
10. PR comment + artifact upload

## Branch protection setup

In GitHub repository settings:

- Go to `Settings -> Branches -> Branch protection rules`.
- Add or edit the rule for `main` (and `master` if used).
- Enable `Require status checks to pass before merging`.
- Require this check:
  - `PR compliance gate`

Optional companion checks:

- `Perimeter scan & compliance`
- `Dashboard CI / test`

## Artifact usage

Each PR run uploads:

- `ai-platform/.simplebeacon/report.json`
- `ai-platform/.simplebeacon/assessment.json`
- `ai-platform/.simplebeacon/npm-audit.json`
- `ai-platform/.simplebeacon/compliance-monitoring.json`
- `ai-platform/.simplebeacon/fiction-kpi-guard-report.json`
- `ai-platform/.simplebeacon/extended-schema-coverage.json`
- `ai-platform/.simplebeacon/quality-maintenance-metrics.json`

Use these artifacts to review gate failures without rerunning locally.

## Trust publish configuration

PR gate sets these env vars when running `npm run trust:publish`:

- `TRUST_PUBLISH_ENDPOINT` from `SIMPLEBEACON_TRUST_PUBLISH_URL`
- `TRUST_PUBLISH_TOKEN` from `SIMPLEBEACON_TRUST_PUBLISH_TOKEN`
- `TRUST_PUBLISH_STRICT=false`
- `TRUST_PUBLISH_REQUIRED=false`

This keeps publish non-blocking until production trust endpoint credentials are available.

## Local parity commands (before opening a PR)

Run from `ai-platform/`:

```bash
npm ci
npm run simplebeacon:report
npm run guard:fiction-kpi:ci
npm run schema:coverage:extended
npm run simplebeacon:assess -- --output .simplebeacon/assessment.json
npm run metrics:quality:build
npm audit --audit-level=high --json > .simplebeacon/npm-audit.json
npm test -- --no-coverage --passWithNoTests
```

## Notes on SUPPLY-002 and AUTH-001

- `SUPPLY-002` maps to high-severity npm audit findings. Use `npm-audit.json` from the PR artifact to identify the package and path.
- `AUTH-001` should be validated separately with your auth configuration checks (JWT secret policy, algorithm restrictions, token lifetime, and issuer/audience checks) as part of your app-level tests and review.
