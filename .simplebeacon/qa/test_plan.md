# test_plan.md

> Copy to `.simplebeacon/qa/test_plan.md` and fill before Builder writes feature code.
> User approval required unless the task explicitly includes an approved plan.

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | .env.production Guard — pre-commit safety check for production env files |
| Author (Builder) | Devin |
| Date | 2026-08-07 |
| Branch | feature/env-production-guard |
| Packages touched | .simplebeacon/qa (pre-commit hook) |

## Scope

### Goal

Build a bulletproof pre-commit guard that blocks commits when:
1. A `.env.production` or `.env.prod` file is staged (even via `git add -f`)
2. A staged JS/CJS/JSON file contains hardcoded production connection strings
3. A staged seed/migration script references production database URLs

This protects production data from accidental local script executions or
accidental commits of production environment files.

### Architecture

- **env-production-guard.cjs** (`.simplebeacon/qa/`) — fast pre-commit guard script
  - Scans staged files for `.env.production` / `.env.prod` filenames
  - Scans staged JS/CJS/JSON/sh files for production connection string patterns
  - Warns (not blocks) if a local `.env.production` exists but is not staged
  - Follows existing lint-assets.cjs / pre-commit-gate.cjs patterns
- **Pre-commit hook integration** — add to both `.husky/pre-commit` and `.husky/pre-commit.cmd`

### Detection Patterns

| Pattern | Example | Action |
|---------|---------|--------|
| Staged `.env.production` / `.env.prod` file | `git add -f .env.production` | **BLOCK** |
| Production DATABASE_URL in staged file | `DATABASE_URL=postgres://prod-db...` | **BLOCK** |
| Production REDIS_URL in staged file | `REDIS_URL=redis://prod-redis...` | **BLOCK** |
| Real Stripe secret key in staged file | `STRIPE_SECRET_KEY=sk_live_...` | **BLOCK** |
| Real Resend API key in staged file | `RESEND_API_KEY=re_...` (12+ chars) | **BLOCK** |
| NODE_ENV=production in staged .env file | `NODE_ENV=production` | **BLOCK** |
| Local `.env.production` exists (not staged) | File on disk but not in git | **WARN** |

### Files in scope

- `.simplebeacon/qa/env-production-guard.cjs` (NEW — guard script)
- `.husky/pre-commit` (add guard to chain)
- `.husky/pre-commit.cmd` (add guard to chain)

### APIs / routes

- N/A — pre-commit hook only, no API changes

### UI / IDE surfaces

- N/A — backend/CI only

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on env-production-guard.cjs | `node -c .simplebeacon/qa/env-production-guard.cjs` | [ ] |
| L1-02 | Guard passes with no staged files | `node .simplebeacon/qa/env-production-guard.cjs` (clean tree) | [ ] |
| L1-03 | Guard passes with normal staged files | Stage a normal .js file, run guard | [ ] |
| L1-04 | SimpleBeacon gate (staged files) | Pre-commit hook | [ ] |
| L1-05 | No secrets in diff | Manual / gate token rules | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Blocks staged .env.production file | Create `.env.production`, `git add -f`, run guard | Exit 1, error message about .env.production | [ ] |
| L2-02 | Blocks staged .env.prod file | Create `.env.prod`, `git add -f`, run guard | Exit 1, error message about .env.prod | [ ] |
| L2-03 | Blocks production DATABASE_URL in staged JS | Stage JS file with `postgres://prod-...`, run guard | Exit 1, error with file and line | [ ] |
| L2-04 | Blocks sk_live_ Stripe key in staged file | Stage file with `sk_live_...`, run guard | Exit 1, error with file and line | [ ] |
| L2-05 | Warns when local .env.production exists (not staged) | Create `.env.production` (don't stage), run guard | Exit 0, warning message | [ ] |
| L2-06 | Does not block .env.example files | Stage `.env.example`, run guard | Exit 0, no errors | [ ] |
| L2-07 | Does not block test/dev connection strings | Stage file with `postgres://localhost:5432/test` | Exit 0, no errors | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Empty .env.production file staged | Exit 1 — filename alone is a risk | [ ] |
| L3-02 | .env.production in subdirectory staged | Exit 1 — detected regardless of path depth | [ ] |
| L3-03 | Commented-out production URL in staged file | Exit 0 — comments are not active config | [ ] |
| L3-04 | Existing pre-commit chain still works | Run full pre-commit hook, all stages pass | [ ] |
| L3-05 | Guard runs in <1 second | Time the guard execution | <1000ms | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | Guard does not log actual secret values | [ ] |
| S-02 | Guard only shows file names and line numbers, not values | [ ] |
| S-03 | Guard itself contains no hardcoded secrets | [ ] |
| S-04 | Guard cannot be bypassed by renaming file to .env.PRODUCTION | [ ] |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________
