# Test Plan: Token-Leak Hard Stops (Pre-Commit Secret Gate)

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Option 1 — staged-file secret interception that **blocks git commits** when raw API keys, tokens, or private key material appear in the index |
| Author (Builder) | Builder (pending approval) |
| Date | 2026-07-30 |
| Branch | (current working tree) |
| Packages touched | `packages/simplebeacon-cli` (primary), root `.husky/`, `package.json`, `ai-platform/.husky/` (hook wiring only) |

## Objective

Turn the existing credential pattern engine into a **fast, staged-only pre-commit hard stop** so developers cannot commit unencrypted secrets (`ghp_`, `sk-`, `AKIA…`, Stripe keys, PEM blocks, etc.). Full-repo gate scans remain available but secrets are caught **first** on staged hunks only (<2s target).

## Background (current state)

| Component | Today | Gap |
|-----------|-------|-----|
| `credential-pattern-scanner.js` | Detects 14+ secret shapes; `scanTextContent()` exported; severity bands include `critical` | Not wired to git staged index |
| `git-diff-scope.js` | `collectGitDiffFiles()` for CI PR diffs (base…head) | **No** `collectGitStagedFiles()` |
| `hook-install.js` | Writes hook running full `npx simplebeacon scan --gate --fail-on high` | Slow; scans whole repo; secrets mixed with general gate |
| Root `.husky/pre-commit` | `npm run sb:hook:pre-commit` → full scan | Does not inspect **staged hunks only**; no dedicated secret exit messaging |
| `token-bleed-patterns.js` | LLM context bleed (medium advisory) | **Out of scope** — different problem than credential leaks |

## Architecture (Broom — extend existing files)

### 1. Staged file collector — `packages/simplebeacon-cli/src/lib/git-diff-scope.js`

Add:

```js
collectGitStagedFiles(cwd) → string[] | null
```

Implementation:

- `git diff --cached --name-only --diff-filter=ACMR`
- Normalize paths (reuse `normalizeRelPath`)
- Return `null` if not a git repo or command fails

Add optional helper:

```js
readStagedFileContent(cwd, relativePath) → string | null
```

- `git show :path` for staged blob (handles binary skip: return null if non-text)

### 2. Staged secrets gate — `packages/simplebeacon-cli/src/lib/credential-pattern-scanner.js`

Add exported function:

```js
runStagedSecretsGate(cwd, options?) → {
  pass: boolean,
  blockingCount: number,
  findings: Issue[],
  scannedFiles: number,
  skippedFiles: string[]
}
```

Behavior:

- Collect staged paths via `collectGitStagedFiles`
- Skip paths matching existing exclusions (`isCredentialScanExcludedPath`, `.env` committed files still scanned)
- Scan **staged blob content only** (not working tree — prevents unstaged secrets from blocking unrelated commits)
- Treat `severityBand === 'critical'` OR pattern ids in `{ github-pat, github-oauth, openai-key, aws-access-key, stripe-key, private-key-block, resend-key, sendgrid-key }` as **blocking**
- Treat generic-api-key / bearer-token as blocking only when match length ≥ 20 and not allowlisted
- Exit payload suitable for CLI stderr (file:line, pattern id, redacted snippet)

### 3. CLI surface — `packages/simplebeacon-cli/bin/simplebeacon.js`

**Preferred (minimal):** new subcommand `secrets-gate`

```
simplebeacon secrets-gate [--path .] [--json] [--dry-run]
```

- Default: scan staged files in `--path` (default cwd)
- `--json`: machine-readable findings
- `--dry-run`: report only, exit 0
- Exit codes: `0` pass, `1` secrets found (blocking), `2` usage error, `78` policy gate (inherit existing env if ever invoked from gated entry — hook uses direct import, not policy gate)

Wire into help text and `VALID_COMMANDS`.

**Alternative considered:** `--staged-secrets` flag on `scan` — rejected to keep pre-commit path fast and avoid full scan engine startup.

### 4. Hook installer — `packages/simplebeacon-cli/src/hook-install.js`

Update `buildHookScript()` pre-commit template to **two-phase**:

```sh
# Phase 1 — fast staged secret hard stop (<2s)
npx simplebeacon secrets-gate --path .
# Phase 2 — existing full gate (optional, configurable)
npx simplebeacon scan --gate --fail-on high
```

New installer options:

- `secretsOnly: true` — phase 1 only (Community default for new installs)
- `failOn` unchanged for phase 2

### 5. Monorepo hook wiring

| File | Change |
|------|--------|
| Root `package.json` | Add `"sb:hook:secrets-gate": "npx simplebeacon secrets-gate --path ."`; update `sb:hook:pre-commit` to run secrets-gate **before** full scan |
| `.husky/pre-commit` | Call secrets-gate first; abort with clear message on exit 1 |
| `.husky/pre-commit.cmd` | Same ordering for Windows |
| `ai-platform/.husky/pre-commit` | Mirror pattern if touched |

Hook failure message (stderr):

```
[SimpleBeacon] COMMIT BLOCKED — staged secret detected
  path/to/file.js:42  github-pat  (rotate credential; use env/secret manager)
Run: npx simplebeacon secrets-gate --path .
```

### 6. Config hooks (optional, phase 1.1)

`.simplebeacon/config.json` optional block:

```json
"secretsGate": {
  "enabled": true,
  "blockPatterns": ["github-pat", "openai-key", "..."],
  "scanStagedOnly": true
}
```

**Defer to post-MVP** unless needed for approval — hardcoded blocking set in scanner is sufficient for v1.

## Files in scope

- `packages/simplebeacon-cli/src/lib/git-diff-scope.js` (modify)
- `packages/simplebeacon-cli/src/lib/credential-pattern-scanner.js` (modify)
- `packages/simplebeacon-cli/bin/simplebeacon.js` (modify)
- `packages/simplebeacon-cli/src/hook-install.js` (modify)
- `packages/simplebeacon-cli/tests/git-diff-scope.test.js` (new)
- `packages/simplebeacon-cli/tests/staged-secrets-gate.test.js` (new)
- Root `package.json` (modify scripts)
- `.husky/pre-commit`, `.husky/pre-commit.cmd` (modify)

### Explicitly out of scope

- VS Code extension UI changes
- Dashboard web changes
- `token-bleed-patterns` (LLM payload bleed — separate rule family)
- Cloudflare / email DNS
- Rewriting full gate engine or adding new npm dependencies

## APIs / routes

- CLI: `simplebeacon secrets-gate`
- CLI: `simplebeacon hook install --secrets-only` (optional flag)
- No REST endpoints

## UI / IDE surfaces

- [ ] Sidebar webview — no change
- [ ] Dashboard — no change
- [x] Pre-commit hook stderr — **primary user-facing surface**
- [ ] Extension — future: surface last secrets-gate failure in Output panel (enhancement, not v1)

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax `git-diff-scope.js` | `node -c packages/simplebeacon-cli/src/lib/git-diff-scope.js` | [ ] |
| L1-02 | Syntax `credential-pattern-scanner.js` | `node -c packages/simplebeacon-cli/src/lib/credential-pattern-scanner.js` | [ ] |
| L1-03 | Syntax `simplebeacon.js` | `node -c packages/simplebeacon-cli/bin/simplebeacon.js` | [ ] |
| L1-04 | Syntax `hook-install.js` | `node -c packages/simplebeacon-cli/src/hook-install.js` | [ ] |
| L1-05 | Unit tests | `cd packages/simplebeacon-cli && node --test tests/git-diff-scope.test.js tests/staged-secrets-gate.test.js tests/credential-pattern-scanner.test.js` | [ ] |
| L1-06 | CLI help exposes command | `node packages/simplebeacon-cli/bin/simplebeacon.js secrets-gate --help` | [ ] |
| L1-07 | Full gate regression | `npx simplebeacon scan --gate --offline` (repo root) | [ ] |
| L1-08 | npm audit (if deps unchanged) | skip / confirm no package.json dep changes | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Block real GitHub PAT in staged file | Create temp repo; stage `const k='ghp_abc123...'`; run `secrets-gate` | Exit 1; finding cites `github-pat` | [ ] |
| L2-02 | Allow placeholder | Stage `apiKey = 'your-api-key-here'` | Exit 0 | [ ] |
| L2-03 | Unstaged secret does not block | Secret in working tree but **not** staged | Exit 0 | [ ] |
| L2-04 | Empty staged set | No staged files | Exit 0; message "nothing staged" | [ ] |
| L2-05 | Pre-commit hook ordering | `git commit` with staged secret | Commit aborted before full scan; stderr shows COMMIT BLOCKED | [ ] |
| L2-06 | Clean commit proceeds | Stage safe change; commit | secrets-gate pass → full hook continues | [ ] |
| L2-07 | Suppression comment | Same-line `// simplebeacon-ignore credentials` | Exit 0 | [ ] |
| L2-08 | PEM private key block | Stage file with a PEM private key header pattern | Exit 1; `private-key-block` | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Binary staged file (png) | Skipped silently; no crash | [ ] |
| L3-02 | Submodule / deleted-only staging | Handled; no false crash | [ ] |
| L3-03 | Scanner self-test fixtures | Still excluded via `isCredentialScanExcludedPath` | [ ] |
| L3-04 | Windows path normalization | Staged paths with `\` normalized | [ ] |
| L3-05 | Policy gate env absent | `secrets-gate` does **not** require policy env vars (direct scanner import) | [ ] |
| L3-06 | `--json` output schema | `{ pass, blockingCount, findings[] }` stable keys | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | Findings stderr must redact matched secret (show first 4 + `…` only) | [ ] |
| S-02 | No secret values written to `.simplebeacon/report.json` from secrets-gate | [ ] |
| S-03 | Hook cannot be bypassed via `git commit --no-verify` documentation only (inherent git limitation) | [ ] |

---

## Implementation sequence (after approval)

1. `collectGitStagedFiles` + tests  
2. `runStagedSecretsGate` + tests  
3. `secrets-gate` CLI command  
4. Hook installer + root husky scripts  
5. Validator pass (L1/L2)

---

## Approval

- [ ] User approved this plan (reply **implement the plan** or **approved** to proceed)
- Approved by: __________  Date: __________
