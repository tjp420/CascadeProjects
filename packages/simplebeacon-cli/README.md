# Simplebeacon

**Release hygiene for AI-assisted code** — local MCP + CLI gate. No repo upload required.

[![npm version](https://img.shields.io/npm/v/simplebeacon.svg)](https://www.npmjs.com/package/simplebeacon)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub](https://img.shields.io/github/stars/tjp420/simplebeacon?style=social)](https://github.com/tjp420/simplebeacon)

GitHub Copilot, Cursor, and other AI assistants often generate placeholder data that looks real. Simplebeacon scans your codebase and **fails CI** when mock metrics, dummy URLs, or demo credentials try to ship.

**36 MCP tools** · **48 analyzers** · **100% catch rate on AI-fiction bugs** · **1.43ms snippet scans** · **96.6% payload compression**

**Community ($0):** MCP snippet scans · full-repo `--gate` · GitHub Actions · zero extra MCP deps · `--offline` by default.

Install guide: [simplebeacon.ai/community](https://simplebeacon.ai/community)

## The problem

AI-assisted edits frequently leave behind:

| What slips in           | Example                                   | What breaks                         |
| ----------------------- | ----------------------------------------- | ----------------------------------- |
| Fake metrics            | `completion_rate: 98.5`, `user_count: 47` | Dashboards and reports show fiction |
| Dummy URLs              | `https://api.example.com/v1`              | Production calls hit placeholders   |
| Mock paths in prod code | `web/data/status-sample.json`             | App loads demo data at runtime      |
| Demo credentials        | `sk-...`, `AKIA...` in source             | Security incidents, failed audits   |

Developers mean to replace these before merge. Simplebeacon catches what code review misses.

## The solution

Simplebeacon scans source and sample data, then gates on:

- **Fiction KPIs** — hardcoded metrics that don't match your baseline
- **Production leaks** — mock/sample paths referenced from production code
- **Credential patterns** — tokens and keys that look real
- **Schema drift** — sample JSON that violates your page specs

```bash
npx --yes simplebeacon init --starter
npx simplebeacon scan --gate --offline
npx simplebeacon gate status
```

Exit code `1` when blocking severities are found — wire it into CI and pre-commit hooks.

## 30-second setup

```bash
npx --yes simplebeacon init --starter
npx simplebeacon-mcp --smoke-test
npx simplebeacon scan --gate --offline
```

**Full guide:** [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md) · **MCP:** [docs/MCP-USER-SETUP.md](docs/MCP-USER-SETUP.md) · **Calibration:** [docs/GATE-CALIBRATION.md](docs/GATE-CALIBRATION.md)

For credentials + production-leak only: `npx simplebeacon init --profile minimal`

## GitHub Actions

Copy [examples/github-action/simplebeacon.yml](examples/github-action/simplebeacon.yml) to `.github/workflows/simplebeacon.yml`:

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: "20"
- run: npx --yes simplebeacon scan --gate --format json --output .simplebeacon/report.json
```

Full workflow with PR summary, artifacts, and gate options: [docs/GITHUB-ACTION-QUICKSTART.md](docs/GITHUB-ACTION-QUICKSTART.md)

**Positioning guide (no copy-paste scripts):** [docs/LAUNCH-TEMPLATE.md](docs/LAUNCH-TEMPLATE.md)

**Anti-bloat manifesto:** [docs/ANTI-BLOAT-MANIFESTO.md](docs/ANTI-BLOAT-MANIFESTO.md) · [Benchmarks](docs/BENCHMARKS.md)

---

## Why Simplebeacon

AI-assisted development produces repos full of:

- Inflated KPIs (`74.17% completion`, `47 features`)
- Hardcoded `-sample.json` paths in production code
- Demo credentials that look real
- Mock data shipped as if it were measured

Simplebeacon scans your codebase and **fails CI** when fiction tries to ship.

## Security & Privacy Guarantees

- **Zero code mutation**: Simplebeacon never modifies your source files (read-only scans; verified in tests)
- **Local-only by default**: No data leaves your machine unless you explicitly pass `--upload`
- **Offline mode**: `simplebeacon scan --offline` fails if any outbound network activity is detected
- **Credential redaction**: Detected secrets are masked in JSON reports before they are written or uploaded
- **Open source**: Fully auditable MIT-licensed code
- **No telemetry**: The community CLI does not phone home or collect usage data

See [docs/TRUST.md](docs/TRUST.md) for architecture, data flow, and verification steps.

## Docker (code never leaves your host)

Build once from the monorepo root:

```bash
docker build -f docker/Dockerfile.cli -t simplebeacon/cli .
```

Scan a repo read-only (Linux/macOS):

```bash
docker run --rm \
  -v "$(pwd):/repo:ro" \
  -v "$(pwd)/.simplebeacon:/out" \
  simplebeacon/cli scan --path /repo --format json --output /out/report.json --gate --offline
```

Windows PowerShell:

```powershell
docker run --rm -v "${PWD}:/repo:ro" -v "${PWD}/.simplebeacon:/out" simplebeacon/cli scan --path /repo --format json --output /out/report.json --gate --offline
```

Mount `:ro` on source; only the output directory is written. Pair with the Findings Explorer at `/findings/` to browse large JSON reports locally.

## Safety Features

- **Atomic writes**: setup and report files use temp-file + rename
- **Automatic backups**: existing config/hook/baseline files are backed up before overwrite
- **Write validation**: JSON and hook outputs are validated after write
- **Rollback**: multi-step setup operations restore backups on failure
- **Dry-run mode**: preview `init` and `hook install` with `--dry-run`

## Install

```bash
npm install -D simplebeacon
# or zero-install
npx simplebeacon init
npx simplebeacon hook install
```

## Quick start

```bash
npx simplebeacon init                  # auto-detects project layout
npx simplebeacon init --dry-run        # preview init without writing files
npx simplebeacon scan                  # scan and report (text)
npx simplebeacon scan --offline        # fail if any network activity occurs
npx simplebeacon scan --gate           # exit 1 on blocking issues
npx simplebeacon scan --format json --output .simplebeacon/report.json
npx simplebeacon hook install          # pre-commit gate
npx simplebeacon baseline sync         # sync Jest counts after green tests
```

### Profiles

```bash
npx simplebeacon init --profile minimal    # credentials + production-leak only
npx simplebeacon init --profile standard   # all rules, generic defaults
npx simplebeacon init --profile cascade    # ai-platform dashboard preset
```

## Commands

| Command                      | Description                                                     |
| ---------------------------- | --------------------------------------------------------------- |
| `simplebeacon init`          | Create `.simplebeacon/config.json` and `baseline.json`          |
| `simplebeacon scan`          | Scan project; `--gate` exits 1 on blocking issues               |
| `simplebeacon baseline sync` | Run Jest and write pass counts to baseline                      |
| `simplebeacon comment`       | Post PR comment from JSON report                                |
| `simplebeacon assess`        | Build customer assessment JSON from scan report                 |
| `simplebeacon report`        | Build client-facing markdown audit (`AUDIT_REPORT.md`)          |
| `simplebeacon compliance`    | Evaluate corporate safety checklist from scan report            |
| `simplebeacon hook install`  | Write pre-commit or pre-push hook (Husky or `.git/hooks`)       |
| `simplebeacon-mcp`           | MCP stdio server for Cursor / Claude Desktop (local scan tools) |

### MCP (IDE integration)

Real-time snippet and file checks during development — **no upload**:

```bash
node bin/simplebeacon-mcp.js --offline
```

Tools: `scan_snippet`, `scan_file`, `scan_project`, `gate_status`, `explain_finding`, `suggest_fixes`, `get_action_plan`, `propose_fix`, `verify_fix`, and 27 more. See [docs/MCP.md](docs/MCP.md) and `examples/mcp/cursor.mcp.json`.

**Progressive discovery:** Set `SIMPLEBEACON_PROGRESSIVE=1` to expose only 3 meta-tools (`search_available_tools`, `inspect_tool_schema`, `list_all_tools`) instead of all 36 upfront — **94.8% token reduction** on initial tool schema.

### Scan flags

| Flag                    | Description                                                  |
| ----------------------- | ------------------------------------------------------------ |
| `--path <dir>`          | Project root (default: cwd)                                  |
| `--config <file>`       | Config path                                                  |
| `--format text\|json\|markdown\|action-plan\|agent` | Output format (`agent` = compressed JSON for LLM agents, ~96% smaller) |
| `--output <file>`       | Write report to file                                         |
| `--gate`                | Fail when severities in `gate.failOn` are found              |
| `--fail-on high,medium` | Override gate severities                                     |
| `--with-jest`           | Run tests and compare to baseline                            |
| `--verbose`             | Show config warnings and scan paths                          |
| `--offline`             | Fail if any outbound network activity occurs during the scan |
| `--no-trust-banner`     | Suppress read-only / local-only confirmation lines           |
| `--dry-run`             | Preview `init` / `hook install` without writing files        |
| `--force`               | Overwrite existing init files (backup created first)         |
| `--profile`             | Force init profile                                           |

## Rules

| Rule                 | Severity    | Detects                                               |
| -------------------- | ----------- | ----------------------------------------------------- |
| `credentials`        | high/medium | AWS keys, JWT, GitHub PATs, OpenAI keys, private keys |
| `json-schema`        | high        | Sample JSON violating page specs                      |
| `sample-consistency` | high        | Cross-file KPI drift vs baseline                      |
| `roadmap`            | medium      | Legacy fiction roadmaps, oversized exports            |
| `production-leak`    | high/medium | Mock/sample paths in production code                  |
| `jest-baseline`      | high        | Jest pass count drift (optional, `--with-jest`)       |

See [docs/RULES.md](docs/RULES.md) and [docs/CONFIG.md](docs/CONFIG.md).

## Measured performance

Real benchmark data (not estimates). All measurements from synthetic test corpus on this repository.

| Metric | Value | How measured |
|--------|-------|-------------|
| Snippet scan latency | **1.43ms** | `scan_snippet` on 10-file corpus |
| Full repo scan | **12.3s** | `simplebeacon scan --gate` on 50-file lib dir |
| MCP schema token reduction | **94.8%** (raw), 66.7% (net with 5 discovery round-trips) | 34-tool schema vs 3-tool progressive |
| Report payload compression | **96.6%** | `--format json` (31KB) vs `--format agent` (1KB) |
| Finding payload compression | **78.3%** | Uncompressed finding (~120 tokens) vs compressed (~30 tokens) |
| Bug catch rate | **100%** (9/9 AI-fiction bugs) | Synthetic corpus with 9 known defects |
| False positive rate | **0%** (0/1 clean sample) | Clean code sample with no injected bugs |
| CI speedup vs GitHub Actions | **73x** | 12.3s local scan vs 3-15 min CI round-trip |

### What the benchmark tested

9 AI-generated defect categories:
1. Hardcoded Stripe key (`sk_live_...`)
2. Hardcoded GitHub PAT (`ghp_...`)
3. Hardcoded OpenAI key (`sk-...`)
4. LLM placeholder comment (`// AI Generated Placeholder`)
5. Conversational AI debris (`// I have implemented...`, `// Generated by Claude`)
6. Hallucinated SDK methods (`db.getOrCreate()`, `db.fetchAllRecords()`)
7. Hardcoded fake metrics (`"99.99% Uptime"`, `"100% Secure"`)
8. Sample JSON import in production (`import from "../../web/data/user-sample.json"`)
9. Markdown code fence leaked into source

All 9 caught. 0 false positives on clean code. See `.simplebeacon/cost-savings-benchmark.json` for raw data.

## Compressed finding format

`scan_snippet` and `scan_file` accept `compressed: true` to return ~30-token findings instead of ~120-token findings:

```json
// Uncompressed (~120 tokens)
{"id":"github-pat-handler.ts-42","severity":"critical","type":"Credential Pattern",
 "description":"...","filePath":"src/handler.ts","line":14,"pattern":"github-pat",
 "recommendedAction":"Immediately remove and rotate this credential...",
 "match":"ghp_1234567890abcdefghijklmnopqrstuvwxyz"}

// Compressed (~30 tokens)
{"c":"github-pat","s":"C","l":14,"a":"REVOKE_AND_ENV"}
```

13 action codes map to full recommended actions (use `explain_finding` to expand):

| Code | Action |
|------|--------|
| `REVOKE_AND_ENV` | Immediately remove and rotate this credential; store via env/secret manager |
| `ROTATE_AND_REMOVE` | Remove token from source control and rotate if exposed |
| `REPLACE_SAMPLE_IMPORT` | Replace hardcoded sample data imports with runtime API output |
| `REPLACE_PLACEHOLDER` | Replace placeholder copy with production-ready values |
| `VERIFY_SDK_EXISTS` | Verify this SDK/API method exists in the actual library |
| `REPLACE_FAKE_METRIC` | Replace hardcoded metrics with dynamic values |
| `REMOVE_AI_DEBRIS` | Remove conversational AI debris and placeholder comments |

Full dictionary: `src/lib/finding-compressor.js`

## Auto-remediation (propose_fix + verify_fix)

Two MCP tools complete the fix loop:

```bash
# 1. Scan and get compressed findings
scan_snippet(content, { compressed: true })
# → { findings: [{c:"github-pat", s:"C", l:14, a:"REVOKE_AND_ENV"}] }

# 2. Get a fix proposal with diff preview
propose_fix({ finding: {c:"github-pat", s:"C", l:14, a:"REVOKE_AND_ENV"}, filePath: "src/handler.ts" })
# → { canAutoFix: true, diffPreview: { originalLine: 'const token = "ghp_..."', fixedLine: 'process.env.token' },
#     manualSteps: ["Rotate the exposed credential...", "Add to .env..."],
#     playbook: { title: "Hardcoded credential patterns", timeRequired: "30-60 min" } }

# 3. Apply the fix manually, then verify
verify_fix({ filePath: "src/handler.ts", previousFindingCount: 1 })
# → { resolved: true, remainingFindings: 0, comparison: { fixedCount: 1, newFindings: 0 } }
```

`propose_fix` does NOT apply fixes — it returns a diff preview and manual steps. The agent or human applies the fix, then `verify_fix` re-scans to confirm resolution.

**Go-to-market:** [docs/OUTREACH.md](docs/OUTREACH.md) · [Assessment report template](docs/examples/assessment-report-template.json) · [EU AI Act assessment template](docs/examples/eu-ai-act-assessment-template.json) · [EU AI Act GitHub Action](examples/github-action/simplebeacon-eu-ai-act.yml) · [Production leak triage](docs/PRODUCTION-LEAK-TRIAGE.md)

## Complementary stack

```text
Snyk / GHAS     → known CVEs
SonarQube       → code smells, coverage
Simplebeacon    → fiction KPIs in sample JSON, mock paths in prod code, credential patterns
```

Run Simplebeacon in the same CI job as your existing security tools — it gates on different artifacts.

## GitHub Actions

Copy [examples/github-action/simplebeacon.yml](examples/github-action/simplebeacon.yml) to `.github/workflows/simplebeacon.yml`, or use the snippet below.

### Standalone repo

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: "20"
- run: npx simplebeacon init --profile minimal
- run: npx simplebeacon scan --gate --format json --output .simplebeacon/report.json
```

### Composite action

```yaml
- uses: ./ai-platform/action
  with:
    path: .
    fail-on: high
    post-comment: true
```

See [docs/GITHUB-ACTION-QUICKSTART.md](docs/GITHUB-ACTION-QUICKSTART.md), [docs/PRE-COMMIT.md](docs/PRE-COMMIT.md), and [docs/CI.md](docs/CI.md).

## Starter template

Copy [examples/starter/.simplebeacon/](examples/starter/.simplebeacon/) into your repo for a minimal working config.

## Documentation

- [Security scan architecture](../../docs/security-scan-architecture.md) (monorepo: CLI + dashboard flow, codemap trace 1)
- [Configuration](docs/CONFIG.md)
- [Trust & privacy](docs/TRUST.md)
- [Pre-commit hooks](docs/PRE-COMMIT.md)
- [CI Integration](docs/CI.md)
- [Rules reference](docs/RULES.md)
- [Marketing claims (verified)](docs/MARKETING.md)
- [Naming & branding research](docs/NAMING.md)

## Publish

```bash
cd packages/simplebeacon-cli
npm test
npm publish --access public
```

## Development

```bash
cd packages/simplebeacon-cli
npm test
node bin/simplebeacon.js scan --path ../.. --gate
```

## License

MIT

## Enterprise Package Verification

This repository includes a pre-built procurement kit ZIP produced by the bundler (`generated/simplebeacon-procurement-kit.zip`). The kit contains customer-facing HTML, the `verify-isolation.json` attestation, and a `checksums.sha256` manifest so auditors can cryptographically verify package integrity.

Quick verification (Linux / macOS):

```bash
# unzip into a temporary folder then verify every file listed in checksums.sha256
unzip generated/simplebeacon-procurement-kit.zip -d kit
sha256sum -c kit/checksums.sha256
```

Quick verification (Windows PowerShell):

```powershell
# unzip then run a small PowerShell verifier against the checksums manifest
Expand-Archive -Path .\generated\simplebeacon-procurement-kit.zip -DestinationPath kit
$expected = Get-Content .\kit\checksums.sha256
foreach ($line in $expected) {
  $parts = -split $line
  $hash = $parts[0].ToLower()
  $file = $parts[1]
  $actual = (Get-FileHash -Algorithm SHA256 -Path (Join-Path $PWD 'kit' $file)).Hash.ToLower()
  if ($actual -ne $hash) { Write-Error "Checksum mismatch: $file"; exit 1 }
}
Write-Host "All checksums match"
```

Optional: if you publish a detached GPG signature for the ZIP (`simplebeacon-procurement-kit.zip.asc`), verify with `gpg --verify simplebeacon-procurement-kit.zip.asc simplebeacon-procurement-kit.zip`.

If you'd like, I can add this snippet to `CONTRIBUTING.md` or post the ZIP as a release asset on PR #77 so auditors can download it directly from GitHub.
