# test_plan.md — CascadeProjects Repository Health Plan

> Generated from SimpleBeacon scan on 2026-08-05.
> Scan ID: `sb_scan_62fe029b4bf4` | Gate: PASS | Build Readiness: 100/100

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Repository hygiene cleanup + scanner config hardening |
| Author (Builder) | Devin |
| Date | 2026-08-05 |
| Branch | main |
| Packages touched | root, .simplebeacon |

## Scan Summary

| Metric | Value |
|--------|-------|
| Gate status | PASS |
| Blocking issues | 0 |
| Warning issues | 8 (all low severity) |
| Critical / High / Medium | 0 / 0 / 0 |
| Total files (repo) | 3,561 |
| Total folders | 369 |
| Total lines | 1,451,024 |
| Total size | 189.8 MB |
| Build readiness | 100/100 (READY) |
| Credential findings | 0 |
| Production leak findings | 0 |
| Schema validation | 51/51 passed |
| Consistency checks | 160/160 passed |
| Scan tier | developer (50-file limit) |

## Findings Detail

### 1. Duplicate Data Groups (2 groups, low severity)

| Group | Files | Description |
|-------|-------|-------------|
| `dependency-security-report.json` | 2 copies | `generated/check/` and `generated/procurement-kit-tmp/` |
| `verify-isolation.json` | 3 copies | `generated/check/`, `generated/procurement-kit-tmp/`, `generated/download/tmp/` |

**Root cause:** Build artifacts generated in multiple temp directories without cleanup.

### 2. API Contract Patterns (3 findings, low severity)

| File | Line | Match |
|------|------|-------|
| `ai-platform-openapi-prism.yml` | 62 | `openapi.yaml` |
| `ai-platform/docker-compose.prism.yml` | 8 | `openapi.yaml` |
| `.github/workflows/ai-platform-openapi-prism-dispatch.yml` | 29 | `openapi.yaml` |

**Status:** Benign — these are Prism mock server config references to the OpenAPI spec file.

### 3. Git-Tracked Temp Files (43 files, untracked by .gitignore)

**43 temp/log/debug files are tracked in git** and NOT covered by .gitignore:

| Category | Count | Examples |
|----------|-------|---------|
| `.tmp-commit-*.txt` | 12 | `.tmp-commit-audit-policy.txt`, `.tmp-commit-hsm.txt` |
| `.tmp-*.cjs` | 2 | `.tmp-fix-phase4b.cjs`, `.tmp-migrate-phase4b.cjs` |
| `tmp_*.txt` / `tmp_*.json` / `tmp_*` | 7 | `tmp_auth.txt`, `tmp_extract2.json`, `tmp_index.html` |
| `tmp-*.ps1` / `tmp-*` | 5 | `tmp-find-html.ps1`, `tmp-branch-clone`, `tmp-release-clone` |
| `*.err` | 2 | `ai-platform-server.err`, `vite-dashboard.err` |
| `headers*.txt` | 4 | `headers.txt`, `headers2.txt`, `headers3.txt`, `headers4.txt` |
| Debug/output `.txt` | 11 | `cli-scan-test.txt`, `main_js.txt`, `test-output2.txt`, `ts_out.txt` |

**Total tracked junk:** ~43 files that should be removed from git history and gitignored.

### 4. Untracked Log Files (71 files, ~3 MB, gitignored but not cleaned)

71 log files in the root directory are properly gitignored but accumulate on disk:

| Category | Count | Size |
|----------|-------|------|
| `gh_run_*.log` | 7 | ~596 KB |
| `ci_run_*.log` | 3 | ~395 KB |
| `jest-run*.log` | 2 | ~1.6 MB |
| `gate-status*.txt` | 13 | ~125 KB |
| `scan-output*.txt` | 6 | ~58 KB |
| `server*.log` / `svr*.log` | 16 | ~70 KB |
| Other `.log` / `.err` | 24 | ~200 KB |

### 5. .env Files in Root (4 files, 0 findings)

| File | Status |
|------|--------|
| `.env` | Gitignored, 0 credential findings |
| `.env.example` | Safe — template file |
| `.env.production` | Gitignored, 0 credential findings |
| `.env.sample` | Safe — template file |

**Status:** Clean — no credentials detected, all real env files are gitignored.

---

## Action Plan

### Phase 1: Remove git-tracked temp files (HIGH PRIORITY)

**Goal:** Remove 43 junk files from git tracking and add patterns to .gitignore.

**Files to `git rm`:**
- All `.tmp-commit-*.txt` (12 files)
- All `.tmp-*.cjs` (2 files)
- All `tmp_*.txt`, `tmp_*.json`, `tmp_index.html` (7 files)
- All `tmp-*.ps1`, `tmp-branch-clone`, `tmp-release-clone` (5 files)
- `ai-platform-server.err`, `vite-dashboard.err` (2 files)
- `headers*.txt` (4 files)
- `cli-scan-test.txt`, `consolidation-analysis.txt`, `diff-scanReport.txt`, `main_js.txt`, `pr-302-body.txt`, `server-startup-error.txt`, `test-output2.txt`, `test-tokens.txt`, `ts_out.txt`, `vsix-dirs*.txt` (11 files)

**.gitignore additions:**
```
.tmp-*
tmp_*
tmp-*
*.err
headers*.txt
cli-scan-test.txt
consolidation-analysis.txt
diff-scanReport.txt
main_js.txt
pr-302-body.txt
server-startup-error.txt
test-output*.txt
test-tokens.txt
ts_out.txt
vsix-dirs*.txt
```

### Phase 2: Consolidate duplicate build artifacts (MEDIUM PRIORITY)

**Goal:** Eliminate 2 duplicate data groups flagged by the scanner.

- Remove `generated/procurement-kit-tmp/dependency-security-report.json` (duplicate of `generated/check/`)
- Remove `generated/procurement-kit-tmp/verify-isolation.json` and `generated/download/tmp/verify-isolation.json` (duplicates of `generated/check/`)
- Add `generated/procurement-kit-tmp/` and `generated/download/tmp/` to .gitignore if these are transient build dirs

### Phase 3: Clean local log file accumulation (LOW PRIORITY)

**Goal:** Delete 71 gitignored log files from the working directory to reclaim ~3 MB.

- Delete all `*.log`, `*.err`, `gh_run_*.log`, `ci_run_*.log`, `gate-status*.txt`, `scan-output*.txt` from root
- These are already gitignored so this is purely local disk hygiene

### Phase 4: Scanner config verification (COMPLETED)

**Status:** Already done in commit `2f807a12c` — worktree exclusion patterns added to `config-full-coverage.json`.

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on changed files | `node -c <file>` (N/A — no .cjs changes) | [ ] |
| L1-02 | ai-platform tests | `cd ai-platform && npm test` (N/A — no ai-platform changes) | [ ] |
| L1-03 | Extension compile | `cd simplebeacon-vscode-merged && npm run compile` (N/A) | [ ] |
| L1-04 | SimpleBeacon gate | `npx simplebeacon scan --gate --format json` | [ ] |
| L1-05 | No secrets in diff | Gate credential scan — 0 findings | [x] |
| L1-06 | npm audit | `npm audit` (N/A — no deps changed) | [ ] |

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Gate still passes after cleanup | Run gate scan after Phase 1-2 | PASS, 0 blocking | [ ] |
| L2-02 | No tracked files lost | `git status` shows only deletions of temp files | Clean working tree | [ ] |

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | .gitignore patterns catch future temp files | Create `.tmp-test.txt`, verify `git check-ignore` matches | Ignored |
| L3-02 | Build artifacts regenerate correctly | Run build, verify `generated/check/` outputs still produced | No regression |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No credentials / PII in temp files | [ ] — verify before deletion |
| S-02 | .env files remain gitignored | [x] — confirmed |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________
