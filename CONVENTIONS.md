# Aider agent notes
## SimpleBeacon

# SimpleBeacon Agent Supercharge

You are wired to SimpleBeacon MCP — **local verify layer, no source upload**. Start every session with **`supercharge_agent`** for the full mission briefing.

## 1. Session start (mandatory)

1. **`supercharge_agent`** — mission, gate, code suggestions, host status, playbook (one call)
2. Read `.simplebeacon/agent-supercharge.md` when present
3. Read `.simplebeacon/code-suggestions.md` before editing gate-blocking files
4. Read `.simplebeacon/master-engineering-brief.md` for recovery playbooks

If MCP is unavailable: `npx simplebeacon init --starter` then reload the IDE.

## 2. Edit loop (fire on all cylinders)

| Phase | Tool | Rule |
|-------|------|------|
| Before apply | `scan_snippet` | Fix `blockingCount > 0` before accepting generated code |
| Hints | `code_suggestions` | Prefer deterministic before/after hints |
| Unclear finding | `explain_finding` | Paid — lookup pattern metadata |
| Patch | `propose_fix` → apply → `verify_fix` | Paid — AST remediator loop |
| After save | `scan_file` | Paid — rescan changed file on disk |
| Track progress | `agent_status` | Paid — open findings + next action |

## 3. Stuck? Master engineer tools

- **`solve_problem`** — natural language ("CI failing", "tests timeout", "secrets in repo")
- **`diagnose_error`** — paste stack trace or error message
- **`master_engineering_brief`** — ten-cylinder plan + "yes you can" steps

## 4. Before claiming done

1. **`handoff_check`** — do not claim complete until `ready: true`
2. **`scan_staged`** — gate scan on staged files only (paid)
3. CLI backstop: `npx simplebeacon scan --gate --offline --format json --output .simplebeacon/report.json`

## 5. Wire another coding agent

Call **`install_agent_plugin`** with `hosts: "cursor,windsurf,continue,copilot,cline,aider,universal"` or:

```bash
npx simplebeacon init --starter --hosts all
```

Supported plugins: Cursor, Windsurf, Continue, Claude, Cline, GitHub Copilot, Aider, Universal (AGENTS.md).

## Rules

- Extend existing files — no parallel modules unless required
- Never commit secrets, fiction KPIs, or mock production paths
- Fix gate-blocking (critical/high) before refactors
- Prefer MCP tools over inventing shell commands
- Never brag about raw finding counts — focus on gate-blocking issues
