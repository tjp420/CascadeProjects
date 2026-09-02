# SimpleBeacon — Overview

This document summarizes the SimpleBeacon subsystem in this repository and where to find the primary artifacts and integration points.

Purpose
- SimpleBeacon provides local-first static analysis, security gates, and policy scanners used by pre-commit hooks and CI to detect secrets, policy violations, AI-watermark signals, and other supply-chain risks.
- Designed to run offline in developer workstations and in CI (via npx/simplebeacon CLI) so results are reproducible and auditable.

Key locations
- CLI binary: packages/simplebeacon-cli/bin/simplebeacon.js
- Config: .simplebeacon/config.json
- Gate reports: .simplebeacon/report.json (repo-level) and package-specific reports (e.g., .simplebeacon/report-ai-platform.json)
- QA scripts: .simplebeacon/qa/
- Pre-commit helpers: .simplebeacon/qa/pre-commit-gate.cjs, .simplebeacon/qa/env-production-guard.cjs

Common commands
- Run a gate scan locally (full):
  npx simplebeacon scan --full --gate --format json --output .simplebeacon/report.json

- Run scan on a package:
  npx simplebeacon scan --path ai-platform --gate --format json --output .simplebeacon/report-ai-platform.json

Design principles
- Local-first: never upload source to external services by default.
- Fast staged-file pre-commit scans: only scan staged files in pre-commit to keep feedback fast.
- CI gates are authoritative: CI uses the full-scan gate and SARIF artifacts for triage.

See also: docs/simplebeacon/instructions.md and docs/simplebeacon/hooks.md for runbooks and hook configuration details.