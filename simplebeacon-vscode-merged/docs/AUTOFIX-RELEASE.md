SimpleBeacon VS Code Extension — Auto-Fix Notes

This extension version integrates with the SimpleBeacon CLI auto-fix framework (deterministic codemods + suggestion helpers).

What changed in the VSIX:

- The extension exposes two commands:
  - `SimpleBeacon: Dry run Fix` — runs a structured dry-run and displays suggested diffs in the Output panel.
  - `SimpleBeacon: Apply Fixes` — applies deterministic fixes using the CLI (requires confirmation).
- The UI now marks auto-fixable findings and offers a guided remediation flow for suggestion-only findings.

Safety:

- The extension will never automatically rewrite git history to remove secrets; sensitive-data findings are suggested-only and require human review.

See also:

- packages/simplebeacon-cli/AUTOFIX.md
- packages/simplebeacon-cli/CHANGELOG.md
