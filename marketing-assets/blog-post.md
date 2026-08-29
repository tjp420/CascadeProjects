# Why Your AI Coding Agent Is Burning Money — And How to Stop It

*How SimpleBeacon's 48 MCP tools, token-sipping Semantic Lighthouse, and deterministic compliance gate cut agent tool calls by 75% while catching the mistakes agents make most.*

---

## The problem nobody is talking about

AI coding agents are incredible. They write code at superhuman speed, run tests, read errors, and iterate. But they have a dirty secret: **they burn tokens like a bonfire**.

A typical agent session involves 30-40 tool calls. Each one sends context to an LLM. The agent reads files it doesn't need, searches for things it already found, and repeats mistakes because it lacks contextual memory. When it gets stuck in a hallucination loop — writing the same broken code three times because nobody told it the package doesn't exist — you pay for every single failed attempt.

The math is brutal:

| Approach | Tool calls | Rework calls | Total tokens burned |
|---|---|---|---|
| No guardrails | 30 | 8-12 | ~50K-80K |
| Verification only (scan after) | 40 | 8-12 | ~65K-100K |
| **Prevention + investigation (SimpleBeacon)** | **10** | **0-2** | **~15K-25K** |

Verification-only doesn't just fail to save tokens — it **increases** token consumption by 20-30% because you're adding scan calls on top of the same broken workflow.

The fix isn't more scanning after the fact. It's **front-loaded prevention** — give the agent deterministic guardrails before it writes a single line of code.

---

## Three layers, one tool

SimpleBeacon operates as three integrated layers that work together to make AI agents faster, cheaper, and safer.

### Layer 1: Agent infrastructure (the guardrails)

SimpleBeacon ships as an MCP server with **48 tools** that any AI agent can call natively — Cursor, Windsurf, Claude, Cline, GitHub Copilot, Aider, and Devin. No source code leaves your machine. Everything runs locally.

The **Exoskeleton** wraps every edit and commit with pre-scan and post-scan verification:

```
Agent wants to edit a file
  → exoskeleton_guard_edit(action=check) scans the new content
  → If verdict=blocked: agent gets structured JSON with the exact problem + fix hint
  → Agent fixes the code in its next thought cycle
  → exoskeleton_guard_edit(action=verify) confirms the fix
  → File is safe to write
```

The agent never writes secrets, fiction KPIs, mock paths, or LLM placeholder slop to disk — because the guardrail catches it **before** the edit is applied. The feedback is structured JSON, not prose:

```json
{
  "verdict": "blocked",
  "findings": [{
    "pattern": "hallucinated_dependency",
    "severity": "critical",
    "line": 42,
    "match": "npm-fake-kpi-tracker",
    "actionCode": "REMOVE_IMPORT",
    "fix": "Remove this import and use native fetch instead."
  }]
}
```

The agent reads this, auto-corrects, and tries again. No human intervention needed.

**Agent-specific rules** catch the mistakes agents make — not the mistakes humans make:

- **Hallucinated dependencies**: Flags packages that don't exist in npm/PyPI
- **Fiction KPIs**: Catches fabricated metrics in code (e.g., `users: 1250000` with no data source)
- **Mock paths in production**: Detects `mock-`, `test-`, `fixture-` paths in production code
- **Credential bleed**: Hard blocks on API keys, tokens, and secrets committed to repos
- **LLM placeholder slop**: Catches `TODO: implement this`, `// your code here`, `return null // placeholder`

### Layer 2: Token efficiency (the Semantic Lighthouse)

The newest layer is the **Semantic Lighthouse** — a token-sipping structural search engine that indexes your entire codebase into lightweight "beacons" (classes, functions, TODOs, signatures with line numbers).

Instead of reading a 10,000-token file to find one bug, the agent scans a 200-token beacon index using a cheap model, locates the exact `file:line` coordinate, then activates deep retrieval only on the 20-line window surrounding the target.

**Measured results from the SimpleBeacon CLI codebase:**

```
Files indexed: 336
Total beacons: 5,158
Raw file tokens: 836,681
Beacon tokens: 42,873
Token reduction: 94.88%
```

The agent navigates the entire codebase inside a single context window without filling it up — preserving memory for actual engineering work.

**The full token-saving toolkit:**

- `simplebeacon summarize` — Per-file summaries + repo index (replaces reading whole files)
- `simplebeacon embed` — Offline TF-IDF embeddings for semantic search
- `simplebeacon search` — Retrieve top-K matching passages without an LLM
- `simplebeacon beacon` — Structural beacon index for token-sipping navigation
- `simplebeacon telemetry` — Local token-usage ROI dashboard

All offline. All deterministic. No source upload. No LLM calls.

### Layer 3: Compliance & audit (the evidence)

When regulators come knocking — and with the EU AI Act now in force, they will — you need evidence, not promises.

SimpleBeacon generates **board-ready compliance documentation** from the same scans that guard your agents:

- **EU AI Act mapping**: Article 5 prohibited practices, Article 10 transparency requirements, conformity assessment gaps
- **SOC 2 Type II evidence**: Change management controls, access reviews, security scanning records
- **48-analyzer AI Problem Analyzer Suite**: Risk classification across security, privacy, AI safety, and operational dimensions
- **Board-ready certificates**: Sovereign compliance certificates with cryptographic IDs, generated locally
- **CI/CD gate enforcement**: `simplebeacon scan --gate` blocks merges on critical/high findings

The same gate that prevents your agent from committing a hallucinated package also produces the audit trail your compliance team needs. One tool, two outcomes.

---

## How it works in practice

### Session start (1 call)
```
supercharge_agent() → gate state, top issues, code suggestions, next mission
```
Replaces 5-15 exploratory tool calls with one compressed payload.

### Before every edit (1 call per edit)
```
scan_snippet(content) → verdict + findings + fix hints
```
Prevents 3-5 rework calls per edit. The agent fixes issues before writing to disk.

### On crash (1 call)
```
diagnose_error(stackTrace) → root cause + likely file + fix template
```
Replaces 4-8 debugging calls with one deterministic diagnosis.

### Before commit (1 call)
```
exoskeleton_guard_commit() → scans all staged files, returns safe/blocked/warning
```
Prevents bad commits from shipping. Stores commit memory for the next session.

### Before claiming done (1 call)
```
handoff_check() → ready=true/false + handoff brief for next session
```
One false "done" claim costs more tokens than 10 handoff_check calls.

**Total for a typical 30-tool-call session: 10-12 calls instead of 38-52.**

---

## Who is this for?

**AI agent developers** using Cursor, Windsurf, Claude, Cline, Copilot, or Aider who want their agents to write better code faster without burning premium tokens on rework loops.

**Engineering teams** building with LLMs who need deterministic guardrails against AI-generated slop — fiction KPIs, hallucinated packages, mock paths, and credential leaks.

**Compliance teams** in regulated industries (fintech, healthcare, government) who need audit evidence for AI-generated code under EU AI Act, SOC 2, and emerging regulatory frameworks.

**Solo developers and small teams** who can't afford to burn $50-100 in LLM tokens per agent session on rework that deterministic rules could prevent for free.

---

## Get started in 60 seconds

```bash
# Install and initialize
npx simplebeacon init --starter

# Scan your project
npx simplebeacon scan --gate

# Generate a beacon index for token-sipping search
npx simplebeacon beacon --path .

# Find any target without reading full files
npx simplebeacon beacon --query "refund bug fixme" --k 10
```

For MCP integration with your AI agent:

```bash
# Install MCP config + CI gate for your project
npx simplebeacon init --starter --with-mcp
```

Sets up .cursor/mcp.json for Cursor. For other agents, see the docs.

---

## Pricing

- **Developer**: $49/mo — unlimited scans, CI gate, 48 analyzers, all MCP tools
- **Team Pro**: $149/mo — EU AI Act mapping, SOC 2, board-ready certificates, 5 seats
- **Enterprise**: Custom — air-gapped, SSO/SAML, dedicated analyst
- **Free**: Community tier — local scans, no upload, forever

[See full pricing →](https://simplebeacon.ai/pricing)

---

*SimpleBeacon: Stop your autonomous agents from burning tokens on hallucination loops. 48 MCP tools, 94.88% token reduction, deterministic compliance evidence — all local, all offline, no source upload.*

[Get started free →](https://simplebeacon.ai)
