Title: chore(security): staged-only pre-commit fast gate + CI security-gate workflow

Description:
This PR adds a staged-only fast pre-commit secret scanner and a CI-hosted full security gate to protect the repository from accidental credential leakage while keeping local developer workflows fast.

What changed:
- `.github/workflows/security-gate.yml` — PR-run workflow that runs `gitleaks` and `simplebeacon --full --gate` and uploads reports.
- `scripts/sb-precommit-fast.js` — fast Node staged-only secret scanner (prefers gitleaks, falls back to conservative regex checks).
- `.husky/pre-commit` — updated to call the fast staged-only scanner.

Merge checklist:
- [ ] Review the workflow: `.github/workflows/security-gate.yml` and confirm the Node version and `npx simplebeacon` invocation are valid for CI.
- [ ] Approve the staged-only scanner's regex patterns and skip-globs.
- [ ] Ask team to install `gitleaks` or rely on the `zricethezav/gitleaks-action` in CI.
- [ ] Add branch protection rules requiring the `Security Gate` workflow to pass before merging.

Testing notes:
- Local quick-check: `node scripts/sb-precommit-fast.js` — will exit 0 if no staged files to scan.
- CI: The workflow will run on PRs and upload `gitleaks` and `simplebeacon` reports as artifacts.

Files of interest:
- .github/workflows/security-gate.yml
- scripts/sb-precommit-fast.js
- .husky/pre-commit

Authors: Automated by tooling agent; please review and adjust wording as desired.
