Pre-push secret scanner
=======================

This repository includes a pre-push scanner at `scripts/pre-push-scan.js` that the Husky hook invokes.

Behavior:
- Reads the pre-push stdin refs to determine changed/unpushed files.
- Filters out common noisy paths (`docs/`, `*.md`, `node_modules/`, `dist/`, `build/`, images).
- Prefers to run `gitleaks` (local binary or `npx gitleaks detect`) on the changed files.
- If `gitleaks` is not available or cannot run, falls back to a fast regex-based scan that looks for high-confidence secret patterns (AWS keys, GCP API keys, GitHub tokens, private key markers, Slack tokens, etc.).
- Exits non-zero if any findings are detected, blocking the push.

Install / recommend
- Installing `gitleaks` improves detection and reduces false positives.
- On macOS: `brew install gitleaks`.
- On Windows: download the appropriate binary from the gitleaks releases page and place it on PATH, or rely on `npx gitleaks` (may fail in some environments).

Customizing skips and patterns
- Edit `scripts/pre-push-scan.js` and change `SKIP_GLOBS` to add/remove skip rules.
- Add or tune `REGEX_PATTERNS` to improve fallbacks.

Notes
- The regex fallback is intentionally conservative to avoid too many false positives on small changed-file sets.
- For CI-level enforcement, keep the existing `.github/workflows/secret-scanning.yml` which runs a full repo scan server-side.
