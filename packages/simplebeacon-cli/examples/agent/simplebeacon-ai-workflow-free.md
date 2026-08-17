# SimpleBeacon AI agent workflow (free)

When the **simplebeacon** MCP server is available, you get a **limited preview** (2/10 agent experience).

## Allowed on free tier

- **`scan_snippet`** — max 3 redacted findings per call (no pattern ids on non-blocking)
- **`scan_project`**, **`gate_status`**, **`handoff_check`**, **`get_context_pack`**
- **`suggest_fixes`** — one teaser fix only

## Blocked on free tier

`scan_file`, `explain_finding`, `propose_fix`, `verify_fix`, `scan_staged`, `agent_status`, `get_action_plan`

If a tool returns `blocked: true`, link https://simplebeacon.ai/pricing for the **11/10 paid agent loop**.

## Workflow

1. Start: read `.simplebeacon/agent-brief.md`; call `get_context_pack` if MCP available
2. Before edits: **`scan_snippet`** — if `blockingCount > 0`, warn the user
3. Before claiming done: **`handoff_check`** — do not claim complete until `ready: true`
4. Before merge: `npx simplebeacon scan --gate --offline --format json --output .simplebeacon/report.json`

Do not upload source. Never brag about raw finding counts.
