# Simplebeacon Development Notes

## Pre-Commit Hook Configuration

The project has automated pre-commit hooks configured to ensure code quality before commits:

### Root Pre-Commit Hooks
- **Unix/Linux/Mac**: `.husky/pre-commit` - lint-assets + gitleaks + gate scan (30s timeout, soft-fail)
- **Windows**: `.husky/pre-commit.cmd` - lint-assets + gitleaks + syntax checks + gate scan
- **CI backstop**: `.github/workflows/pr-hygiene.yml` - mirrors all 5 stages on PRs (catches `--no-verify` bypasses)

### Local Pre-Commit Chain (4 stages, ~10s total)

```
[lint-assets.cjs]  -->  [env-production-guard.cjs]  -->  [gitleaks]  -->  [sb:hook:pre-commit (30s timeout)]
   (<0.5s)               (<0.3s)                         (~0.2s)           (secrets-gate + pre-commit-gate)
  Fail-closed          Fail-closed                     Soft-warn          30s timeout, soft-fail
```

### Production Environment Guard (fast pre-commit safety check)
- **Script**: `.simplebeacon/qa/env-production-guard.cjs`
- **Runs**: Second in the pre-commit chain (sub-second), via `sb:hook:pre-commit` npm script
- **Checks**:
  1. **Staged `.env.production` / `.env.prod` files** — blocks commits that stage production env files (even via `git add -f`)
  2. **Production connection strings** — blocks staged JS/CJS/JSON/sh files with non-local DATABASE_URL, REDIS_URL, live Stripe keys (sk_live_*), live Resend keys (re_*), NODE_ENV=production, or DASHBOARD_VAULT_PASSWORD
  3. **Local `.env.production` warning** — warns when a `.env.production` file exists on disk but is not staged
- **Scope**: Staged files only (`git diff --cached`)
- **Behavior**: Strict fail-closed — blocks commit on any BLOCK violation, warns on local file existence
- **Security**: Never logs secret values — only shows filenames and line numbers

### Asset Hygiene Lint (fast pre-commit guard)
- **Script**: `.simplebeacon/qa/lint-assets.cjs`
- **Runs**: First in the pre-commit chain (sub-second)
- **Checks**:
  1. **Mojibake detection** — scans staged JS/TS raw bytes for double-encoded UTF-8 patterns (em-dash, right-quote corruption)
  2. **Relative path integrity** — verifies `scan-worker.js` uses correct `./scan-wasm-bridge.js` and `../utils-lib/` paths, blocks `../../js-es2018/` regressions
- **Scope**: Staged files only (`git diff --cached`)
- **Behavior**: Strict fail-closed — blocks commit on any violation, no auto-repair

### Gitleaks Secret Scanner (industry-standard patterns)
- **Script**: `.simplebeacon/qa/pre-commit-gitleaks.cjs`
- **Runs**: After lint-assets, before the gate scan
- **Approach**: Runs `gitleaks protect --staged --verbose` against staged files only
- **Fallback**: If gitleaks binary is missing, prints a soft warning and exits 0
- **Install**: `npm run install-gitleaks` (downloads binary to `~/.local/bin`, cross-platform)
- **Cross-platform**: Detects gitleaks via PATH + OS-specific fallbacks (Scoop/Chocolatey on Windows, Homebrew on macOS, /usr/local/bin on Linux)
- **Timeout**: 30s hard cap

### Staged-Files-Only Gate Scan (pre-commit performance fix)
- **Script**: `.simplebeacon/qa/pre-commit-gate.cjs`
- **Runs**: Via `npm run sb:hook:pre-commit` (secrets-gate + pre-commit-gate)
- **Problem solved**: The default gate scan walks the entire repo (600k+ files, 600s+ timeout)
- **Approach**: Copies staged files to a temp directory, scans only those with `simplebeacon scan --gate`
- **Performance**: ~5s for typical commits (was 600s+)
- **Local timeout**: 30s via `scripts/run-with-timeout.js` (soft-fail, does not block commit)
- **Config**: `package.json` `sb:hook:pre-commit` calls `npm run sb:hook:secrets-gate && node .simplebeacon/qa/pre-commit-gate.cjs`

### CI/CD Backstop (GitHub Actions)
- **Workflow**: `.github/workflows/pr-hygiene.yml`
- **Triggers**: PRs to main/develop, pushes to main/develop
- **Jobs**: Two parallel jobs for speed:
  1. **Static Hygiene**: lint-assets + pre-commit-gate (stages PR diff files)
  2. **Security Scan**: gitleaks-action (strict fail-closed) + Track113 secret scanner
- **Catches**: `git commit --no-verify` bypasses that skip local hooks
- **Track113**: Runs in CI only (removed from local hook to keep local chain fast)

### ai-platform Pre-Commit Hook
- **Location**: `ai-platform/.husky/pre-commit`
- **Current**: Runs `npm test`
- **Enhancement Needed**: Should also include SimpleBeacon gate scan for consistency

### coming-soon Pre-Commit Hook
- **Location**: `coming-soon/pre-commit-hook.sh`
- **Current**: Comprehensive with syntax checks + SimpleBeacon gate scan
- **Status**: Well-configured, can be installed to `.git/hooks/pre-commit`

### Installation Commands
```bash
# Install root hooks (if husky is set up)
npx husky install

# Manual installation for coming-soon
cp coming-soon/pre-commit-hook.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

### Hook Enhancement Recommendations
1. ✅ **ai-platform**: Added SimpleBeacon gate scan to existing test run
2. ✅ **Standardize**: All hooks now run syntax checks and quality gates (root `.husky/pre-commit`, `.husky/pre-commit.cmd`, `ai-platform/.husky/pre-commit`, `coming-soon/pre-commit-hook.sh`)
3. ✅ **CI Integration**: GitHub Actions run `npm audit` on every PR (builds fail on high/critical); SimpleBeacon gate scan runs in CI via `npx simplebeacon scan --gate --format json`

---

## Pricing & Billing Infrastructure

### Three-Tier Pricing Model (2026-08-06)
- **Developer**: $49/mo or $490/yr (Save 17%) — unlimited scans, CI gate, 38 analyzers
- **Team Pro**: $149/mo or $1,490/yr (Save 17%) — EU AI Act, SOC 2, board-ready certs, 5 seats
- **Enterprise**: Custom — air-gapped, SSO/SAML, dedicated analyst, Book Demo link
- **Legacy Pro**: $9/mo — backward compatible, still functional for existing customers

### Files
- **Frontend**: `coming-soon/public/pricing.html` (primary), `coming-soon/pricing.html` (mirror)
- **Backend**: `coming-soon/routes/subscriptions-billing.cjs` — Stripe checkout session creation + webhook handler
- **Integration test**: `scripts/test-payment-sim.cjs` — stubs Stripe API, verifies tier-to-price mapping

### Price Constants (cents, Stripe zero-decimal format)
| Tier | Monthly | Annual |
|------|---------|--------|
| Developer | 4900 ($49) | 49000 ($490) |
| Team Pro | 14900 ($149) | 149000 ($1,490) |
| Legacy Pro | 900 ($9) | 9000 ($90) |
| Compliance | 39900 ($399) | 399000 ($3,990) |
| Enterprise | 49900 ($499) | 499000 ($4,990) |

### Billing Bug Fixed (2026-08-06)
- **Bug**: Frontend `subscriptionTiers` array used old names (`startup_shield`, `compliance_suite`), causing new Developer/Team Pro subscriptions to fall through to the free `/api/test-checkout` endpoint. Server `tierConfig` only had `pro`/`compliance`/`team`/`enterprise`, so the fallback billed $9 instead of $49.
- **Fix**: Updated `subscriptionTiers` to `['developer_tier', 'team_pro_tier']` in both HTML files. Added `developer` and `team_pro` entries to server `tierConfig` with correct price constants. Updated webhook tier detection to recognize new price points.
- **Verification**: `node scripts/test-payment-sim.cjs` — 5/5 tests pass (Developer monthly/annual, Team Pro monthly/annual, Legacy Pro backward compat).

### Running the Payment Simulation
```bash
node scripts/test-payment-sim.cjs
```
Stubs `stripe.checkout.sessions.create` — no real API calls. Uses `X-Forwarded-For` headers to bypass the rate limiter. Verifies `unit_amount`, `recurring.interval`, and `product_data.name` for each tier.

### Webhook Idempotency Implementations

The project has two Stripe webhook handlers that use different idempotency strategies, each appropriate for their deployment context:

| Handler | File | Storage | Context |
|---------|------|---------|---------|
| ai-platform | `ai-platform/server/routes/stripe-webhook-routes.cjs` | File-based (`stripe-event-store.cjs`) | Single-instance Render server — file store is sufficient |
| coming-soon | `coming-soon/routes/subscriptions-billing.cjs` | Database (`db.recordWebhookEvent()`) | Cloudflare Pages deployment — DB store survives serverless cold starts |

Both implementations:
- Check for duplicate event IDs before processing
- Return `200 { received: true, duplicate: true }` for replayed events
- Log the duplicate event for audit trails

**Key difference**: The file-based store is simpler but limited to single-instance deployments. The DB-based store is required for serverless/multi-instance deployments where filesystem state is ephemeral.

### Dev Auth Bypass

The `resolveAuth` function in `ai-platform/server/middleware/auth.cjs` requires **two** conditions to activate the dev auth bypass:
1. `NODE_ENV=development`
2. `DEV_AUTH_BYPASS=1`

This prevents accidental auth bypass if `NODE_ENV` is misconfigured in production. Set both in your local `.env` file for dev admin access.

### Redis-Backed Rate Limiting

The main API rate limiter (`createRateLimiter` in `ai-platform/server/middleware/security.cjs`) supports Redis-backed distributed rate limiting for multi-instance deployments.

**How it works:**
- When `REDIS_URL` is set, `createRateLimiter` uses a `RedisStore` adapter (`ai-platform/server/lib/redis-rate-limit-store.cjs`) that implements the `express-rate-limit` v8 `Store` interface.
- Rate limit state is shared across all processes connecting to the same Redis instance.
- When Redis is unavailable (connection fails, `ioredis` not installed, or `ENABLE_REDIS_RATE_LIMIT=false`), falls back to the default in-memory store.
- During a Redis outage mid-request, `increment()` fails open (returns `counter=0`) to avoid blocking all API traffic.

**Env vars:**
- `REDIS_URL` / `REDIS` — Redis connection URL (enables Redis rate limiting when set)
- `ENABLE_REDIS_RATE_LIMIT` — Set to `false` to disable Redis rate limiting without affecting other Redis features (cache, snapshot, etc.)
- `REDIS_RATE_LIMIT_PREFIX` — Key prefix for rate limit keys (default: `ratelimit:`)

**Files:**
- `ai-platform/server/lib/redis-rate-limit-store.cjs` — `RedisStore` adapter + `getRedisStore()` singleton
- `ai-platform/server/middleware/security.cjs` — `createRateLimiter()` wires in the Redis store
- `ai-platform/server/lib/__tests__/redis-rate-limit-store.test.cjs` — 21 unit tests

**CI:** The `redis-integration` job in `security-gate.yml` runs the store tests against a real Redis service container.

---

## Monthly Quality Gate Review Schedule

### Review Cadence
- **Frequency**: Monthly (first business day of each month)
- **Owner**: Engineering Team Lead
- **Duration**: 1-2 hours
- **Participants**: Tech Lead, Senior Developers, QA Engineer

### Review Agenda

#### 1. Gate Status Review (15 min)
- Review previous month's gate pass/fail rates
- Analyze trends in blocking issues
- Identify recurring patterns or false positives

#### 2. Dependency Health Check (20 min)
- Run `npm audit` across all packages
- Review DEPENDENCY-POLICY.md compliance
- Plan dependency updates for the month
- Address any security vulnerabilities

#### 3. Test Coverage Analysis (20 min)
- Review test coverage reports
- Identify modules with low coverage
- Plan test additions for uncovered modules
- Review test flakiness and reliability

#### 4. Documentation Updates (15 min)
- Update AGENTS.md with any new learnings
- Review and update technical documentation
- Ensure all TODOs are addressed or documented

#### 5. Action Items (10 min)
- Assign owners to identified issues
- Set deadlines for remediation
- Schedule follow-up reviews if needed

### Monthly Review Checklist

- [ ] Run full SimpleBeacon gate scan: `npx simplebeacon scan --gate --full`
- [ ] Run dependency audit: `npm audit` in each package directory
- [ ] Generate test coverage report: `npm run test:coverage`
- [ ] Review pre-commit hook effectiveness
- [ ] Check for new security vulnerabilities
- [ ] Update DEPENDENCY-POLICY.md review log
- [ ] Document any new patterns or learnings in AGENTS.md
- [ ] Verify CI/CD pipeline quality gates
- [ ] Review and address any technical debt items
- [ ] Plan next month's quality improvements

### Automated Monthly Report

Generate automated monthly quality report using:

```bash
# From project root
npm run quality:check
```

This runs:
- SimpleBeacon gate scan
- Dependency audit
- Test coverage analysis
- Security vulnerability check
- Documentation validation

### Review Templates

#### Monthly Quality Review Report Template

```markdown
# Monthly Quality Review - [Month Year]

## Executive Summary
- Gate Pass Rate: X%
- Critical Issues: X
- High Severity Issues: X
- Test Coverage: X%

## Dependency Health
- Vulnerabilities Found: X
- Packages Updated: X
- Deprecated Packages: X

## Test Coverage
- Overall Coverage: X%
- Modules Below Threshold: X
- New Tests Added: X

## Action Items
1. [ ] Issue description - Owner - Due date
2. [ ] Issue description - Owner - Due date

## Next Month Focus
- Priority areas for improvement
- Planned tooling upgrades
- Team training needs
```

### Quality Metrics Tracking

Track these metrics month-over-month:

| Metric | Month 1 | Month 2 | Month 3 | Trend |
|--------|---------|---------|---------|-------|
| Gate Pass Rate | % | % | % | ↗/↘ |
| Critical Issues | # | # | # | ↗/↘ |
| Test Coverage | % | % | % | ↗/↘ |
| Vulnerabilities | # | # | # | ↗/↘ |
| False Positive Rate | % | % | % | ↗/↘ |

### Escalation Procedures

If critical issues are found during monthly review:

1. **Immediate**: Block deployments until resolved
2. **24 hours**: Engineering lead assessment
3. **48 hours**: Remediation plan developed
4. **1 week**: Resolution implemented and verified

---

## QA Framework (Builder / Validator)

Cursor rule: **`.cursor/rules/qa-framework.mdc`** (`alwaysApply: true`).

| Phase | Role | Artifact |
|-------|------|----------|
| 1 Spec | Builder | `.simplebeacon/qa/test_plan.md` (from `templates/qa/test_plan.template.md`) |
| 2 Build | Builder | Code — only after plan approval |
| 3 Validate | Validator (separate chat) | Run Level 1 gates/tests; adversarial review |
| 4 Report | Validator | `.simplebeacon/qa/software_health_report.md` |

**Level 1 commands:** `node -c`, `npm test` (ai-platform), `npm run compile` (extension), `npx simplebeacon scan --full --gate`.

Switch roles explicitly: *"Act as Validator only"* — Validator must not write feature code.

---

## AI Agent Rules — The Broom Strategy (Quick Reference)

> Read this first. It takes 10 seconds and prevents 90% of AI hallucinations.

### Core Directives

1. **No Castles**: Do not invent new modules, workflows, or infrastructure. Fix code inline within existing files whenever possible.
2. **No Ghosts**: Do not reference or edit template files (e.g., `config.js`, `data.js`, `ai.js`). Work exclusively with the validated CommonJS (`.cjs`) backend and Vanilla JS frontend.
3. **No Hallucinated Flaws**: "AI-hallucinated paths" is an invalid technical concept. Do not flag math operations (`Math.random()`, `Math.pow()`) or standard test data directories as security risks.

### Strict Verification Checklist

- [ ] Every modified file must pass `node -c path/to/file.js` locally.
- [ ] Target actual API paths (like `/api/simplebeacon/scan/progress`), never generic guesses.
- [ ] Read raw terminal logs first before making code adjustments on a failing test suite.
- [ ] Relevant tests pass (`node --test`).
- [ ] No ghost files are referenced in the summary.
- [ ] The fix is in the smallest number of files possible.
- [ ] You can explain every changed line without hand-waving.

---

## Full-Coverage Scanning

By default, the Simplebeacon gate scan walks only `productionPaths` and `scanPaths` (e.g., `server/`, `src/`, `web/data`). This leaves many files as "metadata-only" — they are counted in inventory but not content-scanned by rule engines.

### Achieving 100% File Coverage

Use the `--full` CLI flag to enable `fullDirectoryScan`:

```bash
npx simplebeacon scan --full --gate --format json
```

This walks the entire repository tree (excluding `node_modules`, `.git`, `github-cache/`) and content-scans every text file. Binary files (images, executables, etc.) are still hashed for inventory but skipped from text-rule scanning — this is expected and correct.

### Before vs After

| Metric | Default Scan | `--full` Scan |
|--------|-------------|---------------|
| Total files | 576 | 692 |
| Content-scanned | 294 (51%) | 685 (99.1%) |
| Metadata-only skipped | 282 (49%) | 0 |
| Binary files | unknown | 4 |

### Enabling All Rule Engines

Some rule engines are opt-in and disabled by default:
- `token-bleed-patterns`
- `architecture-drift-patterns`
- `python-ast-patterns`
- `javascript-ast-patterns`

To run all engines on all files, use the full-coverage config:

```bash
npx simplebeacon scan --config .simplebeacon/config-full-coverage.json --full --gate
```

Or set `fullDirectoryScan: true` and enable the desired rules in your `.simplebeacon/config.json`.

### Key Config Fields

- `fullDirectoryScan: true` — walk entire tree instead of selective paths
- `fullDirectoryScanMaxFiles: 100000` — raise limit if you have large repos
- `scanPaths: ["."]` — scan everything (when not using fullDirectoryScan)
- `productionPaths` — rule engines filter to these paths unless configured otherwise

### Bugs Fixed

- `eu-ai-act-patterns.js` was missing `isExcludedPath` and `buildEuAiActSummaryFromScan` exports, causing `fullDirectoryScan: true` to crash. Added both exports.
- Added `simplebeacon-rule-tests`, `simplebeacon-frameworkless`, and `marketing-content-test` exclusions to all scanner rules (`eu-ai-act-patterns.js`, `ai-runtime-scan-common.js`, `enterprise-guardrail-patterns.js`, `benchmark-cache-paths.js`, `full-directory-scanner.js`, and `config-full-coverage.json`).
- Fixed missing `async` keyword on `walkSourceFiles` in `eu-ai-act-patterns.js` (caused `await is only valid in async functions` syntax error).
- Fixed duplicate `const normalized` declaration in `fiction-kpi-patterns.js` (caused `Identifier 'normalized' has already been declared` syntax error).
- Added `allowedAnalysisRoots` to `.simplebeacon/config.json` to support scans outside the default `CascadeProjects` root (e.g., `CascadeProjects_BACKUP_20260521`).

## AI Agent Control

Simplebeacon exposes multiple interfaces for AI assistants to trigger scans, read results, and apply fixes.

### 1. MCP Server (Model Context Protocol)

Simplebeacon includes a built-in MCP stdio server compatible with Cursor, AI assistant clients, and Windsurf.

**Tools exposed:**

| Tool | Purpose |
|------|---------|
| `scan_snippet` | Scan pasted code for leaks, credentials, fiction KPIs |
| `scan_file` | Scan a single file on disk |
| `scan_project` | Run a full project scan with gate evaluation |
| `gate_status` | Read latest gate pass/fail from `.simplebeacon/report.json` |
| `suggest_fixes` | Get prioritized remediation steps from scan results |
| `explain_finding` | Look up deterministic rule metadata for any pattern ID |

**Start the MCP server:**

```bash
node packages/simplebeacon-cli/src/mcp/stdio-server.js
# Or via the bin entry:
npx simplebeacon-mcp --offline
```

**Programmatic MCP setup:**

```javascript
const { createMcpStdioServer } = require('simplebeacon/src/mcp/stdio-server');
const server = createMcpStdioServer({ offline: true });
server.start();
```

### 2. AI Agent Controller (Programmatic API)

For deeper integration, use the `AiAgentController` class:

```javascript
const { AiAgentController } = require('simplebeacon/src/lib/ai-agent-controller');

const controller = new AiAgentController('/path/to/project', { offline: true });

// Run a full scan
const report = await controller.scan({ fullDirectoryScan: true, gate: true });

// Get structured summary
const summary = controller.getSummary();
console.log(summary.gatePass, summary.qualityScore, summary.topIssues);

// Check if project is ready for handoff
const readiness = controller.checkHandoffReadiness();

// Get prioritized fix suggestions
const fixes = controller.suggestFixes();

// Export report
controller.exportReport('/path/to/export.json');

// Generate marketing content from scan results
const blog = controller.generateMarketing('blog');
```

**Available methods:**

| Method | Description |
|--------|-------------|
| `scan(options)` | Run full scan, returns normalized report |
| `getGateStatus()` | Read gate pass/fail, blocking counts |
| `getSummary()` | Structured summary for AI consumption |
| `suggestFixes()` | Prioritized list of remediation actions |
| `checkHandoffReadiness()` | Is the project ready for delivery? |
| `generateMarketing(channel)` | Create blog/twitter/linkedin content |
| `exportReport(path)` | Write report to JSON file |
| `watchAndScan(options)` | Watch files and auto-scan on change |

### 3. Server REST API

The dashboard server exposes endpoints for remote AI control:

```bash
# Run flexible analysis
curl -X POST http://localhost:54355/api/analyze/flexible \
  -H "Content-Type: application/json" \
  -d '{"projectPath": "/path/to/repo", "analysisType": "codebase"}'

# Get compliance checklist
curl -X POST http://localhost:54355/api/analyze/compliance-checklist \
  -H "Content-Type: application/json" \
  -d '{"projectPath": "/path/to/repo"}'

# Get simplebeacon report
curl "http://localhost:54355/api/simplebeacon/report?projectPath=/path/to/repo"
```

### 4. Direct Programmatic API

For the lowest-level control, import from `scan.js` directly:

```javascript
const { runScan, scanMockDataDirectories } = require('simplebeacon/src/scan');

const report = await runScan('/path/to/project', {
    offline: true,
    gate: true,
    fullDirectoryScan: true
});
```

### 5. CLI (Shell Invocation)

AI agents can invoke Simplebeacon via shell:

```bash
# Standard gate scan
npx simplebeacon scan --gate --format json --output .simplebeacon/report.json

# Full coverage scan
npx simplebeacon scan --full --gate --format json

# EU AI Act assessment
npx simplebeacon scan --config .simplebeacon/config-full-coverage.json --full

# Generate marketing content
node bin/generate-marketing-content.js --report .simplebeacon/report.json --all
```

### Integration Pattern for AI Agents

Recommended workflow for an AI assistant controlling Simplebeacon:

```javascript
const { AiAgentController } = require('simplebeacon/src/lib/ai-agent-controller');

async function aiSimplebeaconWorkflow(projectRoot) {
    const ctrl = new AiAgentController(projectRoot, { offline: true });
    
    // 1. Scan
    const report = await ctrl.scan({ gate: true });
    
    // 2. Assess
    const summary = ctrl.getSummary();
    if (!summary.gatePass) {
        const fixes = ctrl.suggestFixes();
        console.log(`${fixes.total} fixes needed:`, fixes.all.slice(0, 5));
        return { status: 'needs-fixes', fixes };
    }
    
    // 3. Handoff check
    const readiness = ctrl.checkHandoffReadiness();
    if (readiness.ready) {
        ctrl.exportReport('.simplebeacon/handoff-report.json');
        return { status: 'ready-for-handoff', report };
    }
    
    return { status: 'unknown', summary };
}
```

---

## AI Agent Rules — The Broom Strategy

These rules exist to keep the AI focused on practical, grounded engineering instead of generating over-engineered architectures. Follow them strictly.

### 1. Start with the Code, Not the Architecture
**Wrong:** *"Let's design a microservices event bus with Kafka..."*
**Right:** *"Show me the exact file that handles the webhook already."*

**Action:** Use `grep` to find existing patterns, read actual files, then extend what's there. Never build a new system before understanding the current one.

### 2. The "One-File Rule"
Before creating any new file, ask: *"Can I add this to an existing file instead?"*

**Examples from this codebase:**
- Needed a scan lock? Added `let isScanRunning` to existing `simplebeacon-api.cjs` — no new module.
- Needed dashboard polling? Added methods to existing `main.js` — no new component.
- Needed dynamic project path? Added one line to existing webhook handler — no new service.

**Result:** 5 files touched, 0 new modules created, 0 dependencies added.

### 3. Verify Before You Believe
Every change gets a syntax check immediately:
```bash
node -c path/to/file.js
```

Every assumption gets tested against reality:
- AI claims a file exists? `ls` or `Test-Path` to confirm.
- AI claims an API endpoint works? Read the route handler.
- AI claims a test passes? Run `node --test` and see.

### 4. The "Ghost File" Trap
The AI will reference files that do not exist, especially from:
- `.simplebeacon/config.json` at the repo root (gitignored — may or may not exist)
- `src/main.js` (generic template — check if it actually exists)
- `test-login.json` (likely never existed)
- Any file with a generic name that sounds plausible

**Defense:** Before editing, confirm the file path exists. If the AI quotes code from a file you haven't read, read it yourself.

### 5. When the AI Hallucinates, Call It Out
If the AI:
- Invents a vulnerability in a non-existent file
- Proposes a 12-step enterprise architecture for a 2-line fix
- Recommends adding Redis/Kafka/queues for a file-based system
- Starts generating boilerplate "modules" you didn't ask for

**Stop.** Ask: *"What file currently handles this? Show me the actual code."*

### 6. The Checklist for "Done"
Before ending a session:
- [ ] All modified files pass `node -c` syntax check
- [ ] Relevant tests pass (`node --test`)
- [ ] No ghost files are referenced in the summary
- [ ] The fix is in the smallest number of files possible
- [ ] You can explain every changed line without hand-waving

### 7. Castle vs. Broom Comparison

| Task | Castle (Wrong) | Broom (Right) |
|------|---------------|---------------|
| Stripe webhook → scan | Build message queue + worker + Docker | Fire-and-forget `child_process.exec` in existing handler |
| Concurrent scan safety | Redis distributed locks | Module-level `let isScanRunning = false` |
| Dashboard sees new results | WebSockets, server-sent events | `setInterval` polling for 2 min max |
| Test fixture false positives | Rewrite rule engine | Add exclusion paths to existing config |
| Export a report module | New npm package with 3 files | Use existing exports, import from real code |

### Bottom Line

The best fix is the one that uses the existing patterns, the existing imports, and the existing test infrastructure. The codebase already has the answers. The AI's job is to help find them, not to build a parallel universe.

---

## Canonical File Locations

### Package Directories

| Package | Canonical Path | Notes |
|---------|---------------|-------|
| simplebeacon-cli | `packages/simplebeacon-cli/` | Root-level canonical package |
| simplebeacon-intelligence | `ai-platform/packages/simplebeacon-intelligence/` | Optional tree-sitter grammar package |
| ai-platform | `ai-platform/` | Main platform workspace |
| ai-agent | `ai-agent/` | 0-dependency local agent |
| ai-tools | `ai-tools/` | 0-dependency syntax/test wrapper |
| coming-soon | `coming-soon/` | Landing page with backend |
| vscode-extension | `vscode-extension/` | VS Code extension |

### Generated Artifacts

| Artifact Type | Canonical Location | Archive Location |
|---------------|-------------------|------------------|
| SimpleBeacon reports | `.simplebeacon/report.json` | `.simplebeacon/archive/` |
| Scan outputs | `.simplebeacon/scan-*.json` | `.simplebeacon/archive/` |
| Gate test reports | `.simplebeacon/gate-test-report.json` | `.simplebeacon/archive/` |
| Backup files | N/A — do not commit | `.simplebeacon/archive/` |
| Phase export files | Root `phase-*.json` (temporary) | `.simplebeacon/archive/` after completion |

### Deprecated / Removed Locations

| Old Location | Reason | Action Taken |
|-------------|--------|--------------|
| `ai-platform/.github-sync/simplebeacon/` | Sync artifact, duplicate of `packages/simplebeacon-cli/` | Removed 2026-06-10 |
| `ai-platform/github-cache/tjp420-simplebeacon/` | Cache artifact | Previously removed |
| Root `*-report.json`, `scan_*.json` | Generated artifacts cluttering root | Archived to `.simplebeacon/archive/` 2026-06-10 |

---

## Naming Conventions

### Files

| Type | Convention | Examples |
|------|-----------|----------|
| Source files (JS/CJS) | kebab-case | `scan-engine.js`, `path-sanitizer.cjs` |
| Test files | kebab-case with `.test.` suffix | `scan-engine.test.js` |
| Config files | kebab-case | `config.json`, `config-full-coverage.json` |
| Documentation | UPPER-KEBAB-CASE for top-level | `DEPENDENCY-POLICY.md`, `AGENTS.md` |
| Scripts (shell/batch) | kebab-case | `scan-website.sh`, `start-all-servers.bat` |
| Generated reports | kebab-case with type prefix | `report.json`, `gate-test-report.json`, `scan-clean.json` |
| Phase export files | `phase-{phase}-{project}-{date}.json` | `phase-npmaudit-ai_agent-2026-06-10.json` |

### Directories

| Type | Convention | Examples |
|------|-----------|----------|
| Packages | kebab-case | `simplebeacon-cli`, `coming-soon` |
| Source | kebab-case or plural | `src/`, `tests/`, `docs/` |
| Config | dot-prefixed | `.simplebeacon/`, `.husky/` |

### Inconsistencies to Avoid

- Do not mix `_` and `-` in the same project path
- Do not create root-level generated artifacts; use `.simplebeacon/`
- Do not duplicate package code in `.github-sync/` or `github-cache/` directories

---

## ai-platform Session Fixes — 2026-06-12

### Issues Fixed

1. **Dead service worker reference**
   - `web/simplebeacon-dashboard/index.html` contained a `navigator.serviceWorker.register('/simplebeacon-dashboard/sw.js')` block, but `sw.js` never existed on disk.
   - **Fix:** Removed the entire service worker registration script block.

2. **`.simplebeaconignore` duplicate entry**
   - `web/simplebeacon-dashboard/sw.js` was listed twice (lines 104–105).
   - **Fix:** Deduplicated and updated the comment to note the file was removed.

3. **Folder drop not updating path input**
   - Dropping a folder on the path area set `lastProjectPath` but `runPathAnalysis()` triggered a full `refresh()` re-render.
   - `pageRepoScan.js::getPathInputDisplayValue()` **always returned `''`**, so the re-render blanked the input.
   - Chip clicks worked because they never triggered `refresh()` / `runPathAnalysis()`.
   - **Fix:** Changed `getPathInputDisplayValue` to return `app.state.pathInputDraft || app.state.lastProjectPath || ''` so re-renders preserve the current path.

4. **Clear button did not clear recent chips**
   - The `#clear-path-btn` handler only blanked the input and `lastProjectPath` — it did not touch `localStorage` (`simplebeaconRecentPaths`) or re-render the chips section.
   - **Fix:** Added `localStorage.removeItem('simplebeaconRecentPaths')` and re-rendered `renderPathSourceSections()` so chips disappear immediately.

### Post-Fix Gate Status

```json
{
  "gate": { "pass": true, "blockingCount": 0 },
  "qualityScore": 100,
  "repositoryFilesTotal": 475,
  "ruleScopedFilesAnalyzed": 557,
  "profile": "eu-ai-act"
}
```

### Exported Metadata

Re-attestation workflow metadata saved to:
`ai-platform/.simplebeacon/re-attestation-export-2026-06-12.json`

---

## Cluster Keyring Sync — Actual Architecture (verified 2026-07-31)

Source of truth: `ai-platform/server/lib/cluster-keyring-sync.cjs` + `__tests__/cluster-keyring-sync.test.cjs` (29 tests). This section exists to prevent future agents from building on a description that was previously circulated but did **not** match the code. Two claims in particular were false and must not be reintroduced:

### FALSE claim 1 — "mutual TLS (mTLS)"
The transport is **opportunistic TLS, not mTLS**. Both server (`_startServer`) and client (`_connectToPeer`) use `requestCert:false` / `rejectUnauthorized:false`; no client cert is requested or verified and the server cert is not verified either. When `CLUSTER_CERT`/`CLUSTER_KEY` are unset the transport falls back to **plaintext TCP** (a startup warning is logged). `KEY_COMMIT` frames carry **raw key hex** (`activeHex`/`previousHex`) over this channel.

**Threat model (decided 2026-07-31):** trusted private network only. The cluster port (`CLUSTER_KEYRING_PORT`, default 7000) MUST be reachable only on a trusted/isolated network. Enabling real mTLS (`requestCert:true` + CA chain + non-raw key distribution) is a separate feature and must be designed as a whole — do not flip the flags piecemeal.

### FALSE claim 2 — "Two-Phase Propagation: staging → quorum ACK → commit"
Rotation is **single-phase**. `proposeRotate()`:
1. Commits locally via `keyRotationStore.rotateKey()`.
2. Advances the idempotency watermark `_lastAppliedRotatedAt`.
3. Broadcasts `KEY_COMMIT` once to all peers.
4. Records a single `key_commit` event.

Followers apply via `_applyRemoteKeyCommit()` and reply `KEY_COMMIT_ACK`, but the leader **does not collect ACKs and does not gate on a quorum**. There is no staging phase, no rollback, no second commit command. A true two-phase staging flow with quorum-ACK gate is a **follow-up feature**, not the current implementation — file it explicitly rather than silently editing docs to claim it exists.

### What IS implemented
- **Raft-like leader election with majority quorum** (`_electLeader`): `majority = floor(total/2)+1`; lost quorum → stepdown + `split_brain_detected` event. Lowest sorted reachable node ID wins.
- **TCP/TLS gossip**: framed JSON messages (4-byte length header, 1 MB cap), `ANNOUNCE`/`ANNOUNCE_ACK`/`HEARTBEAT`/`KEY_COMMIT`/`KEY_COMMIT_ACK`/`PING`/`PONG`.
- **Idempotency + ordering guard** (`_applyRemoteKeyCommit`, added 2026-07-31): a `KEY_COMMIT` with `rotatedAt <= _lastAppliedRotatedAt` is rejected as `duplicate_commit` (equal) or `stale_commit` (older) and a `key_reject` event is recorded; the keyring is not regressed. Missing/invalid `rotatedAt` → `missing_or_invalid_rotatedAt`. The watermark resets with `_resetEvents()` and advances on the leader path in `proposeRotate()`.
- **Sync.com-style event timeline**: `eventId` (`evt-<hex>-<hex>`), ISO timestamp, `eventType`, `node`, `details`; filterable by type/node/date range; paginated; `getEventStats()` aggregates by type and node. `KEY_REJECT` is a recorded event type. Events never contain raw key material (S-01/S-04 enforced + tested).
- **Admin-only routes** in `audit-routes.cjs`: `GET /api/audit/cluster/keyring` (status), `POST /api/audit/cluster/keyring/rotate` (leader-only, 423 `not_leader` otherwise), `GET /api/audit/cluster/events` (timeline). Non-leader rotate returns HTTP 423.

### Defects fixed 2026-07-31
- **D1:** `GET /cluster/events` was registered twice in `audit-routes.cjs`; the second handler was unreachable dead code. Consolidated into one handler with strict limit/offset clamping (`limit` clamped to 1..500, `offset` floored at 0).
- **D3:** `_lastAppliedRotatedAt` was declared and never used (dead code); `keyRotationStore.applyKeyringCommit` did no ordering check, so a stale `KEY_COMMIT` could regress the keyring. Implemented the guard in `_applyRemoteKeyCommit` + 5 new tests.
- **D2:** Added trusted-network TLS documentation block above `_startServer` and a plaintext-TCP startup warning.
- **D4:** This section.

### Out of scope (file as follow-ups, do not silently implement)
- True two-phase staging with quorum-ACK gate and staging timeout rollback.
- Real mTLS + CA chain + per-node encrypted key wrapping (only if deployment crosses untrusted networks).
- Edge-case simulation (quorum splits, simultaneous leader drops) — meaningful only after two-phase staging exists.
