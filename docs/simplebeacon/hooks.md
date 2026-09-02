# SimpleBeacon — Hooks

Overview
- SimpleBeacon integrates with the repository through pre-commit hooks (husky) and CI workflows. Hook scripts are located under `.simplebeacon/qa/` and `.husky/`.

Root pre-commit
- Unix: .husky/pre-commit (calls `sb:hook:pre-commit`)
- Windows: .husky/pre-commit.cmd

Local pre-commit chain (quick)
1. lint-assets (fast asset hygiene)
2. env-production-guard (block staging production env)
3. gitleaks (secrets scanner)
4. pre-commit-gate (staged-file SimpleBeacon scan)

Key scripts
- sb:hook:pre-commit — the npm script that runs the local guard and gate
- .simplebeacon/qa/pre-commit-gate.cjs — copies staged files to temp dir, runs simplebeacon scan there
- .simplebeacon/qa/env-production-guard.cjs — prevents accidental staging of production env files

Best practices
- Keep hooks fast — staged-file-only scans are preferred during pre-commit.
- Do heavy full-scans in CI (nightly or per-PR backstop).
- Never commit production env files; the env-production-guard will block this.

CI integration
- CI workflows call `npx simplebeacon scan --full --gate --format json` and upload result artifacts.
- Use `if-no-files-found: ignore` for uploads in workflows that may not always produce artifacts to avoid false failures.

Troubleshooting
- If pre-commit fails locally, run the underlying scripts manually to inspect output:
  node .simplebeacon/qa/env-production-guard.cjs
  node .simplebeacon/qa/pre-commit-gate.cjs

For follow-ups
- Add new hook scripts under .simplebeacon/qa and document them here.
