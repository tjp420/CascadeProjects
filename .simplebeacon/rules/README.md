# SimpleBeacon Rules — Quickstart

This folder contains example rule blueprints and a tiny test harness for validating custom enterprise rules.

Getting started

- Validate rules locally:

```bash
node packages/simplebeacon-cli/scripts/validate-custom-rules.js --rules-dir ./.simplebeacon/rules/
```

- Run the provided harness (executes the validator):

```bash
node ./.simplebeacon/rules/__tests__/rules.test.js
```

Authoring tips

- Regex rules: provide a `matcher.type: 'regex'` with `pattern` and `paths` array. Optionally include a `fix` with `type: 'replace'`, `pattern` and `replacement`.
- AST rules: provide `matcher.type: 'ast'` with `language: 'javascript'` and a `visitor` function that accepts `{ ast, file, report }`.
- Lightweight CI: Validators will gracefully fallback to a regex advisory scan if `@babel/traverse` is not available. To enable full AST checks, add `@babel/traverse` to `packages/simplebeacon-cli` dependencies.

Remediation guidance

- The `fix` entry is used by the `remediate` CLI to apply deterministic string replacements. Prefer conservative, reviewable replacements and always include guidance in the `guidance` field.

Examples

- See `auth-secret-leak.js` for a regex-based credential detection example.
- See `insecure-llm-telemetry.js` for an AST-based example with a safe runtime fallback.
