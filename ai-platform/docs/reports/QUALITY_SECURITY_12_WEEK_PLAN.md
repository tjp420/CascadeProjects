# Quality & Security Enhancement Plan (12 Weeks)

## Execution Tranches

- Weeks 1-2 (this tranche): baseline artifacts, compliance guard, config validation hardening, and safe scan scope expansion.
- Weeks 3-4: targeted branch-coverage uplift in high-impact API branches and security finding burn-down.
- Weeks 5-8: stricter validation and CI thresholds (opt-in first, then default), plus evidence packaging.
- Weeks 9-12: trend hold, final risk retirement, and closeout with measured target attainment.

## Week-by-Week Deliverables

- W1: baseline tracker JSON + markdown board + weekly review checklist.
- W2: CI/local compliance check for baseline freshness and shape; add one scan path with noise controls.
- W3: add tests for uncovered decision branches in `src/api/dashboard-stub-api.js`.
- W4: re-baseline metrics; enforce branch uplift target gate in advisory mode.
- W5: tighten credential scan signal-to-noise with reviewed ignore updates.
- W6: produce weekly compliance evidence bundle and owner sign-off template.
- W7: expand schema/consistency checks to new sample payloads.
- W8: promote coverage/security advisory gates to required where stable.
- W9: retire top open engineering security findings (non-breaking fixes).
- W10: prove two consecutive weekly stable metrics.
- W11: perform audit dry-run and reconcile deltas.
- W12: publish closeout report and next-quarter carry-over backlog.

## Metric Target Board

Primary source: `.simplebeacon/audit-baseline-tracker.json`

- Coverage targets: line `88`, branch `70`, function `82`, statement `87`.
- Security posture target: `88`.
- Compliance posture target: maintain schema compliance `100` and weekly guard pass.
- Dependency posture target: high/critical `0`.
