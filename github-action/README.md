# SimpleBeacon GitHub Action

Catch AI-generated code slop, credential leaks, and hallucinations in every pull request.

## Usage

```yaml
name: SimpleBeacon Guardrails
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  simplebeacon:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: simplebeacon/guardrails@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          # Optional: remove free-tier limits
          # license-token: ${{ secrets.SIMPLEBEACON_LICENSE_TOKEN }}
```

## What It Does

1. Scans the PR diff for AI slop patterns, credential leaks, and production leaks
2. Posts findings as a PR comment with severity breakdown
3. Fails the check if gate doesn't pass (configurable via `fail-on`)

## Free vs Paid

| Feature | Free | Paid ($49/mo) |
|---------|------|---------------|
| PR comments | ✅ | ✅ |
| Severity counts | ✅ | ✅ |
| Inline annotations | — | ✅ |
| Quality score | Hidden | ✅ |
| Full findings | First 5 only | Unlimited |
| Team dashboard | — | ✅ |

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `token` | Yes | `github.token` | GitHub token for posting comments |
| `license-token` | No | — | Removes free-tier limits |
| `fail-on` | No | `high` | Minimum severity to fail the check |
| `scan-args` | No | `--gate` | Extra CLI arguments |
