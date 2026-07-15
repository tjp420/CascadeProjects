# GitHub Marketplace Publication Checklist

Use this before tagging `v1.0.0` on the public `simplebeacon/guardrails` repository.

## Repository setup

- [ ] Public repo `simplebeacon/guardrails` with root `action.yml` (copy from `github-action/action.yml`)
- [ ] Tag semver release (`v1`, `v1.0.0`) — Marketplace reads tagged releases
- [ ] `README.md` includes badges, `fetch-depth: 0` warning, tier table
- [ ] `LICENSE` (MIT or commercial — match npm package)

## Action metadata (`action.yml`)

- [ ] `name` — **SimpleBeacon AI Guardrails**
- [ ] `description` — AI Circuit Breaker one-liner (≤ 125 chars for Marketplace card)
- [ ] `author` — `SimpleBeacon.ai`
- [ ] `branding.icon` — `shield`
- [ ] `branding.color` — `blue`
- [ ] All inputs documented with defaults
- [ ] `runs.using: composite` (no native deps — uses `npm install -g simplebeacon`)

## Marketplace listing (GitHub UI)

- [ ] Category: **Code quality** or **Security**
- [ ] Icon uploaded (512×512 PNG)
- [ ] Short description matches action.yml
- [ ] Link to https://simplebeacon.ai/pricing for Team tier
- [ ] Link to `packages/simplebeacon-cli/docs/GITHUB-ACTION-QUICKSTART.md`

## Runner verification (smoke test)

Run on `ubuntu-latest`, `windows-latest`, `macos-latest`:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
- uses: simplebeacon/guardrails@v1
  with:
    fail-on: high
    full-scan: false
```

Expected:

- [ ] Scan completes without native module compile errors
- [ ] PR comment posted on `pull_request` events
- [ ] Job summary populated
- [ ] Gate exit code 0 on clean repo, 1 on seeded violation
- [ ] Invalid `license-token` fails the job (fail-closed)
- [ ] Missing token runs community sandbox (fail-open on license server outage)

## Security review

- [ ] `license-token` stored as GitHub secret only — never logged
- [ ] Telemetry payload excludes file paths and source code (metadata only)
- [ ] `GITHUB_TOKEN` scoped to `pull-requests: write` minimum

## Post-launch

- [ ] Add Marketplace badge to simplebeacon.ai homepage
- [ ] Pin quickstart in docs site navigation
- [ ] Monitor first 10 installs for shallow-clone (`fetch-depth: 1`) support tickets
