# Production Deploy Profile W1-W6 Tracker

Updated: 2026-05-25  
Canonical execution framework: `docs/reports/LAUNCH_ACTION_PLAN.md` adapted to 6-week production deploy profile.  
Machine-readable source: `docs/production-deploy-profile-w1-w6-tracker.json`

## Status summary (W1..W6)

- Done: 8
- In progress: 2
- Blocked: 6

## Week-by-week execution

### W1 — Critical path deploy gates

- DONE: production auth fail-fast controls are implemented.
- DONE: deploy workflow gate markers are present (`PASS:4` in `.simplebeacon/w1-ci-deploy-gate-check.txt`).
- IN_PROGRESS: predeploy sequence is executable but currently returns `NO-GO`.
- BLOCKED: production env completeness and Stripe host secrets.

Evidence:

- `.simplebeacon/w1-verify-predeploy.txt`
- `.simplebeacon/w1-verify-production-deploy.txt`
- `.simplebeacon/w1-ci-deploy-gate-check.txt`

Gate:

- `npm run verify:predeploy` must return `Decision: GO`.

### W2 — Quality and trust

- DONE: compliance gate passes (`8/8`).
- DONE: smoke suite passes.
- DONE: trust publish local artifacts + audit are generated.
- BLOCKED: remote trust endpoint/token provisioning (non-strict mode currently allows skip).

Evidence:

- `.simplebeacon/w2-compliance-check.txt`
- `.simplebeacon/w2-smoke-test.txt`
- `.simplebeacon/w2-trust-validate-env.txt`
- `.simplebeacon/w2-trust-publish.txt`
- `.simplebeacon/w2-trust-trend.txt`

Gate:

- Compliance/smoke/trust local path must remain green.

### W3 — Optimization and hardening

- DONE: Docker compose render/validation path exists and passes.
- DONE: deploy script enforces predeploy checks before deployment.

Evidence:

- `.simplebeacon/w1-docker-config.txt`
- `scripts/deploy-simplebeacon.sh`

Gate:

- Docker config verification remains stable with security defaults.

### W4+ — Strategic/governance

- BLOCKED: branch protection and required checks enforcement requires repo-admin action.
- BLOCKED: security/ops formal sign-offs are human/governance tasks.

Evidence:

- `docs/production-profile-verification-status.md`

Gate:

- Required governance controls and sign-offs recorded.

### W5 — Deploy and rollback readiness

- BLOCKED: dry-run deployment depends on W1 secret/env closure.
- BLOCKED: rollback drill needs host execution and sign-off.

Evidence:

- `docs/v1-internal-runbook.md`
- `docs/launch-decision.md`

Gate:

- dry run + rollback drill completed with evidence.

### W6 — Monitoring and operations

- IN_PROGRESS: launch readiness framework executable, but decision currently `NO-GO`.
- DONE: trust trend metrics are available and stable.

Evidence:

- `.simplebeacon/w6-verify-launch-readiness.txt`
- `.simplebeacon/launch-readiness-summary.json`
- `.simplebeacon/w2-trust-trend.txt`

Gate:

- `npm run verify:launch-readiness` returns `Decision: GO`.

## Operational runbook slice

### Pre-deploy checklist

1. Validate production env posture:
   - `npm run verify:production-deploy`
2. Validate Stripe configuration:
   - `npm run verify:stripe`
3. Validate combined release path:
   - `npm run verify:predeploy`

### Deploy sequence

1. `npm run verify:launch-readiness`
2. `npm run simplebeacon:deploy`
3. `npm run smoke:test:production`
4. `npm run trust:publish`
5. `npm run trust:trend`

### Rollback triggers

Trigger rollback if any occur:

- predeploy decision is `NO-GO`
- post-deploy smoke test fails
- health endpoints fail repeatedly
- critical auth/security regression observed

### Post-deploy validation

- `npm run smoke:test:production`
- Verify trust payload/audit artifacts:
  - `public/trust-verification.json`
  - `.simplebeacon/trust-publish-audit.json`

### Week 6 monitoring/ops checklist

- Run and archive:
  - `npm run verify:launch-readiness`
  - `npm run trust:trend`
  - `npm run compliance:check`
- Review trend metrics and gate status in weekly ops review.

## Strict vs non-strict behavior

- Non-strict defaults remain non-breaking for CI/automation:
  - `TRUST_PUBLISH_STRICT=false`
  - `TRUST_PUBLISH_REQUIRED=false`
  - `TRUST_PUBLISH_REQUIRE_TOKEN=false`
- Strict release decision path is explicit:
  - `npm run verify:predeploy`
  - `npm run verify:launch-readiness`

## Minimum critical path to reach production GO

1. **SRE/Operations**: set missing production env values and re-run `verify:production-deploy` until no FAIL lines.
2. **Billing Ops + Security**: provision Stripe live secrets and re-run `verify:stripe` until no blocking FAIL lines.
3. **Platform + QA**: re-run `verify:predeploy` and `verify:launch-readiness` until both report `Decision: GO`.
4. **Repo Admin + Security + SRE**: complete branch-protection and formal sign-offs.
