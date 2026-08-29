# SimpleBeacon Team Onboarding Playbook

## 60-Second Pre-Commit Gate Installation

This guide walks a new engineering team through installing SimpleBeacon's local pre-commit gate across all developer workstations. No cloud account required — the scanner runs entirely offline.

---

## Prerequisites

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| Node.js | 18.0.0 | 22.x LTS |
| npm | 9.0.0 | 10.x |
| Git | 2.20+ | 2.40+ |
| Operating System | macOS, Linux, or Windows | Any |

No API keys, no cloud credentials, no external network access needed.

---

## Step 1: Initialize SimpleBeacon in Your Repository (one-time, by tech lead)

Run this once in the project root and commit the generated config:

```bash
npx simplebeacon init --profile standard
```

This creates two files:

- `.simplebeacon/config.json` — scan profile, gate policy, ignore paths
- `.simplebeacon/baseline.json` — fiction KPI and rejected-pattern baseline

**Commit them:**

```bash
git add .simplebeacon/config.json .simplebeacon/baseline.json
git commit -m "chore: add SimpleBeacon gate config"
```

### Available Profiles

| Profile | Use Case |
|---------|----------|
| `minimal` | Small repos, no sample JSON, minimal rules |
| `standard` | General-purpose projects (default) |
| `cascade` | Large monorepos with multiple workspaces |
| `eu-ai-act` | Projects needing EU AI Act Annex III compliance mapping |

For enterprise compliance teams:

```bash
npx simplebeacon init --profile eu-ai-act
```

---

## Step 2: Install the Pre-Commit Hook (per developer workstation)

Each developer runs one command after cloning the repo:

```bash
npx simplebeacon hook install
```

**What this does:**

1. Detects whether your repo uses Husky (`.husky/`) or native git hooks (`.git/hooks/`)
2. Writes a pre-commit hook script that runs `npx simplebeacon scan --gate --fail-on high`
3. Makes the hook executable (chmod on macOS/Linux)

**That's it.** The next `git commit` will trigger a staged-files-only gate scan.

### Verify the installation

```bash
npx simplebeacon hook install --dry-run
```

Output should show the planned hook path and `kind: git` or `kind: husky`.

### Hook options

| Flag | Description | Default |
|------|-------------|---------|
| `--type pre-commit\|pre-push` | Which hook to install | `pre-commit` |
| `--fail-on high` | Gate severity that blocks the commit | `high` |
| `--with-jest` | Include Jest baseline check in the hook | Off |
| `--husky` | Force `.husky/` directory even if not yet created | Auto-detect |
| `--dry-run` | Preview without writing files | Off |

### Pre-push hook (optional, stricter)

For teams that want a second gate before code leaves the workstation:

```bash
npx simplebeacon hook install --type pre-push --with-jest
```

---

## Step 3: Add the GitHub Actions Workflow (one-time, by tech lead)

Create `.github/workflows/simplebeacon.yml` in your repository:

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
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run SimpleBeacon AI Guardrails
        uses: simplebeacon/guardrails@v1
        with:
          license-token: ${{ secrets.SIMPLEBEACON_LICENSE_TOKEN }}
          fail-on: "high"
          full-scan: false
```

**No license token?** The action runs in Community Sandbox mode — fully functional, posts inline PR comments, blocks on high-severity findings. Add a token later to unlock multi-repo dashboard metrics.

### npx alternative (no Marketplace action)

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0

- uses: actions/setup-node@v4
  with:
    node-version: "22"

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
    GITHUB_EVENT_PULL_REQUEST_NUMBER: ${{ github.pull_request.number }}
  run: npx --yes simplebeacon comment --report .simplebeacon/report.json
```

---

## Step 4: Verify the Gate Works

Test with a clean commit:

```bash
git commit --allow-empty -m "test: verify SimpleBeacon hook"
```

You should see:

```
Simplebeacon pre-commit...
[pre-commit-gate] 0 staged file(s) to scan. Skipping gate scan.
Simplebeacon pre-commit passed
```

Test the gate catches issues (inject a fake secret):

```bash
echo 'const API_KEY = "sk_live_abc123";' > test-secret.js
git add test-secret.js
git commit -m "test: should be blocked"
```

Expected: the commit is blocked with a credential finding. Remove the test file:

```bash
git reset HEAD test-secret.js
rm test-secret.js
```

---

## What the Gate Scans For

| Category | Examples | Severity |
|----------|----------|----------|
| **Credential leaks** | Hardcoded API keys, AWS secrets, Stripe keys | High (blocks) |
| **Production leaks** | Mock/sample JSON imported in production routes | High (blocks) |
| **AI fiction KPIs** | Fabricated metrics, placeholder completion rates | High (blocks) |
| **LLM slop** | Markdown fences in source, "TODO: implement" placeholders | Medium |
| **Security patterns** | `REQUIRE_AUTH=false`, wildcard CORS, privileged Docker | Medium |
| **EU AI Act** | Missing human oversight, missing FRIA for high-risk AI | Medium |

---

## Troubleshooting

### "npx: command not found"

Install Node.js 18+ from https://nodejs.org or use `nvm install 22`.

### Hook not triggering on commit

```bash
# Check if the hook file exists
ls -la .git/hooks/pre-commit    # native git
ls -la .husky/pre-commit        # husky

# Reinstall
npx simplebeacon hook install
```

### Gate scan is slow

The pre-commit hook scans **staged files only** (not the full repo). Typical scan time is 3-8 seconds for 1-5 files. If it's slower:

- Check that `.simplebeacon/config.json` has `pathExclusions` for `node_modules`, `dist`, `coverage`
- Use `--fail-on high` (default) — scanning `critical` only is faster but less safe

### Bypassing the hook (emergency only)

```bash
git commit --no-verify -m "hotfix: critical production issue"
```

The GitHub Actions CI gate will still catch issues on the PR. `--no-verify` only skips the local hook.

### False positive suppression

Add a `simplebeacon-ignore` comment on the flagged line:

```javascript
const SAMPLE_KEY = "sk_test_123"; // simplebeacon-ignore credential-pattern — test fixture
```

Or add the file path to `.simplebeacon/config.json` under the `ignore` array.

---

## Team Rollout Checklist

- [ ] Tech lead runs `npx simplebeacon init --profile standard` (or `eu-ai-act`)
- [ ] Commit `.simplebeacon/config.json` and `.simplebeacon/baseline.json`
- [ ] Add `.github/workflows/simplebeacon.yml` to the repo
- [ ] Announce to the team: "Run `npx simplebeacon hook install` after your next pull"
- [ ] Each developer runs `npx simplebeacon hook install`
- [ ] Each developer verifies with an empty test commit
- [ ] Tech lead opens a test PR to verify the GitHub Action posts a comment
- [ ] Optional: Install pre-push hook for stricter enforcement (`npx simplebeacon hook install --type pre-push`)

---

## Zero-Upload Guarantee

SimpleBeacon runs entirely on the developer's workstation. The scanner:

- Reads local files from disk
- Evaluates deterministic regex and AST patterns
- Writes the gate report to `.simplebeacon/report.json` on disk
- Never transmits source code, file paths, or scan results to any external server

The GitHub Actions workflow runs in your own CI runner. The only outbound network call is the optional license token validation (a single POST with just the token — no source code).

For air-gapped environments, use `--offline`:

```bash
npx simplebeacon scan --gate --offline --format json --output .simplebeacon/report.json
```

---

## MCP Server Integration (for AI coding agents)

SimpleBeacon ships with a Model Context Protocol server for agent-native scanning:

```json
{
  "mcpServers": {
    "simplebeacon": {
      "command": "npx",
      "args": ["simplebeacon-mcp", "--offline"]
    }
  }
}
```

This allows AI coding agents (Devin, Claude Code, Cursor) to call `scan_snippet` and `scan_file` tools before applying edits — catching AI-generated slop before it reaches the codebase.

---

## Support

- **Documentation**: https://simplebeacon.ai/dashboard/#/help
- **Issues**: https://github.com/tjp420/simplebeacon/issues
- **Dashboard**: https://simplebeacon.ai/dashboard
- **Pricing**: https://simplebeacon.ai/pricing
