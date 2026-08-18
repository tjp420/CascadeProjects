# SimpleBeacon Pitch — The AI Operator Layer

**Status:** Draft — 2026-08-31
**Audience:** Sales, marketing, customer-facing engineering
**Companion docs:** [Spec](../product/ai-operator-spec.md) · [Roadmap](../product/ai-operator-roadmap.md)

---

## 1. The one-sentence pitch

> SimpleBeacon is the command center for AI-generated code quality, policy compliance, and safe autonomous remediation.

Not "AI security scanner." Not "AI assistant with a scan feature." **Command center.**

---

## 2. The problem

AI coding agents write code faster than projects can validate it. That's not a future problem — it's happening now. The failure modes are well-documented:

- **Swallowed exceptions** — silently discarded errors that crash production later
- **Phantom APIs** — hallucinated method calls on real libraries (`JSON.tryParse`, `fs.readFilePromise`)
- **Hallucinated imports** — modules that don't exist
- **LLM slop** — placeholder text, TODO boilerplate, "implement your business logic here"
- **Credential leaks** — real keys committed to git
- **Confident and wrong** — the agent claims the task is done; the tests fail

Today, the only guardrail is the agent's own judgment. That's not a guardrail. That's a hope.

---

## 3. The analogy

A serious developer doesn't write code and hope it works. They use:

- `git diff` to see what changed
- `lint` to catch mistakes
- `CI` to enforce quality gates
- `tests` to verify behavior
- `code review` to catch what automation misses

They feel **fast** because these tools give them precise, contextual feedback. They trust the tools because the tools are **deterministic, observable, and reversible**.

An AI agent should have the same — but with trust boundaries, audit trails, and bounded autonomy. SimpleBeacon is that layer.

---

## 4. The mental model

```
AI is the actor
SimpleBeacon is the control plane
Git, diff, policy, scans, and security gates are the safety rails
```

The AI proposes. SimpleBeacon checks. The data learns.

This is not "Ask the AI what it did." It is:

1. Here is the repo state
2. Here are the risky changes
3. Here's what the AI proposes
4. Here are the policies and approval gates
5. Run it in dry-run, then validate, then commit

---

## 5. What makes it a power-user tool

| Power-user trait | SimpleBeacon equivalent |
|---|---|
| Fast access to the right data | `supercharge_agent` returns mission, gate, code suggestions, host status, and a playbook in one call |
| Command-level control | 33 MCP tools today, 38 after the operator re-architecture — each with a precise purpose |
| Workflow automation | `watch_project` pushes findings in real time; pre-edit gate blocks bad writes automatically |
| Strong defaults | `secure-defaults` policy pack applied when no policy specified |
| Clear reason for every action | Every tool response includes reason codes, rule IDs, and affected files |
| Inspect, reject, retry, rollback | Action ledger records every action; `revert_fix` undoes within the revert window |
| High signal, low noise | Workspace view shows only what matters: blocking issues, risk profile, policy status |

---

## 6. The six principles (customer-facing)

### 6.1 Operate on evidence, not vibes

AI makes decisions on structured evidence — findings by severity, affected files and lines, risk score, policy state — not on "looks risky." Every action answers *which policy, which file, which line.*

### 6.2 Explicit operational modes

The agent switches between **safe** (read-only), **review** (propose, don't apply), **autonomous** (apply under policy), and **emergency** (repair with rollback). Modes are explicit, logged, and escalate-only within a session.

### 6.3 Expensive where it matters

Targeted scans by file, diff, or package. Incremental analysis. Severity-based triage. Deep analysis runs on changed files only. The agent doesn't brute-force the whole repo on every edit.

### 6.4 Default to explainability

Every action produces: why did this happen, what changed, what policy was breached, what is the fix. Reason codes, rule IDs, scoring explanation, affected diff lines, recommended remediation.

### 6.5 Force review before risky actions

Dry-run mode. Patch preview. Risk gating. Approval checkpoints. Revert capability. Action logs. No broad repo edits without summary. No secrets or production config changes without explicit exception.

### 6.6 Build around operational workflows, not chat

The pattern is: analyze → identify risk → propose fix → validate → summarize → save evidence. This is a professional toolchain, not a chatbot.

---

## 7. The competitive frame

| | AI security scanner | AI copilot | **SimpleBeacon (AI operator)** |
|---|---|---|---|
| Mental model | Scan → report | Chat → suggest | Analyze → gate → apply → verify → audit |
| Trust model | Read-only | Trusted to apply | Bounded by policy + audit trail |
| Reversibility | None | None | Revert within window |
| Policy enforcement | None | None | Protected paths, auto-fix limits, approval gates |
| Operational modes | None | None | Safe / review / autonomous / emergency |
| Audit trail | Scan report | Chat history | Action ledger (every action, every outcome) |
| Risk scoring | Severity buckets | None | Unified risk score [0, 1] with bands |
| Failure prevention | Post-hoc | None | Pre-edit gate blocks bad writes before they happen |

---

## 8. Pricing and modes

**Tiers** are billing — what you've paid for.
**Modes** are operational posture — what the agent is allowed to do this session.
They are orthogonal.

| Tier | Price | What you get |
|---|---|---|
| Free | $0 | `verify_before_write`, `verify_completion`, `watch_project`, `get_workspace`, `set_mode`, `request_approval`, `get_action_ledger`, `supercharge_agent`, `solve_problem`, `diagnose_error`, `install_agent_plugin`, 20 snippet scans/day |
| Agent | $25/mo | Everything in Free + `scan_file`, `propose_fix`, `verify_fix`, `agent_status`, `explain_finding`, `revert_fix`, unlimited scans |
| Developer | $49/mo | Everything in Agent + `scan_staged`, `get_action_plan`, `scan_project`, `gate_status`, `run_analyzer_suite` |

**Modes are free.** A Free user can operate in `autonomous` mode — they just can't call the paid tools that autonomous mode unlocks. A Developer user in `safe` mode can't apply fixes even though their tier allows it.

This is the right model because:
- Modes are about *safety posture*, not *capability*. Safety should be free.
- Tiers are about *capability*, not *safety posture*. Capability is what you pay for.
- A user should never be priced out of safe operation.

---

## 9. The product experience

### 9.1 Session start

The agent calls `supercharge_agent` with `{ mode: "review", policyPack: "production-safe" }` and gets back:

- Mission briefing
- Active mode and policy pack
- Gate state (pass/fail, blocking issues)
- Code suggestions for gate-blocking files
- Host status
- Recovery playbook
- Workspace view (repo health, changed files, risk profile, policy status, recent findings)

One call. Full context. No chat required.

### 9.2 Edit loop

1. Agent calls `verify_before_write` with proposed content
2. SimpleBeacon scans the content, checks the gate, checks the policy pack, calculates risk score
3. Response: `{ passed, riskScore, riskBand, gateBlocked, policyViolations, recommendedAction }`
4. If `passed: true`, the agent writes the file
5. Agent calls `scan_file` to verify the write
6. Findings are logged to the action ledger and failure log

### 9.3 Fix loop

1. Agent calls `propose_fix` for a finding
2. SimpleBeacon generates a patch, calculates risk score, checks auto-fix limit
3. Response: `{ patch, riskScore, riskBand, autoFixesRemaining, requiresApproval }`
4. If `requiresApproval: true`, agent calls `request_approval` with the patch preview
5. If approved (or if `requiresApproval: false` and mode is `autonomous`), agent calls `verify_fix` with `dryRun: false`
6. SimpleBeacon applies the patch, records to action ledger
7. If something goes wrong, agent calls `revert_fix` with the action ID

### 9.4 Completion

The agent calls `verify_completion` and gets:

- Gate pass: yes/no
- Test suite: pass/fail
- Build status: pass/fail
- Git cleanliness: clean/dirty
- Action ledger: all actions resolved or reverted
- `canClaimComplete: true|false`

No more "confident and wrong." The agent either has evidence of completion or it doesn't.

---

## 10. What ships today vs. what's coming

### Ships today (33 MCP tools)

- Pre-write verification gate (`verify_before_write`)
- Completion verification (`verify_completion`)
- Real-time file monitoring (`watch_project`)
- Targeted scans: snippet, file, staged, project
- Gate state and status
- Session briefing (`supercharge_agent`)
- Patch proposal and verification (`propose_fix`, `verify_fix`)
- Failure tracking and improvement signals
- Handoff gate (`handoff_check`)
- PDA modes: handoff, security, gamedev
- Problem solving and error diagnosis

### Coming (5 new tools, 7 phases)

- Operational modes: `safe`, `review`, `autonomous`, `emergency`
- Policy packs: `secure-defaults`, `production-safe`, `compliance`, `experimental`, `org-specific`
- Action ledger: every action recorded, revertible
- Risk score: unified [0, 1] with bands
- Approval gates: first-class MCP interaction
- Workspace view: one-call operational snapshot
- Dry-run and revert loop

See the [roadmap](../product/ai-operator-roadmap.md) for the phased delivery plan.

---

## 11. Customer outcomes

### For individual developers using AI agents

- AI writes code faster; SimpleBeacon catches what the AI gets wrong
- No more "the agent said it was done but the tests fail"
- No more credential leaks from AI-generated code
- No more placeholder text shipped to production

### For teams

- Policy packs enforce team standards on AI-generated code
- Action ledger provides audit trail for every AI action
- Approval gates catch risky changes before they ship
- Risk score triages what needs human review

### For enterprises

- Compliance pack enforces EU AI Act and audit requirements
- Protected paths prevent AI from touching production config
- Bounded autonomy prevents unbounded improvisation
- Revert capability makes AI actions reversible

---

## 12. The positioning statement

> SimpleBeacon is the command center for AI-generated code quality, policy compliance, and safe autonomous remediation.
>
> It is the operator layer between AI agents and the codebase — the equivalent of what `git`, `lint`, `diff`, and `CI` are to a human power user, but bounded by policy, audit trails, and reversible actions.
>
> Not "AI assistant with a scan feature." **AI operating system for safe code changes.**

---

## 13. References

- Spec: [../product/ai-operator-spec.md](../product/ai-operator-spec.md)
- Roadmap: [../product/ai-operator-roadmap.md](../product/ai-operator-roadmap.md)
- Existing tool definitions: `packages/simplebeacon-cli/src/mcp/tools.js`
- Production site: https://simplebeacon.ai
- CLI package: `simplebeacon` on npm
- VS Code extension: `SimpleBeacon — AI Coding Agent Verifier`
