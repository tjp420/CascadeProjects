# SimpleBeacon scan pipeline

Local, deterministic processing — no LLM reads your source.

## Lifecycle

```
Target directory
       │
       ▼
File discovery & filter (skip node_modules, .git, venv, binaries, >512KB text)
       │
       ▼
┌──────────────────────────────────────┐
│ Rule engines (config.rules toggles)   │
│  • Regex passes (JS/TS/JSON/config)  │
│  • Python AST sidecar (.py)          │
│  • JavaScript AST (@babel/parser)    │
└──────────────────────────────────────┘
       │
       ▼
Structured aggregator → rawIssues + gate + scanScope
       │
   ┌───┴───┐
   ▼       ▼
 CLI     MCP JSON (scan_snippet, scan_file, gate_status)
```

## Orchestration modules

| Module | Role |
|--------|------|
| `src/scan.js` | Main CLI scan entry |
| `src/lib/full-directory-scanner.js` | Full-tree walk + hash + text rules |
| `src/lib/full-tree-scan-pool.js` | Optional `worker_threads` for text rules (≥48 files) |
| `src/lib/scan-orchestrator.js` | Composed full-tree + AST sidecars |
| `src/lib/python-ast-scanner.js` | Python 3 AST subprocess |
| `src/lib/javascript-ast-scanner.js` | Babel AST in-process |

## Parallel workers

Enabled when content-scanned files ≥ `SIMPLEBEACON_PARALLEL_MIN_FILES` (default 48).

- `SIMPLEBEACON_PARALLEL=1` — force on (if file count threshold met)
- `SIMPLEBEACON_PARALLEL=0` — force off
- `SIMPLEBEACON_PARALLEL_MAX_WORKERS` — cap (default 8)

Disk I/O stays on the main thread; workers only run `runTextRulePasses`.

## Opt-in AI hygiene rules

| Config key | Default | Notes |
|------------|---------|--------|
| `token-bleed-patterns` | off | Regex `SB-TB-001`–`005` |
| `architecture-drift-patterns` | off | Hybrid models without validators (high) |
| `python-ast-patterns` | off | Requires Python 3 |
| `javascript-ast-patterns` | off | `@babel/parser` bundled |

## CI

- Baseline gate: `examples/github-action/simplebeacon-gate.yml`
- Opt-in AI packs: `examples/github-action/simplebeacon-ai-hygiene-gate.yml`

Run from the **product repo root** (directory containing `.simplebeacon/config.json`).
