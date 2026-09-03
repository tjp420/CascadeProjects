# SimpleBeacon — Instructions

Quick reference runbook for common tasks.

Run a full gate locally
- From repo root:
  npx simplebeacon scan --full --gate --format json --output .simplebeacon/report.json

Run a package-level gate
- Example (ai-platform):
  npx simplebeacon scan --path ai-platform --gate --format json --output .simplebeacon/report-ai-platform.json

Run a staged-file pre-commit scan (mimic pre-commit behavior)
- Copy staged files into a temp folder and run the scan against them:
  node .simplebeacon/qa/pre-commit-gate.cjs

Secrets / gitleaks
- Install gitleaks (if missing):
  npm run install-gitleaks
- Run the repo-wide gitleaks detector (soft-fail during triage):
  gitleaks detect --source=. --redact --report-format=json --report-path=artifacts/gitleaks-report.json || true

Make a CI artifact available for triage
- Ensure scan command produces .simplebeacon/report.json; workflows typically upload this artifact using actions/upload-artifact.

Tips
- Use `--offline` where supported to avoid network fetches.
- Use `--format json` to persist machine-readable results for SARIF merging or automated analysis.
- For large repos prefer `--path` to scope scans and reduce time.

If you need to add a new rule or engine
- Update `.simplebeacon/config.json` with a new rule and add tests under `packages/simplebeacon-cli/rules/`.
- Run the local test harness and update `.simplebeacon/report.json` to validate behavior.