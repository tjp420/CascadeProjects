# Connect SimpleBeacon to any AI coding agent

One command wires MCP + agent instructions for **Cursor, Windsurf, Continue, Claude, and universal fallback (AGENTS.md)**.

```bash
npx simplebeacon init --starter
# equivalent: npx simplebeacon init --agent
```

All scans are **local**. No source upload.

---

## What gets installed

| Host | MCP config | Instructions |
|------|------------|--------------|
| **Cursor** | `.cursor/mcp.json` | `.cursor/rules/simplebeacon-ai-workflow.mdc` |
| **Windsurf** | `.windsurf/mcp.json` | `.windsurf/rules/simplebeacon.md` |
| **Continue** | `.continue/config.json` (merged) | `.continue/rules/simplebeacon.md` |
| **Claude** | user-global (see below) | `CLAUDE.md` section |
| **Universal** | `.simplebeacon/mcp-reference.json` | `AGENTS.md` section |

Also installed with `--starter`:

- Cursor **preToolUse** hook (paid license blocks slop on apply)
- Git **pre-commit** hook (gate on `high`+)
- CI workflow (GitHub Actions by default)
- `.simplebeacon/agent-brief.md` + `ai-context.md` stubs

---

## Host-specific reload steps

### Cursor

1. Reload window
2. **Settings → MCP** → enable **simplebeacon**

### Windsurf

1. Reload window
2. Open MCP settings → confirm **simplebeacon** appears from `.windsurf/mcp.json`

### Continue

1. Reload VS Code / Continue
2. Confirm `.continue/config.json` lists `simplebeacon` under MCP servers

### Claude Desktop / Claude Code

CLI does **not** write user-global config automatically. After `init --starter`, copy the JSON printed under **Claude Desktop hint** into:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Read `CLAUDE.md` in the repo for the verify loop.

### VS Code + Copilot (no MCP)

Read **`AGENTS.md`** — Copilot uses repo instructions when present. Run CLI gate before merge:

```bash
npx simplebeacon scan --gate --offline
```

---

## MCP tools (20 total)

| Phase | Tools |
|-------|-------|
| Start | `get_context_pack`, `get_agent_brief`, `gate_status` |
| Before edit | `scan_snippet` |
| After save | `scan_file` (paid) |
| Fix loop | `explain_finding`, `propose_fix`, `verify_fix` (paid) |
| Before claiming done | **`handoff_check`** (free) |
| Before PR | `scan_staged` (paid), `gate_status`, `suggest_fixes` |

Verify MCP:

```bash
npx simplebeacon-mcp --smoke-test
```

---

## Options

```bash
npx simplebeacon init --starter --hosts cursor,continue   # subset
npx simplebeacon init --starter --smoke                   # run gate scan after init
npx simplebeacon init --starter --force                   # overwrite existing configs
npx simplebeacon init --with-mcp --hosts cursor           # MCP only, Cursor
```

| Flag | Effect |
|------|--------|
| `--starter` / `--agent` | All hosts + hooks + CI |
| `--hosts` | `all`, `auto`, or comma list |
| `--with-hooks` | Cursor pre-apply hook |
| `--smoke` | Post-init gate scan + refresh brief |

---

## Agent workflow (all hosts)

1. Read `.simplebeacon/agent-brief.md`
2. `get_context_pack` with task profile (`hygiene`, `handoff`, `security`, …)
3. `scan_snippet` before every edit
4. `handoff_check` before claiming task complete
5. `scan_staged` → `gate_status` before PR

See [GETTING-STARTED.md](GETTING-STARTED.md) and [MCP-USER-SETUP.md](MCP-USER-SETUP.md).
