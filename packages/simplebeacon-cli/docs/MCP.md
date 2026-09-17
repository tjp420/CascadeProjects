# Simplebeacon MCP Server

Local **Model Context Protocol** integration for Cursor, Claude Desktop, and other MCP clients. Scans run on your machine — **no source upload**.

## Tools

Default Cursor profile (**slim**) lists five tools so unused schemas are not paid every turn:

| Tool              | Purpose                                              |
| ----------------- | ---------------------------------------------------- |
| `scan_file`       | One saved scannable file                             |
| `scan_snippet`    | Unpublished paste only                               |
| `gate_status`     | Latest report gate + findings                        |
| `explain_finding` | Rule metadata for a pattern id                       |
| `simplebeacon_workspace_context` | Workspace preflight: files, symbols, imports, blockers |

`suggest_fixes` and `get_action_plan` are **full** profile only (`--full-tools` / `SIMPLEBEACON_MCP_PROFILE=full`).

Full catalog (`scan_project`, marketing, analyzers, compliance, init, `list_rulesets`, deployment) stays available with `--full-tools` or `SIMPLEBEACON_MCP_PROFILE=full`. Do not use `scan_project` mid-edit.

Skip Doom/ZScript/MODELDEF/meshes/textures — empty catalog, full payload cost.

## Quick start (Cursor)

**Users (any repo):**

```bash
npm install -D simplebeacon
npx simplebeacon init --with-mcp
```

Reload Cursor → enable **simplebeacon** in MCP settings. Full guide: [MCP-USER-SETUP.md](./MCP-USER-SETUP.md).

**Manual config** — copy [examples/mcp/cursor-standard.mcp.json](../examples/mcp/cursor-standard.mcp.json) to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "simplebeacon": {
      "command": "node",
      "args": [
        "packages/simplebeacon-cli/bin/simplebeacon-mcp.js",
        "--offline"
      ],
      "env": {
        "SIMPLEBEACON_PROJECT_ROOT": "/absolute/path/to/your/repo",
        "SIMPLEBEACON_OFFLINE": "1"
      }
    }
  }
}
```

From monorepo root:

```bash
node packages/simplebeacon-cli/bin/simplebeacon-mcp.js --offline
```

**Terminal looks frozen?** That is normal. Stdio MCP servers wait for JSON-RPC from Cursor — they do not print a prompt. To verify locally:

```bash
npm run test:mcp          # smoke test + integration tests (from ai-platform/)
node packages/simplebeacon-cli/bin/simplebeacon-mcp.js --smoke-test
```

Do **not** run `simplebeacon:mcp` manually unless debugging — let Cursor launch it via `.cursor/mcp.json`.

## Workflow during development

Local only, no source upload:

| When | Action |
| ---- | ------ |
| **Saved scannable file** | MCP **`scan_file` once**. Not `scan_snippet`. |
| **Unpublished paste** | MCP **`scan_snippet` only**. |
| **Doom / meshes / textures / unknown types** | Do not call SimpleBeacon. |
| **Before PR** | `npx simplebeacon scan --gate --offline` then MCP **`gate_status`**. |

Cursor: enable MCP via [`.cursor/mcp.json`](../../.cursor/mcp.json). Agent rules: [`.cursor/rules/simplebeacon-scan-workflow.mdc`](../../.cursor/rules/simplebeacon-scan-workflow.mdc) and [`.cursor/rules/simplebeacon-scannable-types.mdc`](../../.cursor/rules/simplebeacon-scannable-types.mdc).

CLI **`--gate`** remains the **source of truth** for CI.

## Tokens — Payload Avoidance

SimpleBeacon does not alter Cursor’s native context, strip imports, or compress LLM payloads. The editor still sends its usual context.

Efficiency is **Payload Avoidance**: fewer MCP round-trips that would copy source or reports into the transcript. It is not a compression engine and not a session-start “PDA” briefing tool (those schemas are billed every turn).

1. **Unscannable paths** — do not call MCP on binaries, images, lockfiles, minified bundles, unknown extensions, or GZDoom/ZScript/MODELDEF/meshes/textures. The catalog cannot match; the tool result is still billed.
2. **Single pass** — after a file is on disk, `scan_file` once. Do not also call `scan_snippet` for the same patch. The MCP server does not block the second call; the agent must not make it.
3. **High-volume tools** — `scan_project`, `list_rulesets`, analyzer suite, and pasting `.simplebeacon/report.json` only when the user asks, or at commit/PR (`gate_status` / CLI `--gate`). Not mid-edit.

Forcing a full project scan or dumping a raw report into the chat uses **more** tokens than coding without SimpleBeacon.

Do not publish “X% saved” until you have traces from a real editor session. MCP invocation counts are a proxy, not Cursor’s billed tokens.

MCP tool results are compact JSON (no pretty-print), findings omit match snippets, `scan_file` skips binaries/minified/oversized files before a full read, and an in-process content-hash cache returns the prior finding list when the file bytes have not changed (5 minute TTL). That shrinks **tool-result** size. It does not shrink Cursor’s native context.

SimpleBeacon is a local safety and gate scanner. Any token savings are a side effect of this workflow, not a compression product.

## Environment

| Variable                    | Default         | Description                                    |
| --------------------------- | --------------- | ---------------------------------------------- |
| `SIMPLEBEACON_PROJECT_ROOT` | `process.cwd()` | Repo root for baseline + report paths          |
| `SIMPLEBEACON_OFFLINE`      | off             | Set `1` to fail if any outbound network occurs |

## Architecture

```
MCP client (Cursor)
  → stdio JSON-RPC
  → simplebeacon-mcp.js
  → snippet-scanner.js
  → existing rules (credentials, production-leak, fiction-kpi, llm-slop)
```

Zero additional npm dependencies — same engines as `simplebeacon scan` and `simplebeacon-proxy`.

## Honest limits

- Snippet scan does **not** replace a full repo walk (no cross-file consistency, no jest baseline)
- Regex rules produce false positives — tune `.simplebeacon/config.json`
- Not SOC2, not semantic AI review

See [TRUST.md](./TRUST.md) for privacy guarantees.
