Core Launch FAQ — SimpleBeacon

Q: Why choose this over Snyk or SonarQube?
A: Snyk is phenomenal for vulnerability data matrices, but it's built for security engineering teams. SimpleBeacon targets B2B Founders and CTOs directly by translating abstract security bugs into high-ticket business and legal risks (like tracking AGPL licenses that threaten corporate acquisitions). Plus, we require zero repo access.

Q: How do you handle false positives on license naming mismatches?
A: The analyzer leverages a custom risk-mapping rubric that normalizes varying SPDX identifiers. If a module lacks an explicitly declared type, it flags it as an actionable `UNKNOWN` warning for manual legal oversight rather than letting it slide silently.

Q: How does the CI gate work?
A: The scanner exits with a non-zero status when it finds Critical/High license risks. We've provided a GitHub Actions workflow (`.github/workflows/license-gate.yml`) that runs on PRs and uploads the generated `license-compliance-report.html` as an artifact.

Q: Does any code leave my machine?
A: No. The core analysis engine is local; only optional telemetry/upgrade checks are external. By default, the scanner runs fully offline using its cache file `.cache/npm-licenses.json`.

Q: What should I do if I find AGPL/GPL in my dependency tree?
A: Prioritize removal or replacement of the viral component. Use `tools/leads_manager.py remediate` to generate a ready-to-paste PR body with suggested replacement packages and commands.
