# Production Profile Verification Status

Updated: 2026-05-25
Scope: practical tranche for production deploy profile verification

## REQUIRE_AUTH

### Code-verifiable controls

- COMPLETE: auth gate enforced for non-public API routes when `REQUIRE_AUTH=true` via `server/bootstrap/phase2-integration.js` (`installOptionalApiAuth` + `authenticate` middleware).
- COMPLETE: startup fail-fast for missing JWT secrets when `REQUIRE_AUTH=true` via `assertAuthConfiguration`.
- COMPLETE: login endpoint payload validation + auth rate limiting on `/api/auth/login`.
- COMPLETE: production-mode auth safety fail-fast now blocks startup when any of these are unsafe:
  - `NODE_ENV=production` with `REQUIRE_AUTH!=true`
  - `NODE_ENV=production` with `SEED_DEMO_USERS!=false`
  - `NODE_ENV=production` with `ALLOW_LEGACY_LOGIN=true`
  (implemented in `assertProductionAuthSafety` in `server/bootstrap/phase2-integration.js`)
- COMPLETE: canonical public-route allowlist centralized in `server/bootstrap/public-api-routes.js`.

### Sign-off artifacts currently in repo

- `tools/verify-production-deploy-readiness.js` validates production env posture and secret presence.
- `.simplebeacon/compliance-result.json`, `.simplebeacon/assessment.json`, and workflow-generated compliance artifacts provide scan-based evidence.

### Human/org sign-off still required

- PENDING (Owner: Security/Platform): approve production secret provisioning and rotation process for `JWT_SECRET` and `JWT_REFRESH_SECRET` on the host/secret manager.
- PENDING (Owner: Product/Security): approve auth bypass/public route policy for billing, trust, assessment, and optimization public endpoints.
- PENDING (Owner: Operations): validate and sign off production demo-account policy (`SEED_DEMO_USERS=false`) on live infrastructure.

Status: IN_PROGRESS (code controls materially tightened; approvals pending)

## Docker Phase2

### Current readiness

- READY: compose health checks exist for `dashboard`, `postgres`, and `redis`.
- READY: full-stack Phase2 overlay wires DB/Redis dependencies with health-gated startup in `docker-compose.simplebeacon.full.yml`.
- READY: baseline Docker image has `tini`, healthcheck, and production `NODE_ENV`.

### Low-risk hardening implemented

- COMPLETE: security defaults added to dashboard service in `docker-compose.simplebeacon.yml`:
  - `security_opt: no-new-privileges:true`
  - `cap_drop: [ALL]`
- COMPLETE: explicit auth-safety env defaults in compose/env template:
  - `SEED_DEMO_USERS=false`
  - `ALLOW_LEGACY_LOGIN=false`
  (files: `docker-compose.simplebeacon.yml`, `docker/env.simplebeacon.example`)
- COMPLETE: runbook now includes Docker Phase2 production verification commands and expected outputs (`docs/v1-internal-runbook.md`).

### Human/org sign-off still required

- PENDING (Owner: SRE/Operations): host-level backup/restore verification for Postgres volumes and `.simplebeacon` state.
- PENDING (Owner: Security): production image/runtime hardening review beyond compose-level defaults (base image patch cadence, vulnerability exceptions).
- PENDING (Owner: Operations): production env file ownership/permissions audit (`.env.production`, `.env.docker`) on target hosts.

Status: READY (for Phase2 finalization verification execution)

## GitHub CI

### Current readiness

- READY: perimeter and PR-gate workflows already enforce scan + assessment + test flows and artifact uploads.
- READY: production deploy workflow gates deploy on compliance job success.

### Low-risk hardening implemented

- COMPLETE: added supply-chain gate in deploy compliance stage:
  - `npm audit --audit-level=high --json > .simplebeacon/npm-audit.json`
- COMPLETE: added Docker config render verification artifact in deploy compliance stage:
  - `npm run simplebeacon:docker:config > .simplebeacon/docker-config.rendered.yml`
- COMPLETE: added deploy compliance step summary (`$GITHUB_STEP_SUMMARY`) including:
  - simplebeacon gate summary
  - assessment headline
  - npm audit severity counts
- COMPLETE: added artifact uploads for:
  - `.simplebeacon/npm-audit.json`
  - `.simplebeacon/docker-config.rendered.yml`

### Human/org sign-off still required

- PENDING (Owner: Repo Admin): branch protection rules must require the intended production gate workflows/check names before merge.
- PENDING (Owner: Security): approve severity policy (`high` as fail threshold) and any documented exceptions.
- PENDING (Owner: DevEx): verify artifact retention period and access controls satisfy compliance expectations.

Status: READY (production integration gates hardened, pending governance)

## Overall profile status

- REQUIRE_AUTH: IN_PROGRESS
- Docker Phase2: READY
- GitHub CI: READY
- Pre-deploy sequence: READY

Overall: IN_PROGRESS toward COMPLETE

What moved this tranche:

- STARTED/IN_PROGRESS -> COMPLETE:
  - production auth safety fail-fast checks (code-level)
  - Docker compose security defaults and auth-safe env defaults
  - deploy workflow audit/config gates, summaries, and artifacts
  - explicit verification runbook commands with expected outcomes
- STARTED/IN_PROGRESS -> READY:
  - Docker Phase2 finalization verification path
  - GitHub CI production integration hardening path
  - single pre-deploy go/no-go verification sequence (`npm run verify:predeploy`)

## Blockers and owners

- Branch protection + required checks not verifiable in-repo alone — Owner: Repo Admin.
- Security approval for public endpoint policy + auth/secret management — Owner: Security.
- Production host operational sign-off (secrets, backups, restore drill evidence) — Owner: SRE/Operations.
- Business/legal launch approvals (if required by your org) — Owner: Product/Leadership/Legal.
