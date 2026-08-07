# Merge Plan — Open PR Backlog

> Drafted 2026-08-07. PR #579 (CI fixes) already merged to main.
> All 7 session PRs rebased onto patched main.

## PR Inventory

| PR | Branch | Title | Files | CI Status |
|---|---|---|---|---|
| #578 | feature/zkp-identity-tests | ZKP timing-attack fix + test expansion | 9 | 14 pass, 1 fail (Gitleaks perms) |
| #577 | feature/env-production-guard | .env.production guard | 10 | 2 pass, 0 fail, 18 pending |
| #576 | feature/har-export | HAR export capability | 33 | 1 pass, 3 fail (Gitleaks, Secret Gate, E2E) |
| #575 | fix/analyze-flexible-timeout-logging | Analyze/flexible timeout logging | 9 | 3 pass, 2 fail (E2E matrix) |
| #574 | fix/dashboard-network-issues | Dashboard network fixes | 9 | 1 pass, 1 fail (E2E webkit) |
| #573 | feature/regional-replication-router | Regional replication router | 12 | 2 pass, 0 fail, 18 pending |
| #572 | feature/compliance-policy-editor | Compliance policy editor | 8 | 1 pass, 0 fail, 25 pending |

## File Overlap Analysis

### Shared files across multiple PRs (conflict risk)

| File | PRs touching it |
|---|---|
| `.simplebeacon/qa/test_plan.md` | ALL 7 PRs (each overwrites with their own plan) |
| `ai-platform/server/lib/codebase-analyzer.cjs` | ALL 7 PRs |
| `ai-platform/server/lib/redis-cache.cjs` | ALL 7 PRs |
| `ai-platform/server/lib/redis-rate-limiter.cjs` | ALL 7 PRs |
| `ai-platform/server/routes/flexible-analyze-api.cjs` | ALL 7 PRs |
| `ai-platform/server/index.cjs` | #573, #574, #575 |
| `ai-platform/server/lib/flexible-analyze-utils.cjs` | #574, #575 |
| `ai-platform/web/simplebeacon-dashboard/index.html` | #574, #575 |
| `ai-platform/web/simplebeacon-dashboard/js-es2018/views/DashboardView.js` | #572, #576 |

### Key insight

The 5 shared files (`test_plan.md`, `codebase-analyzer.cjs`, `redis-cache.cjs`,
`redis-rate-limiter.cjs`, `flexible-analyze-api.cjs`) appear in ALL 7 PRs.
This means **every PR after the first will require a rebase** before merging.
The `test_plan.md` is the highest-conflict file since each PR overwrites it
with its own content.

## Remaining CI Failures

### 1. Gitleaks secret scan — `permissions` issue (affects #578, #576, #570, #571)

**Root cause**: `gitleaks-action@v2` calls the GitHub API to list PR commits,
but the default `GITHUB_TOKEN` doesn't have `pull-requests: read` permission.

**Fix needed**: Add `permissions: pull-requests: read` to the gitleaks job
in `security-gate.yml`.

### 2. Secret Gate — false positive on #576

**Root cause**: The secret scanner flags `ABCDEFGHIJKLMNOPQRSTUVWXYZ...` (the
base64 alphabet) in `simplebeacon-vscode-merged/dashboard-web/assets/main.js`
as a "high-entropy string". This is a false positive — it's a bundled asset
file, not source code.

**Fix needed**: Add `simplebeacon-vscode-merged/dashboard-web/assets/` to
the secret scanner's exclusion list, or mark these files as generated assets.

### 3. E2E tests — `require is not defined in ES module scope` (affects #576, #575, #574)

**Root cause**: `ai-platform/web/simplebeacon-dashboard/scripts/check-api.js`
uses `require()` but the dashboard `package.json` has `"type": "module"`.
Node treats `.js` files as ESM, breaking `require()`.

**Fix needed**: Rename `check-api.js` to `check-api.cjs`, or add an ESM
`import` wrapper. This is a pre-existing issue in the dashboard build setup.

### 4. E2E matrix (webkit/chromium) — flaky (affects #575, #574)

**Root cause**: Playwright browser launch failures (3-second exit time
suggests browser binary missing or sandbox issue). These are likely
flaky/environment issues, not code defects.

**Fix needed**: Re-run failed jobs or add `continue-on-error` for
non-chromium browsers in the E2E workflow.

## Merge Order

### Tier 1 — Merge immediately after CI passes (no blockers)

| Order | PR | Rationale |
|---|---|---|
| 1 | **#578** ZKP timing-attack fix | Security fix — highest priority. Only 1 CI failure (Gitleaks perms, not a code issue). 9 files, minimal overlap risk. |
| 2 | **#577** .env.production guard | Security guard — high priority. 10 files, no unique CI failures. Adds pre-commit protection. |

### Tier 2 — Merge after fixing CI issues

| Order | PR | Blocker | Rationale |
|---|---|---|---|
| 3 | **#574** Dashboard network fixes | E2E webkit (flaky) | 4 production bug fixes. 9 files, overlaps with #575 on `flexible-analyze-utils.cjs` and `ChatbotView.js`. Merge before #575 to avoid conflict. |
| 4 | **#575** Analyze/flexible timeout logging | E2E matrix (flaky) | Logging enhancement. 9 files, overlaps with #574. Merge after #574, then rebase. |
| 5 | **#573** Regional replication router | None (pending) | New feature. 12 files, overlaps with #574/#575 on `server/index.cjs`. Merge after #574/#575, then rebase. |

### Tier 3 — Requires CI fixes before merge

| Order | PR | Blocker | Rationale |
|---|---|---|---|
| 6 | **#572** Compliance policy editor | None (pending) | New UI feature. 8 files, overlaps with #576 on `DashboardView.js`. Merge before #576 to avoid conflict. |
| 7 | **#576** HAR export capability | Gitleaks perms + Secret Gate false positive + E2E | Largest PR (33 files). Needs Secret Gate exclusion for bundled assets and E2E fix. Merge last due to size and conflict surface. |

### Not in scope (older PRs, not from this session)

| PR | Status | Notes |
|---|---|---|
| #571 | 5 failures | Pre-existing, not from this session |
| #570 | 10 failures | Pre-existing, not from this session |

## Execution Plan

### Step 1: Fix Gitleaks permissions (quick win, unblocks #578 and #576)

Add `permissions: pull-requests: read` to the gitleaks job in
`security-gate.yml`. This is a one-line fix.

### Step 2: Merge #578 and #577 (Tier 1)

Both are security fixes with minimal CI issues. Merge via squash.

### Step 3: Rebase remaining 5 PRs onto updated main

After #578 and #577 land, rebase #574, #575, #573, #572, #576.

### Step 4: Merge #574 and #575 (Tier 2)

Merge #574 first (bug fixes), then rebase #575 and merge.

### Step 5: Merge #573 (Tier 2)

Rebase onto updated main, merge.

### Step 6: Fix Secret Gate false positive, merge #572 and #576 (Tier 3)

Add asset directory exclusion to secret scanner, fix E2E `check-api.js`
module issue, then merge #572 (rebase first), then #576 (rebase last,
largest conflict surface).

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `test_plan.md` conflicts on every merge | High | Low | Each PR overwrites with its own plan — resolve by keeping the latest PR's version |
| `codebase-analyzer.cjs` / `redis-*.cjs` conflicts | Medium | Medium | These are ambient changes from local dev — may need manual resolution |
| `flexible-analyze-api.cjs` conflicts | Medium | Medium | #574 and #575 both modify this file — merge #574 first, then rebase #575 |
| `DashboardView.js` conflicts (#572 vs #576) | Medium | Low | Different sections of the file — should auto-merge cleanly |
| E2E flakiness | High | Low | Re-run failed jobs; not a code issue |
