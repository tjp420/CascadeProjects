# ⚡ SimpleBeacon AI Guardrails Quickstart

SimpleBeacon acts as an **AI Circuit Breaker** for your Pull Requests. It automatically scans modified code blocks, checks for pattern anomalies or credential leaks, and blocks the merge if criteria fail.

## 🚀 1-Minute GitHub Actions Integration

Create or edit your `.github/workflows/simplebeacon.yml` file:

```yaml
name: SimpleBeacon Gate

on:
  pull_request:
    branches: [main, master, develop]

permissions:
  contents: read
  pull-requests: write

jobs:
  ai-circuit-breaker:
    runs-on: ubuntu-latest
    steps:
      # ⚠️ CRITICAL: fetch-depth: 0 is required for diff-only scanning modes
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run SimpleBeacon AI Guardrails
        uses: simplebeacon/guardrails@v1
        with:
          license-token: ${{ secrets.SIMPLEBEACON_LICENSE_TOKEN }}
          fail-on: 'high'
          full-scan: false
```

## 💡 How the Tiers Behave in CI

- **Community Sandbox (No Token)**: Fully functional! Scans your PR diffs, flags security and logic concerns, and posts inline Markdown comments directly inside your PR.
- **Team Tier (Valid License Token)**: Unlocks multi-repository data centralization on [simplebeacon.ai/dashboard](https://simplebeacon.ai/dashboard), custom company scan policies, slack/email alert routing, and historical compliance trends for management reporting.
- **Fail-Open Policy**: If our licensing server drops offline for any reason, the pipeline gracefully downgrades to Sandbox mode and prints a warning. **Your deployment pipelines will never break due to a remote network timeout.**

## Shallow clone troubleshooting

If you see errors like `unknown revision` or `bad revision` during diff scans, your checkout step is almost certainly using `fetch-depth: 1`. SimpleBeacon needs the merge base commit to compute the PR diff.

**Fix:** set `fetch-depth: 0` on `actions/checkout@v4` (see workflow above).

## npx alternative (no Marketplace action)

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0

- uses: actions/setup-node@v4
  with:
    node-version: '22'

- name: Run SimpleBeacon gate
  env:
    SIMPLEBEACON_LICENSE_TOKEN: ${{ secrets.SIMPLEBEACON_LICENSE_TOKEN }}
  run: |
    npx --yes simplebeacon scan --gate --diff \
      --fail-on high \
      --format json \
      --output .simplebeacon/report.json

- name: Post PR comment
  if: github.event_name == 'pull_request'
  env:
    GITHUB_TOKEN: ${{ github.token }}
    GITHUB_REPOSITORY: ${{ github.repository }}
    GITHUB_EVENT_PULL_REQUEST_NUMBER: ${{ github.event.pull_request.number }}
  run: npx --yes simplebeacon comment --report .simplebeacon/report.json
```

## Team dashboard metric

When a paid license token is active, each CI run posts **metadata only** (scan counts, gates tripped, criticals blocked — never source code) to your Team dashboard. Engineering leads see **Merges Blocked This Week** on [simplebeacon.ai/dashboard](https://simplebeacon.ai/dashboard).

## First-time repo setup

1. `npx simplebeacon init --profile standard`
2. Commit `.simplebeacon/config.json`
3. Run locally: `npx simplebeacon scan --gate --diff`
4. Add the workflow above
5. Open a PR — comment + job summary appear automatically

See [MARKETPLACE-CHECKLIST.md](../../../github-action/MARKETPLACE-CHECKLIST.md) for publication steps.
