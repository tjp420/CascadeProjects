# SimpleBeacon AI Operator Spec

**Status:** Draft — 2026-08-31
**Branch:** `fix/lighthouse-a11y-fixes`
**Author:** Product engineering
**Companion docs:** [Roadmap](./ai-operator-roadmap.md) · [Pitch](../marketing/ai-operator-pitch.md)

---

## 1. Purpose

SimpleBeacon today is a 33-tool MCP server that scans AI-generated code for failure patterns. It works, it ships, and it has a real pre-edit gate. But it is framed as a *scanner with verification features*, not as an *operator layer*.

This spec defines the re-architecture that turns SimpleBeacon into the **control plane between an AI agent and the codebase** — the equivalent of what `git`, `lint`, `diff`, and `CI` are to a human power user, but bounded by policy, audit trails, and reversible actions.

The product framing is **not** "AI security scanner." It is:

> The command center for AI-generated code quality, policy compliance, and safe autonomous remediation.

The mental model:

```
AI is the actor
SimpleBeacon is the control plane
Git, diff, policy, scans, and security gates are the safety rails
```

---

## 2. Design principles

These six principles are the contract. Every feature in this spec must serve at least one.

### 2.1 Operate on evidence, not vibes

AI must make decisions on structured evidence — findings, severity, affected files, policy state — not on "looks risky."

**Surfaced evidence:** findings by severity, affected files and lines, risk score, compliance impact, change surface, confidence level.

**Anti-pattern:** "this change seems unsafe." **Required pattern:** "this change violates policy `production-safe` rule `protected-path` on `worker-deploy/src/worker.js`."

### 2.2 Explicit operational modes

A power user switches between read-only analysis, patch generation, auto-fix, and review. An AI agent must do the same — explicitly, not by accident.

**Modes:** `safe`, `review`, `autonomous`, `emergency`. See §4.

### 2.3 Be expensive where it matters

Power users don't run broad commands unless they need them. SimpleBeacon must support targeted scans, incremental analysis, cached results, and severity-based triage. Deep analysis runs on changed files only.

### 2.4 Default to explainability

Every action must answer: why did this happen, what changed, what policy was breached, what is the fix. See §7 (Action ledger) and §8 (Risk score).

### 2.5 Force review before risky actions

No broad repo edits without summary. No secrets or production config changes without explicit exception. No removal of guardrails without human review. No mutation outside allowed paths. See §5 (Policy packs) and §6 (Approval gates).

### 2.6 Build around operational workflows, not chat

The winning pattern is not "chat with the repo." It is: analyze → identify risk → propose fix → validate → summarize → save evidence. See §9 (Workspace view).

---

## 3. Current state — what already ships

These capabilities exist in the canonical branch today and are the foundation the operator model builds on. The spec extends them; it does not replace them.

| Capability | Existing tool(s) | File |
|---|---|---|
| Pre-write verification gate | `verify_before_write` | `src/mcp/handlers/agent-verify-handlers.js` |
| Completion verification | `verify_completion` | `src/mcp/handlers/agent-verify-handlers.js` |
| Real-time file monitoring | `watch_project` | `src/mcp/realtime-watcher.js` |
| Targeted scans (snippet / file / staged / project) | `scan_snippet`, `scan_file`, `scan_staged`, `scan_project` | `src/mcp/handlers/scan-handlers.js` |
| Gate state | `gate_status` | `src/mcp/handlers/gate-handlers.js` |
| Session briefing | `supercharge_agent` | `src/lib/agent-supercharge.js` |
| Patch proposal + verification | `propose_fix`, `verify_fix` | `src/mcp/handlers/fix-handlers.js` |
| Action plan + remediation | `get_action_plan`, `suggest_fixes`, `code_suggestions` | `src/lib/agent-supercharge.js` |
| Failure tracking | `get_failure_log`, `get_improvement_signals`, `log_validation_run`, `get_validation_history` | `src/lib/failure-log.js`, `src/lib/improvement-signals.js`, `src/lib/validation-runs.js` |
| Handoff gate | `handoff_check` | `src/mcp/handlers/handoff-handlers.js` |
| PDA modes (handoff / security / gamedev) | `supercharge_agent` with `task` param | `src/lib/agent-task-profiles.js` |
| Rule explanation | `explain_finding` | `src/mcp/handlers/explain-handlers.js` |
| Problem solving + error diagnosis | `solve_problem`, `diagnose_error` | `src/mcp/handlers/solve-handlers.js` |
| Tier-based tool gating | `TOOL_CATEGORIES` in `tools.js` | `src/mcp/tools.js` |

**What does not exist today:** operational modes (§4), policy packs (§5), approval gates (§6), action ledger (§7), risk score (§8), workspace view (§9), dry-run/revert loop (§10).

---

## 4. Operational modes

### 4.1 Concept

Modes are **orthogonal to tiers**. Tiers are billing — what you've paid for. Modes are operational posture — what the agent is allowed to do this session.

A Free user in `autonomous` mode is still bounded by tier (cannot call `scan_file`). A Developer user in `safe` mode is still bounded by mode (cannot call `propose_fix` even though their tier allows it).

### 4.2 Mode definitions

| Mode | Posture | Allowed tool calls | Writes | Auto-fix | Production paths |
|---|---|---|---|---|---|
| `safe` | Read-only analysis | All scan, gate, explain, plan, log, and status tools | None | None | None |
| `review` | Propose, don't apply | Everything in `safe` + `propose_fix`, `verify_fix` (dry-run only), `watch_project` | None (patches are previewed, not applied) | None | None |
| `autonomous` | Apply under policy | Everything in `review` + `verify_fix` (applies patches), bounded by policy pack | Allowed within policy | Bounded by `maxAutoFixesPerSession` | Blocked unless policy allows |
| `emergency` | Repair known patterns with rollback | Everything in `autonomous` + `revert_fix`, can touch production paths under explicit emergency policy | Allowed including production paths under emergency policy | Bounded by emergency policy | Allowed under emergency policy, time-boxed |

### 4.3 Mode selection

Modes are selected at session start via `supercharge_agent`:

```json
{
  "mode": "review",
  "policyPack": "production-safe"
}
```

If no mode is specified, the default is `safe`. The mode is recorded in every subsequent action ledger entry (§7).

### 4.4 Mode transitions

Modes can only escalate, not de-escalate, within a session — `safe → review → autonomous → emergency`. To drop to a lower mode, the agent must start a new session. This prevents an agent from quietly dropping into `autonomous` mode after being told to operate in `safe`.

Mode transitions are logged in the action ledger with `action: "mode-transition"`.

### 4.5 Tool gating implementation

The existing `TOOL_CATEGORIES` map in `src/mcp/tools.js` gates by tier. The mode system adds a second gate: a `MODE_ALLOWED_TOOLS` map that lists which tools each mode permits. A tool call is allowed only if **both** the tier and the mode permit it.

```js
const MODE_ALLOWED_TOOLS = {
  safe: ['supercharge_agent', 'scan_snippet', 'scan_file', 'scan_staged',
         'scan_project', 'gate_status', 'explain_finding', 'get_action_plan',
         'get_failure_log', 'get_improvement_signals', 'log_validation_run',
         'get_validation_history', 'diagnose_error', 'solve_problem',
         'handoff_check', 'install_agent_plugin'],
  review: ['/* safe */', 'propose_fix', 'verify_fix', 'watch_project'],
  autonomous: ['/* review */', 'verify_fix:apply'],
  emergency: ['/* autonomous */', 'revert_fix']
};
```

`verify_fix:apply` notation indicates that `verify_fix` in `autonomous` mode may apply patches, while in `review` mode it only previews them.

---

## 5. Policy packs

### 5.1 Concept

Policy packs are the declarative rules that bound what an agent may do in `autonomous` and `emergency` modes. They are distinct from scan profiles (which select *what to scan*) and from modes (which select *how much autonomy the agent has*).

A policy pack says: "these paths are protected, these patterns are forbidden, this many auto-fixes are allowed per session, these severities require approval."

### 5.2 Schema

`.simplebeacon/policy.json`:

```json
{
  "name": "production-safe",
  "description": "Default policy for production-adjacent repos",
  "version": 1,
  "protectedPaths": [
    "*.env*",
    "worker-deploy/*",
    "sales/*",
    ".github/workflows/*",
    "ai-platform/server/config/*"
  ],
  "maxAutoFixesPerSession": 5,
  "requireApprovalAbove": "medium",
  "forbiddenPatterns": [
    "sk_live_*",
    "re_*",
    "DASHBOARD_VAULT_PASSWORD"
  ],
  "allowedScanners": [
    "swallowed-exception",
    "phantom-api",
    "hallucinated-import",
    "secrets",
    "slop",
    "ai-fiction-kpi"
  ],
  "requireGatePassBefore": ["commit", "push", "pr"],
  "revertWindowHours": 24,
  "emergencyContacts": []
}
```

### 5.3 Built-in policy packs

| Pack | Purpose | `maxAutoFixesPerSession` | `requireApprovalAbove` | Production paths |
|---|---|---|---|---|
| `secure-defaults` | Applied when no policy specified | 3 | high | Blocked |
| `production-safe` | Default for production-adjacent repos | 5 | medium | Blocked |
| `compliance` | EU AI Act + audit trail required | 0 | low | Blocked, all actions logged with extra fields |
| `experimental` | Relaxed for sandbox/dev repos | 20 | critical | Allowed with warning |
| `org-specific` | User-defined, loaded from `.simplebeacon/policy.json` | User-set | User-set | User-set |

### 5.4 Policy enforcement points

Policy is enforced at four points:

1. **Pre-write** (`verify_before_write`) — rejects writes to `protectedPaths` unless mode is `emergency` and emergency policy allows.
2. **Pre-fix** (`propose_fix` / `verify_fix`) — counts auto-fixes against `maxAutoFixesPerSession`; blocks when limit reached.
3. **Pre-commit** (existing pre-commit hook) — enforces `requireGatePassBefore: ["commit"]`.
4. **Pre-push** (existing pre-push hook) — enforces `requireGatePassBefore: ["push"]`.

### 5.5 Relationship to existing config

`.simplebeacon/config.json` (existing) controls *scanner behavior* — allowlists, ignore globs, profile selection. `.simplebeacon/policy.json` (new) controls *agent behavior* — protected paths, auto-fix limits, approval thresholds. They are intentionally separate files so scanner tuning and agent policy don't collide.

---

## 6. Approval gates

### 6.1 Concept

When a proposed action exceeds the policy pack's `requireApprovalAbove` threshold or touches a protected path, the agent must request approval. Approval is a first-class MCP interaction, not a chat message.

### 6.2 Approval tool

New tool: `request_approval`

```json
{
  "action": "apply-fix",
  "target": "src/api/handler.ts",
  "riskScore": 0.6,
  "reason": "severity high exceeds threshold medium",
  "policyPack": "production-safe",
  "patchPreview": "..."
}
```

Returns:

```json
{
  "approved": false,
  "reason": "human review required for high-severity changes",
  "reviewer": "user@example.com",
  "expiresAt": "2026-09-01T00:00:00Z"
}
```

### 6.3 Escalation matrix

| Condition | Mode | Action |
|---|---|---|
| Risk score < 0.2 | any | Auto-apply (if mode allows) |
| Risk score 0.2–0.5 | autonomous | Apply with ledger entry |
| Risk score 0.2–0.5 | review | Require approval |
| Risk score ≥ 0.5 | any | Require approval |
| Protected path touched | autonomous | Require approval |
| Protected path touched | emergency | Apply with ledger entry, time-boxed revert window |
| Forbidden pattern detected | any | Block, no override |
| Confidence low | any | Require approval |

---

## 7. Action ledger

### 7.1 Concept

The existing `failure-log.json` records *failures*. The action ledger records *all agent actions* — proposed, allowed, blocked, applied, reverted. This is the audit trail that makes the operator trustworthy.

### 7.2 Schema

`.simplebeacon/action-ledger.json`:

```json
{
  "version": 1,
  "entries": [
    {
      "id": "uuid",
      "sessionId": "uuid",
      "timestamp": "2026-08-31T12:00:00Z",
      "mode": "review",
      "policyPack": "production-safe",
      "tool": "verify_before_write",
      "action": "propose-write",
      "target": "src/api/handler.ts",
      "outcome": "allowed" | "blocked" | "applied" | "reverted" | "approved" | "denied",
      "reason": "gate-passed" | "gate-blocking-file" | "policy-violation:protected-path" | "severity-threshold-exceeded" | "auto-fix-limit-reached",
      "riskScore": 0.2,
      "revertible": true,
      "revertedAt": null,
      "revertReason": null
    }
  ]
}
```

### 7.3 Storage

- File: `.simplebeacon/action-ledger.json`
- Capped at 500 entries (matches existing `.simplebeacon/` architecture)
- Append-only — entries are never deleted or modified except `revertedAt` and `revertReason` on revert
- Implementation: new `src/lib/action-ledger.js`, mirrors `failure-log.js` structure

### 7.4 New MCP tools

- `get_action_ledger` — returns recent entries, filterable by session, mode, outcome
- `revert_action` — marks an entry as reverted and attempts to revert the underlying change (only for entries with `revertible: true`)

---

## 8. Risk score

### 8.1 Concept

A single number in `[0, 1]` that summarizes the risk of a proposed change. Used by approval gates (§6) and surfaced in the workspace view (§9).

### 8.2 Formula

```
riskScore = clamp(
  blockingCount * 0.4 +
  highSeverityCount * 0.2 +
  protectedPathTouches * 0.25 +
  policyViolations * 0.15,
  0, 1
)
```

### 8.3 Interpretation

| Score | Band | Action |
|---|---|---|
| 0.0–0.2 | safe | Auto-apply if mode allows |
| 0.2–0.5 | review | Apply in autonomous mode with ledger; require approval in review mode |
| 0.5–0.8 | elevated | Require approval regardless of mode |
| 0.8–1.0 | critical | Emergency mode only, time-boxed revert window |

### 8.4 Implementation

- New `src/lib/risk-score.js`
- Surfaced in `verify_before_write` and `propose_fix` responses
- Stored in action ledger entries
- Not a separate MCP tool — it's a field on existing tool responses

---

## 9. Workspace view

### 9.1 Concept

A single low-noise surface that shows the agent (and the user) everything that matters about the repo right now. Not a chat. Not a dashboard with 20 widgets. A focused operational view.

### 9.2 Layout

```
Agent Workspace
===============

Repo health:     GATE PASS · 0 blocking · 3 warnings · quality 78/100
Active mode:     review · policy: production-safe · 2/5 auto-fixes used
Session:         4 actions · 0 reverted · last action 2m ago

Changed files (3):
  M  src/api/handler.ts        risk 0.3 · 1 high finding
  M  src/lib/utils.ts          risk 0.1 · clean
  A  src/api/new-endpoint.ts   risk 0.6 · 1 blocking · protected-path

Risk profile:
  blocking: 1    high: 1    medium: 2    low: 4
  change surface: 3 files, 47 lines added, 12 removed
  policy violations: 1 (protected-path touch on src/api/new-endpoint.ts)

Policy status:
  pack: production-safe
  protected paths: 5 patterns
  auto-fixes remaining: 3
  require approval above: medium

Recent findings (top 3):
  HIGH   src/api/handler.ts:42    swallowed-exception    empty catch block
  MED    src/api/handler.ts:18    phantom-api            JSON.tryParse does not exist
  LOW    src/lib/utils.ts:5       slop-placeholder       TODO: implement

Suggested next action:
  Fix HIGH finding on src/api/handler.ts:42 — propose_fix ready
  Request approval for src/api/new-endpoint.ts (protected path)
```

### 9.3 Data sources

| Section | Source |
|---|---|
| Repo health | `gate_status` + `scan_project` summary |
| Active mode + session | `supercharge_agent` mode/policy params + action ledger session filter |
| Changed files | `git diff --name-only` (already used by `scan_staged`) |
| Risk profile | Risk score (§8) per file + aggregate |
| Policy status | Active policy pack (§5) + auto-fix counter from action ledger |
| Recent findings | `get_failure_log` + `get_improvement_signals` |
| Suggested next action | `get_action_plan` top item + approval queue |

### 9.4 New MCP tool

`get_workspace` — returns the structured JSON that renders the workspace view. Free tier (it's read-only). Agents call this at session start and after every meaningful action.

---

## 10. Dry-run and revert loop

### 10.1 Concept

`propose_fix` and `verify_fix` exist today, but there's no `dry_run: true` mode that shows the patch without applying, and no `revert_fix` that undoes a previous fix. The operator model requires both.

### 10.2 Dry-run

`verify_fix` gains a `dryRun: true` parameter:

```json
{
  "fixId": "fix-123",
  "dryRun": true
}
```

Returns the patch preview without applying. Always allowed in `review` mode. In `autonomous` mode, `dryRun: false` is allowed but goes through the approval gate if risk score ≥ threshold.

### 10.3 Revert

New tool: `revert_fix`

```json
{
  "actionId": "uuid-from-ledger"
}
```

- Looks up the action in the ledger
- If `revertible: true` and within `revertWindowHours`, attempts to revert the change
- Records `revertedAt` and `revertReason` in the ledger
- Only available in `autonomous` and `emergency` modes

---

## 11. Tool inventory after re-architecture

### 11.1 Existing tools (33) — unchanged

All 33 existing tools remain. Their behavior is extended, not replaced:

- `verify_before_write` — gains `riskScore` field, policy-pack enforcement
- `verify_completion` — gains action-ledger check (all actions resolved or reverted)
- `supercharge_agent` — gains `mode` and `policyPack` params
- `propose_fix` / `verify_fix` — gains `dryRun` param, policy-pack auto-fix counter
- `scan_staged` — gains risk-score aggregation in response

### 11.2 New tools (5)

| Tool | Mode | Tier | Purpose |
|---|---|---|---|
| `get_workspace` | all | free | Returns the workspace view JSON (§9) |
| `request_approval` | review, autonomous | free | Requests human approval for a risky action (§6) |
| `get_action_ledger` | all | free | Returns recent action ledger entries (§7) |
| `revert_fix` | autonomous, emergency | agent | Reverts a previous fix (§10) |
| `set_mode` | all | free | Transitions to a higher mode within a session (§4.4) |

**Total tool count after re-architecture: 38** (33 existing + 5 new).

### 11.3 TOOL_CATEGORIES extension

```js
// New tools added to TOOL_CATEGORIES
'get_workspace': { category: 'core', tier: 'free', marketed: true },
'request_approval': { category: 'core', tier: 'free', marketed: true },
'get_action_ledger': { category: 'supporting', tier: 'free', marketed: true },
'revert_fix': { category: 'paid', tier: 'agent', marketed: true },
'set_mode': { category: 'core', tier: 'free', marketed: true },
```

The three core tools that define SimpleBeacon's value become **five**: `verify_before_write`, `verify_completion`, `watch_project`, `get_workspace`, `set_mode`.

---

## 12. Non-goals

- **Not building a chatbot.** The operator model is a toolchain, not a conversation.
- **Not replacing the existing tier system.** Modes are orthogonal to tiers.
- **Not replacing scan profiles.** Policy packs are orthogonal to scan profiles.
- **Not requiring SQLite.** All new state lives in capped JSON files in `.simplebeacon/`, matching the existing architecture.
- **Not uploading source code.** All scans remain local.
- **Not auto-deploying.** The operator gates actions; it does not push to production.
- **Not breaking existing tools.** All 33 tools keep their current signatures; new fields are additive.

---

## 13. Open questions

1. **Mode persistence** — should mode carry across sessions, or reset to `safe` on every new session? Default: reset to `safe`.
2. **Policy pack inheritance** — should nested workspaces inherit parent policy packs? Default: yes, with explicit override.
3. **Approval timeout** — what happens when an approval request is neither granted nor denied? Default: expires after 24h, action is treated as denied.
4. **Emergency mode activation** — who can activate emergency mode? Default: requires explicit `emergency: true` param to `set_mode` plus a reason string, logged to ledger.
5. **Risk score weights** — the formula in §8.2 is a starting point. Weights should be tuned against real failure data from `improvement-signals.json`.

---

## 14. References

- Existing tool definitions: `packages/simplebeacon-cli/src/mcp/tools.js`
- Existing tier gating: `packages/simplebeacon-cli/src/lib/agent-tier-capabilities.js`
- Existing PDA modes: `packages/simplebeacon-cli/src/lib/agent-task-profiles.js`
- Existing failure tracking: `packages/simplebeacon-cli/src/lib/failure-log.js`
- Existing pre-edit gate: `packages/simplebeacon-cli/src/mcp/handlers/agent-verify-handlers.js`
- Existing scan profiles: `packages/simplebeacon-cli/src/scan.js`
- Roadmap: [./ai-operator-roadmap.md](./ai-operator-roadmap.md)
- Pitch: [../marketing/ai-operator-pitch.md](../marketing/ai-operator-pitch.md)
