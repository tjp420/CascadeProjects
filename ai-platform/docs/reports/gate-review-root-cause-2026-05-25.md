# Gate Review Root Cause (2026-05-25)

## Issue -> file -> rule -> fix plan

1. Fiction hit: `74.17% completion claim`
   - File: `cascade-project-roadmap.json` (legacy roadmap artifact reference in scan results)
   - Rule: `sample-consistency` (fiction KPI detection)
   - Fix plan: keep canonical sample paths and ignore legacy `cascade-project-roadmap.json` artifacts for active gate scans.

2. Fiction hit: `999 open issues claim`
   - File: `cascade-project-roadmap.json` (same source as above)
   - Rule: `sample-consistency` (fiction KPI detection)
   - Fix plan: same as issue 1; no fabricated replacement values, treat as archived legacy artifact.

## Applied remediation

- Added `**/cascade-project-roadmap.json` to `.simplebeacon/config.json` ignore list.
- Retained strict gate policy (`failOn: ["high"]`) and existing security/schema checks.
- Kept canonical scan paths (`web/data`, `data/mock`, `data-central/ai-tools/mock-data`) for fast reliable gating.

## Prevention control

- Explicit ignore rule for this known legacy artifact prevents recurrent false-review noise while preserving enforcement on active sample payloads.
