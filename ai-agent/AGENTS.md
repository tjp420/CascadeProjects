# AI Agent — agent instructions

Deterministic local orchestrator for SimpleBeacon remediation workflows. Uses Ollama (`OLLAMA_BASE_URL`, `AGENT_MODEL`) and depends on `../ai-tools` for inline fix proposals.

## Package layout

| File | Role |
|------|------|
| `orchestrator.cjs` | Main entry — plan/execute loop against local model |
| `prompts.js` | Planning and verification prompts (ESM) |
| `report-analyzer.cjs` | Parses `.simplebeacon/report.json` |
| `consistency-score.cjs` | Report consistency scoring |
| `test/*.test.js` | Node built-in test runner |

**Verify:** `npm test` and `node -c orchestrator.cjs` after edits.

**Scope:** This package is ~25 source files. Do not refactor sibling monorepo packages (`marketing/`, `tools/`, `packages/`) unless the scan report paths are under `ai-agent/`.

---

## SimpleBeacon AI context (auto-generated from scan)

- **Project:** ai-agent
- **Gate:** PASS
- **Domain profile:** generic

### Before writing code

General software. Extend existing handlers inline; match file naming and module system already in the repo.

- Read agent-brief.md and ai-context.md before editing.
- Extend existing files — do not create parallel modules unless the scan report requires it.
- Never commit secrets, mock production paths, or hardcoded KPIs.
- Match the repo module system (require/import), naming (kebab-case files), and error-handling style.
- Fix gate-blocking (critical/high) findings before refactors or new features.
- When SimpleBeacon MCP is available: scan_snippet before apply, scan_file after save, gate_status before merge.

### Scan artifacts

- `.simplebeacon/agent-brief.md` — latest gate summary
- `.simplebeacon/ai-context.md` — full context for any AI assistant
- `.simplebeacon/report.json` — machine-readable findings + suggestedFixes

Run `npx simplebeacon scan --gate --offline` before PR merge.

---

## Regenerating scan artifacts

From the monorepo root (or this directory):

```bash
npx simplebeacon scan ai-agent --gate --offline --format json --output ai-agent/.simplebeacon/report.json
```

Or download a **Context Pack** from [simplebeacon.ai/audit](https://simplebeacon.ai/audit) and copy `.simplebeacon/*.md` into this folder.
