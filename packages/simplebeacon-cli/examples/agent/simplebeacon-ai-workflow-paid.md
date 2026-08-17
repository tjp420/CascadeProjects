# SimpleBeacon AI agent workflow (paid)

Use SimpleBeacon as the **verify layer** for any coding task. All scans are local; do not upload source.

## 1. Start every session

1. `get_context_pack` — repo map, pipeline metrics, verify commands
2. Read `.simplebeacon/agent-brief.md` and `.simplebeacon/ai-context.md` when present
3. `gate_status` — blocking issues from last scan

## 2. Before accepting edits

Call **`scan_snippet`** with `content` + `filePath`.

If `blockingCount > 0`:
1. **`explain_finding`** when pattern id is unclear
2. **`propose_fix`** → apply patch → **`verify_fix`**
3. **`agent_status`** for `nextAction`

## 3. After editing a file

Call **`scan_file`** on the changed path.

## 4. Before claiming done

Call **`handoff_check`**. Do not claim the task complete until `ready: true`.

## 5. Before PR / merge

1. **`scan_staged`** — gate scan on staged files only
2. **`gate_status`** + **`suggest_fixes`**
3. CLI backstop: `npx simplebeacon scan --gate --offline --format json --output .simplebeacon/report.json`

Never brag about raw finding counts; focus on gate-blocking issues.
