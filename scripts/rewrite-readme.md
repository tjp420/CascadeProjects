# Repository History Sanitization Playbook (DOCUMENTATION-ONLY)

> IMPORTANT: This document is a documentation-only playbook. It does NOT authorize or execute any Git history rewrite.
> DO NOT run the commands in your active working repository. All history operations must be executed on a verified mirror clone and require separate, explicit organizational authorization.

## Purpose
This file documents a safe, reviewable sequence for removing sensitive files and literal tokens from a repository history using `git-filter-repo`. Treat this as an operational checklist and not a script to run in-place.

The print-only helper is `scripts/rewrite-scan-artifact-history.ps1`. It does not rewrite this working tree and does not push. `demo/demo-report.json` stays in the tree (scanService demo fixture) and must not be added to `paths-to-remove.txt`.

## Key Safety Principles (read first)
- Never run destructive history edits in your working checkout. Use a mirror clone.
- Do not place live credentials or secrets inside `scripts/replacements.txt` — use placeholder abstractions only.
- `git push --force --mirror` replaces ALL remote branches, tags and refs. Only an authorized operator should perform that step.
- Do not commit this playbook if your team policy prohibits storing operational runbooks alongside application code. Keep it uncommitted until you have explicit approval.

## Preflight Verification (mandatory)
Run these checks in your working repository and record the outputs before creating a mirror clone.

```bash
# 1. Confirm remotes and fetch URLs
git remote -v

# 2. Confirm working tree is clean (no unstaged/uncommitted changes)
git status --porcelain

# 3. List branches and tags
git branch -a
git tag --list

# 4. Detect shallow clones (must be false)
git rev-parse --is-shallow-repository

# 5. Record a short log sample for auditing
git log --all --pretty=oneline | head -n 20
```

Record the outputs in a secure incident log before proceeding.

## Configuration File Safety Audit (MANDATORY REVIEW)
- `scripts/paths-to-remove.txt` must contain explicit repository-root-relative paths (no unanchored wildcards). Example: `tmp-prepush-leak.js`, `.outbound/`.
- Do not list `demo/demo-report.json` or `demo/dashboard-report.json`.
- `scripts/replacements.txt` MUST NOT contain real secrets or live credentials. Use generic placeholders (e.g. `sk_live_... ==> REDACTED_STRIPE_KEY`).
- Have an independent reviewer (different person) inspect these two files and sign off in the audit log.

## Execution Sequence (to run only on a verified mirror clone)

1) Create an isolated mirror clone (outside your working repo):

```bash
git clone --mirror <REPOSITORY_URL> simplebeacon-history-mirror.git
cd simplebeacon-history-mirror.git
```

2) Review the helper script output (do not run it in the working repo). The helper prints the exact `git-filter-repo` invocation for the mirror directory.

3) Execute `git-filter-repo` on the mirror only (example):

```bash
git filter-repo \
  --invert-paths --paths-from-file "../scripts/paths-to-remove.txt" \
  --replace-text "../scripts/replacements.txt"
```

4) Post-sanitization verification (do NOT push until these all pass):

```bash
# search for token patterns that should be removed
git grep -n "sk_live_" || echo "OK: stripe pattern not found"

# sample commit history check
git log --all --pretty=oneline | head -n 20

# object/count size verification
git count-objects -v
```

5) Independent verification: have at least one other engineer review the mirror repo results and confirm no secrets remain before any upstream push.

6) If authorized, add a sanitized remote and push the cleaned mirror (AUTHORIZATION REQUIRED):

```bash
git remote add sanitized-origin <REPOSITORY_URL>
# WARNING: This force-push replaces all upstream refs. Confirm authorization, backups, and communication.
git push --force --mirror sanitized-origin
```

## Backup & Rollback Protocol
- Keep the pre-rewrite mirror backup intact until the sanitized history is verified by the team.
- If verification fails, DO NOT push. Restore using the backup mirror:

```bash
cd ../simplebeacon-pre-rewrite-backup.git
git push --force --mirror <REPOSITORY_URL>
```

## Credentials and Rotation (OPERATIONS NOTE)
- A Git history rewrite does NOT rotate credentials. Credential rotation is a separate, manual operational step and must be performed via your secret-management systems (Vault, cloud console, Stripe Dashboard, etc.).
- Plan and execute credential rotation (database passwords, JWT keys, API keys) before or immediately after the cleanup; document rotations in the incident log.

## Communication & Coordination (TEMPLATE NOTES)
- Use placeholder dates/times in messages; do not imply the window is scheduled unless it actually is.
- Require a 15-minute push-freeze before the operator runs the rewrite.
- Provide explicit post-operation resync instructions and tell contributors to reclone.

## Do not commit or execute
This file is intended as a documentation-only runbook. Do not commit or push this file unless your organizational policy explicitly allows it and the contents have been approved by security and engineering leadership.

## Appendix: Minimal checklist for the authorized operator
- Confirm preflight outputs recorded
- Confirm independent reviewer sign-off on `paths-to-remove.txt` and `replacements.txt`
- Create mirror clone and run `git-filter-repo` on the mirror
- Run verification commands and obtain independent approval
- Coordinate force-push (only when authorized)
- Announce completion and provide resync instructions
