# SimpleBeacon AI Guardrails

**The AI Circuit Breaker for PRs.** Catch security leaks, compliance drift, and rogue logic in AI-generated code before merge.

## Usage

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
      # Required for diff-only scans — shallow clones break base ref resolution
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: simplebeacon/guardrails@v1
        with:
          license-token: ${{ secrets.SIMPLEBEACON_LICENSE_TOKEN }}
          fail-on: high
          full-scan: false
```

## What It Does

1. Scans the PR diff (or full repo when `full-scan: true`)
2. Posts a structured **AI Circuit Breaker** comment on the PR
3. Writes a job summary with gate status
4. Fails the check when severity meets `fail-on` threshold
5. **Team tier:** posts metadata-only telemetry to your dashboard (Merges Blocked This Week)

## Tiers

| Feature                     | Community (no token) | Team ($49–199/mo) |
| --------------------------- | -------------------- | ----------------- |
| PR diff scan                | ✅                   | ✅                |
| PR comments                 | ✅                   | ✅                |
| Fail-open on license outage | ✅                   | ✅                |
| Team dashboard metrics      | —                    | ✅                |
| Multi-repo centralization   | —                    | ✅                |
| Custom policies & alerts    | —                    | ✅                |

Invalid tokens **fail closed**. Missing tokens or license server outages **fail open** to community sandbox.

## Inputs

| Input           | Required | Default         | Description                             |
| --------------- | -------- | --------------- | --------------------------------------- |
| `token`         | Yes      | `github.token`  | GitHub token for posting comments       |
| `license-token` | No       | —               | Team license token from simplebeacon.ai |
| `fail-on`       | No       | `high`          | Minimum severity to block merge         |
| `full-scan`     | No       | `false`         | Scan entire repo instead of PR diff     |
| `scan-args`     | No       | `--gate --diff` | Extra CLI arguments                     |
| `base-ref`      | No       | PR base         | Override diff base ref                  |

## Publication

See [MARKETPLACE-CHECKLIST.md](./MARKETPLACE-CHECKLIST.md) before tagging `v1`.

Full quickstart: [packages/simplebeacon-cli/docs/GITHUB-ACTION-QUICKSTART.md](../packages/simplebeacon-cli/docs/GITHUB-ACTION-QUICKSTART.md)
