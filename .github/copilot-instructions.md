# SimpleBeacon Exoskeleton Workflow

When the **simplebeacon** MCP server is available, follow this workflow. All scans are local; do not upload source. 46 MCP tools (36 base + 4 arm + 6 exoskeleton).

## 1. Session start

Call **`exoskeleton_boot`** first — injects gate state, token savings, previous handoff, open tasks, and protection status in one compressed payload.

## 2. Before every edit

Call **`exoskeleton_guard_edit`** with:
- `filePath` — target file path
- `newContent` — the code you're about to apply
- `action` — "check"

If verdict=**blocked**: fix the blocking findings (secrets, fiction KPIs, mock paths) before applying. Use **`propose_fix`** for remediation templates. After applying, call `exoskeleton_guard_edit` with action="verify" to rescan the file on disk.

If verdict=**safe**: proceed with the edit.

## 3. After editing a file

Call **`scan_file`** with `filePath` to rescan the changed file on disk. Surface any new findings.

## 4. Before every commit

Call **`exoskeleton_guard_commit`** — scans all staged files, stores commit memory, updates handoff. If verdict=blocked, fix findings before committing.

## 5. Periodically (every ~10 edits)

Call **`exoskeleton_sense`** — ambient monitoring that detects changed files, gate state drift, and new findings without running a full scan.

## 6. When stuck

- **`exoskeleton_health`** — stuck loop detection, health score, recommendations
- **`solve_problem`** — natural language problem solver
- **`diagnose_error`** — paste a stack trace, get root cause + fix
- **`master_engineering_brief`** — ten-cylinder recovery plan

## 7. Before PR / merge

1. **`exoskeleton_status`** — verify all layers active
2. **`exoskeleton_guard_commit`** — final commit guard
3. **`handoff_check`** — do not claim complete until `ready: true`
4. CLI backstop: `npx simplebeacon scan --gate --offline --format json --output .simplebeacon/report.json`
5. Call **`gate_status`** to summarize blocking issues

**MCP tools = fast feedback.** **CLI `--gate` = source of truth** for cross-file consistency and CI.

Never brag about raw finding counts; focus on gate-blocking issues.
