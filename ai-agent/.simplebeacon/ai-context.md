# SimpleBeacon AI context

- **Project:** `C:\Users\user\CascadeProjects\ai-agent`
- **Task profile:** Repository hygiene (hygiene)
- **Gate:** PASS
- **Agent experience:** 11/10
- **Updated:** 2026-08-17T04:19:10.453Z

## Pipeline metrics

| Stage | Count |
|-------|------:|
| Inventory (repo files) | 24 |
| Rule-scoped analyzed | 24 |
| Files analyzed | 24 |
| Gate blocking | 0 |


## Next action

Run scan_snippet on the next edit, then propose_fix for any blocking findings.

## Domain guidance

General software. Extend existing handlers inline; match naming and module system in repo.

## Entry points

- `package.json`

## Verify commands

- `npx simplebeacon scan --gate --offline --format json --output .simplebeacon/report.json`
- `npm test --if-present`

## Coding rules

- Read .simplebeacon/agent-brief.md and .simplebeacon/ai-context.md before editing.
- Extend existing files — avoid parallel modules unless the scan requires it.
- Never commit secrets, mock production paths, or fiction KPIs.
- Fix gate-blocking (critical/high) before refactors.
- MCP loop: scan_snippet → edit → scan_file → gate_status before merge.
