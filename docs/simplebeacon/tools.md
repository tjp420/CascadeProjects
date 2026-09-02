# SimpleBeacon — Tools

Summary
- This document lists small tooling used by SimpleBeacon and the recommended developer workflows.

Key tools and scripts
- packages/simplebeacon-cli/bin/simplebeacon.js — primary CLI
- .simplebeacon/qa/*.cjs — helper scripts used by pre-commit and CI
- tools/spot_ai_watermarks.py — AST-based watermark detector (local-first Python tool)
- tools/test_watermarks.py — test harness for the watermark detector

Common developer workflows
- Run the watermark scanner locally:
  python tools/test_watermarks.py

- Run the SimpleBeacon CLI quick gate for changed files:
  npm run sb:hook:pre-commit (invoked by pre-commit hooks)

- Rebuild CLI (when editing rule engines or analyzers):
  npm run build --workspace=packages/simplebeacon-cli

Where to add new tools
- Add small utilities into tools/ for ad-hoc developer utilities.
- Add production-grade analyzers under packages/simplebeacon-cli so they bundle with the CLI.

Testing and CI
- Tools that are part of the gating flow should have a small unit test and be callable from CI.
- For Python tools add a simple GitHub workflow or call them from an existing CI job that runs on ubuntu-latest.

Support
- If adding a new tool that requires runtime dependencies, document install steps in this file and add a CI step to ensure the runner installs the dependency before invoking the tool.
