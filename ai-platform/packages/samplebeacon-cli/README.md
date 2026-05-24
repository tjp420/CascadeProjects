# samplebeacon

**CI gate that blocks mock data, fiction KPIs, credential leaks, and production-path leaks before merge.**

[![npm version](https://img.shields.io/npm/v/samplebeacon)](https://www.npmjs.com/package/samplebeacon)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Why Samplebeacon

AI-assisted development produces repos full of:

- Inflated KPIs (`74.17% completion`, `47 features`)
- Hardcoded `-sample.json` paths in production code
- Demo credentials that look real
- Mock data shipped as if it were measured

Samplebeacon scans your codebase and **fails CI** when fiction tries to ship.

## Install

```bash
npm install -D samplebeacon
# or zero-install
npx samplebeacon init
```

## Quick start

```bash
npx samplebeacon init                  # auto-detects project layout
npx samplebeacon scan                  # scan and report
npx samplebeacon scan --gate           # exit 1 on blocking issues
npx samplebeacon baseline sync         # sync Jest counts after green tests
```

### Profiles

```bash
npx samplebeacon init --profile minimal    # credentials + production-leak only
npx samplebeacon init --profile standard   # all rules, generic defaults
npx samplebeacon init --profile cascade    # ai-platform dashboard preset
```

## Commands

| Command | Description |
|---------|-------------|
| `samplebeacon init` | Create `.samplebeacon/config.json` and `baseline.json` |
| `samplebeacon scan` | Scan project; `--gate` exits 1 on blocking issues |
| `samplebeacon baseline sync` | Run Jest and write pass counts to baseline |
| `samplebeacon comment` | Post PR comment from JSON report |

### Scan flags

| Flag | Description |
|------|-------------|
| `--path <dir>` | Project root (default: cwd) |
| `--config <file>` | Config path |
| `--format text\|json` | Output format |
| `--output <file>` | Write report to file |
| `--gate` | Fail when severities in `gate.failOn` are found |
| `--fail-on high,medium` | Override gate severities |
| `--with-jest` | Run tests and compare to baseline |
| `--verbose` | Show config warnings and scan paths |
| `--profile` | Force init profile |

## Rules

| Rule | Severity | Detects |
|------|----------|---------|
| `credentials` | high/medium | AWS keys, JWT, GitHub PATs, OpenAI keys, private keys |
| `json-schema` | high | Sample JSON violating page specs |
| `sample-consistency` | high | Cross-file KPI drift vs baseline |
| `roadmap` | medium | Legacy fiction roadmaps, oversized exports |
| `production-leak` | high/medium | Mock/sample paths in production code |
| `jest-baseline` | high | Jest pass count drift (optional, `--with-jest`) |

See [docs/RULES.md](docs/RULES.md) and [docs/CONFIG.md](docs/CONFIG.md).

**Go-to-market:** [docs/OUTREACH.md](docs/OUTREACH.md) · [Assessment report template](docs/examples/assessment-report-template.json) · [Production leak triage](docs/PRODUCTION-LEAK-TRIAGE.md)

## Complementary stack

```text
Snyk / GHAS     → known CVEs
SonarQube       → code smells, coverage
Samplebeacon    → fiction KPIs in sample JSON, mock paths in prod code, credential patterns
```

Run Samplebeacon in the same CI job as your existing security tools — it gates on different artifacts.

## GitHub Actions

### Standalone repo

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'
- run: npx samplebeacon init --profile minimal
- run: npx samplebeacon scan --gate --format json --output .samplebeacon/report.json
```

### Composite action

```yaml
- uses: ./ai-platform/action
  with:
    path: .
    fail-on: high
    post-comment: true
```

See [docs/CI.md](docs/CI.md) for GitLab and CircleCI examples.

## Starter template

Copy [examples/starter/.samplebeacon/](examples/starter/.samplebeacon/) into your repo for a minimal working config.

## Documentation

- [Configuration](docs/CONFIG.md)
- [CI Integration](docs/CI.md)
- [Rules reference](docs/RULES.md)
- [Marketing claims (verified)](docs/MARKETING.md)
- [Naming & branding research](docs/NAMING.md)
- [Landing page](docs/index.html)

## Development

```bash
cd packages/samplebeacon-cli
npm test
node bin/samplebeacon.js scan --path ../.. --gate
```

## License

MIT
