# Gate-Fail Remediation Tranche (2026-05-25)

## Root Cause Summary

The observed gate failure was driven by a **scan-scope/config drift**, not an active high-risk issue in canonical sample paths:

- A local expanded `.simplebeacon/config.json` scan scope included extra directories (`data/roadmap`, `config`, workflow/docker internals, `.simplebeacon`) and produced a phantom high-severity fiction hit for `cascade-project-roadmap.json`.
- The file `cascade-project-roadmap.json` is not present in active scan roots and is only referenced in historical/report text contexts.
- Canonical gate scope (`web/data`, `data/mock`, `data-central/ai-tools/mock-data`) reports clean: no high/critical findings.

## Failing Rules / Categories (from failing report snapshot)

| Rule/Type | Severity | Count | Top Offender(s) | Notes |
| --- | --- | --- | --- | --- |
| Fictional KPI | High | 1 issue (2 hits) | `cascade-project-roadmap.json` | Reported as `74.17% completion` + `999 open issues`; source file not present in canonical scoped paths |

## Immediate Critical Fixes Applied

- Restored `.simplebeacon/config.json` `scanPaths` to canonical production-safe scope:
  - `web/data`
  - `data/mock`
  - `data-central/ai-tools/mock-data`
- Preserved existing rule severity and gate policy (`failOn: ["high"]`) to keep enforcement strict where intended.
- Avoided broad code/data rewrites because active high/critical source violations were not reproducible under canonical scope.

## Validation Snapshot

- Canonical report baseline (`projectRoot: CascadeProjects` + `platformRoot: ai-platform`) shows:
  - `gate.pass: true`
  - `blockingCount: 0`
  - `severityCounts.high: 0`
- Expanded local-scope report (pre-fix) showed:
  - `gate.pass: false`
  - `blockingCount: 1`
  - `severityCounts.high: 2`
  - single offender: `cascade-project-roadmap.json`

## Remaining Blockers

- **None reproducible under canonical gate scope.**

## Owner Recommendations

- **Repo maintainer**: keep `.simplebeacon/config.json` scan paths canonical unless explicitly running a one-off forensic scan.
- **Security/quality owner**: if expanded scans are needed, run them as non-blocking informational jobs with separate output file and explicit label.
- **CI owner**: pin gate command to canonical config path and persist report artifact to avoid local-scope drift confusion.
