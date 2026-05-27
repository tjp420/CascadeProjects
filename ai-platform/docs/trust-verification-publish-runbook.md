# Trust Verification Publish Runbook

This runbook documents safe trust badge publishing for CI and local runs.

## What now runs in CI

Both workflows now execute `npm run trust:publish` after a successful scan:

- `.github/workflows/simplebeacon-perimeter.yml`
- `.github/workflows/simplebeacon-pr-gate.yml`
- `.github/workflows/simplebeacon.yml`

That command always writes `ai-platform/public/trust-verification.json` and can optionally publish the payload to a remote endpoint.

## Environment variables for remote publish

`tools/publish-trust-verification.js` supports:

- `TRUST_PUBLISH_ENDPOINT` (or `SIMPLEBEACON_TRUST_PUBLISH_URL`)
- `TRUST_PUBLISH_TOKEN` (or `SIMPLEBEACON_TRUST_PUBLISH_TOKEN`)
- `TRUST_PUBLISH_STRICT` (`true` fails job on remote publish errors, default `false`)
- `TRUST_PUBLISH_REQUIRED` (`true` fails when endpoint missing, default `false`)
- `TRUST_PUBLISH_REQUIRE_TOKEN` (`true` fails when token missing, default `false`)
- `TRUST_PUBLISH_ALLOW_HTTP` (`true` allows non-HTTPS endpoint; default blocks HTTP)
- `TRUST_HISTORY_MAX` (max retained trust snapshots in `.simplebeacon/trust-history.json`, default `180`)

CI is configured non-blocking by default:

- `TRUST_PUBLISH_STRICT=false`
- `TRUST_PUBLISH_REQUIRED=false`
- `TRUST_PUBLISH_REQUIRE_TOKEN=false`
- `TRUST_PUBLISH_ALLOW_HTTP=false`

This keeps scan gates reliable even when production endpoint/secrets are not yet configured.

Every trust publish run now emits audit artifacts:

- `.simplebeacon/trust-publish-env-validation.json`
- `.simplebeacon/trust-publish-audit.json`

These are uploaded in Simplebeacon workflows and summarized in `GITHUB_STEP_SUMMARY` for daily auditability.

## Production badge deployment readiness (Week 1-4)

Production assumptions are now validated explicitly before publish:

- Endpoint/TLS assumptions:
  - Endpoint must be HTTPS unless `TRUST_PUBLISH_ALLOW_HTTP=true`.
  - Localhost endpoints are flagged as non-production.
- Optional strict enforcement:
  - `TRUST_PUBLISH_REQUIRED=true` fails when endpoint missing.
  - `TRUST_PUBLISH_REQUIRE_TOKEN=true` fails when token missing.
  - `TRUST_PUBLISH_STRICT=true` fails on invalid endpoint or remote publish errors.

Operator checklist for production trust badge:

1. Provision public trust API endpoint behind CDN + valid SSL certificate.
2. Set repo secrets:
   - `SIMPLEBEACON_TRUST_PUBLISH_URL`
   - `SIMPLEBEACON_TRUST_PUBLISH_TOKEN` (required if endpoint enforces auth)
3. Keep CI non-blocking initially (`STRICT=false`) until endpoint stability is verified.
4. Move to strict mode after proving publish reliability in staging/prod.

No infra secrets are hardcoded in repository scripts.

## GitHub secrets to add for live publishing

Add these repository secrets to enable remote trust payload publishing:

- `SIMPLEBEACON_TRUST_PUBLISH_URL`
- `SIMPLEBEACON_TRUST_PUBLISH_TOKEN` (optional unless strict token requirement is enabled)

Recommended URL target:

- `https://<your-trust-host>/api/trust/publish`

## Local validation

Run from `ai-platform/`:

```bash
npm run simplebeacon:report
npm run trust:publish
```

Optional strict validation:

```bash
TRUST_PUBLISH_REQUIRED=true TRUST_PUBLISH_STRICT=true npm run trust:publish
```

## Scope expansion (Week 1-2 trust tranche)

Low-risk scan scope expansion was added by including:

- `data/roadmap`

in `.simplebeacon/config.json` `scanPaths`.

Rationale:

- `data/roadmap` contains JSON roadmap snapshots close to trust-report narratives.
- Adding this path improves coverage of publish-facing roadmap data without scanning broad docs or tests trees that can add noise.

Noisy sources remain excluded:

- `tests/**`
- `docs/**`
- `archive/**`

## File-size quick wins included

Additional generated artifact exclusions were added to `.simplebeacon/config.json`:

- `coverage-*/**`
- `test-results/**`
- `.nyc_output/**`

These reduce scan churn and artifact bloat risk without changing application behavior.

## Scope expansion (Weeks 3-6)

Current scan scope now incrementally extends from mock-data + roadmap into low-noise config/infra surfaces:

- Added scan paths:
  - `config`
  - `.github/workflows`
  - `docker`
  - `.simplebeacon` (for trust/governance JSON only; noisy report artifacts ignored)
- Existing scope retained:
  - `web/data`
  - `data/mock`
  - `data-central/ai-tools/mock-data`
  - `data/roadmap`

Guardrails to keep noise low:

- Excluded generated/bundled assets:
  - `**/*.min.js`, `**/*.bundle.js`, `**/*.lock`, `**/*.log`
- Excluded markdown/docs-heavy trees from scan paths:
  - `**/*.md`, `infra/**/*.md`
- Excluded infra/deployment transient output:
  - `docker/**/tmp/**`, `docker/**/.cache/**`
- Excluded non-trust CI workflows and `.simplebeacon` generated artifacts:
  - `.github/workflows/deploy-production.yml`, `.github/workflows/dashboard-ci.yml`, `.github/workflows/ci.yml`, `.github/workflows/ci-cd-pipeline.yml`, `.github/workflows/*release*.yml`
  - `.simplebeacon/*report*.json`, `.simplebeacon/*assessment*.json`, `.simplebeacon/*audit*.json`, `.simplebeacon/*monitoring*.json`, `.simplebeacon/hooks/**`
  - `.simplebeacon/history.json`, `.simplebeacon/tranche-lib-scan.json`, `.simplebeacon/user-ai-keys.json`

Rationale:

- Captures trust-relevant runtime config/deploy artifacts without pulling in large generated or documentation trees.
- Preserves existing gate semantics (`failOn: high`) and avoids broad source-tree scanning regressions.

Estimated scope delta for this tranche:

- Prior scoped paths in active config: 7 paths
- New high-value paths in this tranche: +3 (`.github/workflows`, `docker`, `.simplebeacon` trust/governance surfaces)
- Net configured scan path growth: ~43% over previous scoped path set, while repository-level effective scan remains low single-digit due to strict ignore filters and extension gating.

## Continuous trust monitoring and history

Trust publish now writes both:

- `public/trust-verification.json` (current snapshot, existing behavior)
- `.simplebeacon/trust-history.json` (rolling historical snapshots)

New scripts:

- `npm run trust:history`
  - Shows latest history entries (human-readable)
- `npm run trust:trend`
  - Shows summary trend metrics (windowed)

Optional controls:

- `TRUST_HISTORY_MAX` controls retained history entries (default 180).

Example commands:

```bash
npm run simplebeacon:report
npm run trust:publish
npm run trust:history
npm run trust:trend
```

Expected output highlights:

- `trust:publish` includes `history snapshot: <path> (<count> entries)`
- `trust:trend` includes `Pass rate`, `Avg quality`, `Avg issues`, `Issue delta`, `Quality delta`

## Public trust API readiness (non-breaking)

Existing public endpoints remain unchanged:

- `/api/trust/verification`
- `/api/trust/verify`
- `/api/trust/badge.svg`
- `/api/trust/badge`

Added backward-compatible read-only endpoints:

- `/api/trust/history` (supports `?limit` and `?window`)
- `/api/trust/trend` (supports `?window`)
- `/api/trust/methodology` (scope transparency + methodology/disclaimer payload + trend rollup)

No production auth changes were required because routes are read-only and added to the existing public-route allowlist.

## Monitoring runbook (daily/weekly/monthly)

### Daily checks

Run:

```bash
npm run trust:validate-env
npm run simplebeacon:report
npm run trust:publish
npm run trust:trend
```

Watch for:

- `Issue delta` > `+5` (investigate same day)
- `Pass rate` dropping below `90%` in 7-30 snapshot window
- `Avg quality` below `85`

Response playbook:

1. Confirm whether issue increase came from scope additions or real regressions.
2. Triage high-severity findings first (`gate` blockers).
3. Re-run `npm run simplebeacon:report` after fixes and republish trust snapshot.
4. Inspect `.simplebeacon/trust-publish-audit.json` and step summary for publish status.

### Weekly checks

Run:

```bash
npm run trust:history -- --json --limit=30
```

Review:

- Trend direction for quality and issue count over last 30 snapshots.
- Repeated oscillations that indicate flaky scan inputs or unstable config.

Action:

- Add or tighten ignore rules only when confirmed false positives are recurring.
- Keep scope expansions incremental and documented in this runbook.

### Monthly checks

Run:

```bash
npm run trust:trend -- --window=90
```

Review:

- 90-snapshot baseline movement and sustained trust posture.
- Whether current retention (`TRUST_HISTORY_MAX`) is sufficient for audit windows.

Action:

- Adjust retention if needed.
- Update trust transparency docs/API consumer guidance before broader external exposure.

## External trust page/API blockers (operator steps)

If exposing trust history/trend on a public domain requires infra changes:

- Configure static hosting and API routing for `/api/trust/*` endpoints.
- Provision `SIMPLEBEACON_TRUST_PUBLISH_URL` and optional token in CI secrets.
- If strict publish guarantees are required, set:
  - `TRUST_PUBLISH_REQUIRED=true`
  - `TRUST_PUBLISH_STRICT=true`
  - `TRUST_PUBLISH_REQUIRE_TOKEN=true`

Blocker note:

- This repository does not include production secret provisioning or public edge routing automation; operators must apply environment and gateway config in deployment infrastructure.
- CDN hostnames, SSL certificate issuance/renewal, and edge route ownership remain external infra tasks.
