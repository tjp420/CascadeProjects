SimpleBeacon Auto-Fix Framework

Overview

This document describes the deterministic auto-fix framework added to the SimpleBeacon CLI. The framework provides safe, reversible, deterministic codemods for a small set of rule types so the CLI and VS Code extension can perform dry-run analysis and (optionally) apply fixes automatically.

How to run

- Dry run (show diffs, no writes):
  npx simplebeacon fix . --fix-dry-run

- Apply fixes (non-reversible):
  npx simplebeacon fix . --fix

- Limit number of fixes applied:
  npx simplebeacon fix . --fix --max-fixes 10

Notes

- Deterministic remediation runs first; for remaining findings an LLM-based remediation may be attempted if configured (not enabled by default).
- Dry-run is recommended before applying automated fixes, especially on large codebases.
- Auto-fixes are intentionally conservative. Only patterns that are safe to replace without deep semantic understanding are applied automatically.

Deterministic fixes implemented (initial set)

- insecureRandom: Replace instances of Math.random() with a crypto-backed inline IIFE (node.js runtime). This provides a higher-entropy source than Math.random(). The replacement is designed to be self-contained (uses require("crypto") inline) so it doesn't rely on top-level imports.

- debugArtifacts: Remove `debugger;` statements and `console.debug(...)` calls.

- innerHtmlXss: Replace `element.innerHTML = ''` with `element.textContent = ''` for the safe clearing case. Assignments where content is inserted are not auto-fixed.

Limitations and safety

- The crypto-backed replacement uses Node's `require('crypto')` inline IIFE and is therefore safe for Node-based projects but may not be appropriate for browser-only code. The CLI will only apply the fixes when the pattern matches; review diffs in dry-run mode.
- Sensitive-data remediation is intentionally not auto-applied by deterministic codemods due to the risk of incorrectly removing secrets. The CLI provides guidance and can generate suggested patches that must be approved by a human.

Suggestion APIs

- The CLI exposes suggestion helpers that generate non-destructive diffs and remediation instructions for high-risk patterns that should not be auto-applied:
  - Sensitive data (committed secrets): generates a redaction diff and an env var + rotation guidance.
  - Hardcoded confidence values: suggests replacing numeric literals with a configurable threshold (env var).
  - Fictional KPI placeholders: suggests removing or converting placeholders to runtime metrics.

These suggestion APIs are used by the UI and by structured dry-run flows to present safe, human-reviewed remediation actions without automatically changing source control history.

Extending the framework

- Add a new fix function in `packages/simplebeacon-cli/src/lib/ast-remediator.js` and register it in the `FIX_REGISTRY` with the corresponding pattern ID.
- Implement tests and a dry-run example to validate behavior before enabling auto-apply.

If you want, I can: (a) add more deterministic fixers for the other high/critical patterns from your report, (b) add unit tests for the codemods, and (c) update the VSIX packaging to include the new docs and bump the extension version.
