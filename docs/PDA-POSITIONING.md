# SimpleBeacon Agent PDA — Positioning

## Plain English

SimpleBeacon's Agent PDA doesn't make AI smarter. It makes AI coding safer and more reliable.

## What it does for AI

- Gives the agent a memory of tasks and project context
- Keeps a clear record of what it is working on
- Ensures it checks policies before finalizing changes
- Enforces validation gates instead of trusting raw output

## What that means in practice

- Less "hallucinated fix" drift
- Less secret leakage
- Fewer accidental destructive actions
- More consistent task-to-output tracking
- Easier handoff between agents and humans

## The mental model

The PDA does not replace intelligence. It reduces the failure modes of AI coding by giving it structure, rules, and proof of compliance.

```
AI writes code
  → PDA remembers the task and policy constraints
    → gate validates the result
      → you get a traceable, safer workflow
```

It's a safety harness, not a shortcut.

## Why this matters for paying customers

The value isn't "AI does more." The value is "AI does less damage."

- **Developers** get fewer broken commits, fewer leaked secrets, fewer hallucinated fixes
- **Teams** get traceable agent workflows, policy enforcement, and handoff records
- **Compliance officers** get proof that AI-generated code passed a gate before merge

The PDA makes AI coding trustworthy enough to ship.

---

## Sales Assets

### Elevator Pitch (2 sentences)

SimpleBeacon gives AI coding agents a local-first safety harness — memory, task tracking, policy enforcement, and validation gates — so AI-generated code is safe, auditable, and deployable. The value isn't that AI writes more code faster; it's that AI does less damage, and you can prove it.

### Product Value Proposition (5 bullets)

- **Catch what AI gets wrong** — scans for leaked secrets, hallucinated paths, fiction KPIs, and LLM placeholder slop before code ships
- **Enforce your rules** — define policies in JSON; AI agents check them before finalizing changes, every time
- **Track what happened** — every agent session, task, memory, and handoff is recorded locally for full auditability
- **Gate the output** — validation gates block merges when critical or high-severity issues are found, no exceptions
- **No source upload** — everything runs locally on your machine or in your CI; your code never leaves your infrastructure

### Homepage Section — AI Slop Cop

```html
<section class="slop-cop-hero">
  <h2>AI Slop Cop for VS Code</h2>
  <p class="subhead">Scan your workspace locally, surface repo issues, gate quality, and export reports — no source upload.</p>

  <div class="value-grid">
    <div class="value-card">
      <h3>Catch AI mistakes before they ship</h3>
      <p>Leaked secrets, hallucinated paths, fiction KPIs, LLM placeholder slop — caught locally, before merge.</p>
    </div>
    <div class="value-card">
      <h3>Enforce your policies</h3>
      <p>Define rules in JSON. AI agents check them before finalizing. Force-push, secret commits, deploys — blocked by default.</p>
    </div>
    <div class="value-card">
      <h3>Track every agent action</h3>
      <p>Memory, tasks, handoffs, and gate results — all recorded locally. Full audit trail for every AI-generated change.</p>
    </div>
    <div class="value-card">
      <h3>Gate the output</h3>
      <p>Validation gates block merges when critical issues are found. No bypass, no soft-warn, no "trust the AI."</p>
    </div>
  </div>

  <div class="cta-row">
    <a class="cta-primary" href="#install">Install for VS Code</a>
    <a class="cta-secondary" href="#demo">Try the browser demo</a>
  </div>

  <p class="positioning-statement">
    The value isn't that AI writes more code faster.<br>
    It's that AI does less damage — and you can prove it.
  </p>
</section>
```

---

## Pricing Narrative

### The story you tell before showing the price

Your team adopted AI coding tools six months ago. Velocity went up. So did broken commits, leaked secrets, hallucinated fixes, and time spent reviewing AI output that looked right but wasn't.

You don't need more AI speed. You need AI accountability.

SimpleBeacon gives you that accountability for $49/developer/month. It runs locally — your code never leaves your machine. It catches the failure modes that AI tools introduce: leaked credentials, fiction KPIs, mock paths in production, LLM placeholder slop. It enforces your policies before AI agents can finalize changes. It gates merges when critical issues are found. And it records everything — every task, every memory, every handoff, every gate result — so you can prove what was checked and when.

The question isn't whether you can afford to add AI guardrails. It's whether you can afford not to.

### Tier framing

| Tier | Price | Who it's for | What they get |
|------|-------|-------------|---------------|
| Developer | $49/mo | Individual devs using AI tools | Local scanner, gate, PDA, 48 analyzers, VS Code extension |
| Team Pro | $149/mo/5 seats | Teams with multiple AI agents | Everything in Developer + shared policies, handoff records, EU AI Act compliance, SOC 2 reports |
| Enterprise | Custom | Regulated industries, high-trust environments | Air-gapped deployment, SSO/SAML, dedicated analyst, custom rules, audit trail export |

### Why each tier is priced where it is

- **Developer ($49)**: Priced below the cost of one broken commit reaching production. One caught secret leak or one blocked hallucinated fix pays for a year. The value is damage prevented, not features unlocked.
- **Team Pro ($149/5 seats)**: Priced at the cost of one incident postmortem. Shared policies and handoff records mean the team operates as one unit, not five independent agents doing whatever they want. The compliance reports (EU AI Act, SOC 2) are the deliverable that justifies the upgrade.
- **Enterprise (custom)**: Priced against the cost of a compliance failure or audit finding. Air-gapped deployment, SSO, and custom rules are table stakes for regulated environments. The audit trail is the product.

---

## Landing Page Headline Hierarchy

### H1 (hero)
**AI Slop Cop for VS Code**
*Scan your workspace locally, surface repo issues, gate quality, and export reports — no source upload.*

### H2 (value proposition)
**The value isn't that AI writes more code faster. It's that AI does less damage.**

### H3 (feature pillars)

#### Catch what AI gets wrong
Leaked secrets. Hallucinated paths. Fiction KPIs. LLM placeholder slop. 48 analyzers, zero source upload.

#### Enforce your rules
Define policies in JSON. AI agents check them before finalizing. Force-push, secret commits, unapproved deploys — blocked by default.

#### Track every agent action
Memory, tasks, handoffs, and gate results — all recorded locally. Full audit trail for every AI-generated change.

#### Gate the output
Validation gates block merges when critical or high-severity issues are found. No bypass. No soft-warn. No "trust the AI."

#### Ship with confidence
Your code stays on your machine. Your policies stay in your repo. Your audit trail stays in your control.

### Supporting headlines (for sections)

- **"Stop reviewing AI output line by line. Let the gate do it."**
- **"Every AI commit, checked. Every policy, enforced. Every action, recorded."**
- **"The safety harness for AI coding — not the autopilot."**
- **"Local-first. Source-never-uploaded. Gate-always-on."**

### CTA hierarchy

1. **Primary**: Install for VS Code (free scan, upgrade for gate + PDA)
2. **Secondary**: Try the browser demo (no install, see it work)
3. **Tertiary**: See pricing (Developer $49, Team Pro $149, Enterprise custom)

---

## Sales One-Pager

### SimpleBeacon AI Slop Cop
**The safety harness for AI coding.**

---

**The problem**

AI coding tools write code fast. They also leak secrets, hallucinate fixes, invent KPIs, leave placeholder slop, and push broken changes. Teams spend more time reviewing AI output than they saved generating it.

**The solution**

SimpleBeacon runs locally on your machine or in your CI. It scans AI-generated code for the failure modes that AI tools introduce. It enforces your policies before agents can finalize changes. It gates merges when critical issues are found. And it records everything for auditability.

**How it works**

```
AI agent writes code
  → SimpleBeacon scans locally (48 analyzers, zero upload)
    → PDA checks policies and tracks the task
      → Gate blocks merge if critical/high issues found
        → You ship with proof of compliance
```

**What you get**

- **48 analyzers** — credentials, production leaks, LLM slop, fiction KPIs, security patterns, EU AI Act, and more
- **Agent PDA** — memory, task tracking, policy enforcement, handoff records, validation gates
- **VS Code extension** — scan, review, remediate, and gate without leaving your editor
- **CI gate** — block PRs with critical/high findings, no `--no-verify` bypass
- **Compliance reports** — EU AI Act, SOC 2, board-ready certificates
- **Local-first** — your code never leaves your infrastructure

**Pricing**

| Tier | Price | Best for |
|------|-------|----------|
| Developer | $49/mo | Individual devs using AI tools |
| Team Pro | $149/mo (5 seats) | Teams with multiple AI agents |
| Enterprise | Custom | Regulated industries, air-gapped deployments |

**The bottom line**

The value isn't that AI writes more code faster. It's that AI does less damage — and you can prove it.

**Get started**: Install the VS Code extension or run `npx simplebeacon init --starter`

---

## Positioning Assets Index

| Asset | Location | Use case |
|-------|----------|----------|
| **Killer sentences** | Below | Homepage hero + sales deck |
| Elevator pitch | "Sales Assets" section | Quick verbal pitch, email intro |
| Value proposition (5 bullets) | "Sales Assets" section | Sales deck, product page |
| Homepage HTML | "Sales Assets" section | Drop into coming-soon/public |
| Pricing narrative | "Pricing Narrative" section | Sales calls, pricing page |
| Headline hierarchy | "Landing Page" section | Homepage, product page, ads |
| Sales one-pager | "Sales One-Pager" section | PDF export, leave-behind, email attachment |
| How it works | "How It Works" section | Product website, onboarding |
| Architecture blurb | "Architecture Blurb" section | Developer docs, internal design notes |
| Landing page diagram | "Landing Page Diagram" section | Product website |
| Architecture: Sidebar vs Engine | "Architecture" section | Internal docs, investor deck |
| Positioning line | Throughout | "The value isn't that AI writes more code faster. It's that AI does less damage." |

---

## Killer Sentences

### Landing page (homepage hero)
> **AI Slop Cop is the enforcement layer that keeps AI coding safe, traceable, and ship-ready.**

### Sales deck (investor / enterprise pitch)
> **The PDA turns AI from a black box into a governable workflow.**

### Why these work

The first sentence tells a buyer *what it is* and *what they get* — enforcement, safety, traceability, ship-readiness. It's concrete and actionable.

The second sentence tells a decision-maker *why it matters* — AI goes from ungovernable to governable. It reframes the problem from "AI productivity" to "AI accountability," which is the thing organizations actually need to buy.

Both anchor on the same core message: **the agent is subject to the rules, not the other way around.**

---

## Proof of Operation

*Verified live on 2026-08-19 against the actual PDA engine — not a mockup, not a screenshot, not a demo video.*

### The test

We exercised every enforcement layer of the Agent PDA end-to-end through the MCP interface — the same interface that Cursor, Devin, Copilot, and other AI coding agents use.

### The sequence

```
 1. Agent registered           → success, agent ID assigned
 2. Memory stored              → "engine enforces rules"
 3. Memory recalled            → full-text search found it
 4. Parent task created        → "scan workspace"
 5. Child task created         → linked to parent via parentId
 6. Child completion attempted → BLOCKED: parent_incomplete
 7. Parent task completed      → success
 8. Child task completed       → success (dependency satisfied)
 9. Policy check: force-push   → BLOCKED: default-no-force-push
10. Gate finalize (no scan)    → BLOCKED: default-must-scan
11. Gate scan run              → PASSED, exit 0
12. Gate finalize (post-scan)  → canFinalize: true, 0 blocking
13. Handoff written            → brief + memory ID recorded
14. Handoff read               → all fields retrieved intact
```

### What this proves

This is not UI-only behavior. This is engine-level enforcement:

- **Dependency enforcement** — the engine blocked the child task because the parent wasn't complete. The agent could not bypass this.
- **Policy enforcement** — the engine blocked force-push because policy forbids it. The agent could not override it.
- **Gate enforcement** — the engine blocked finalization because the gate hadn't passed. After the gate passed, finalization was allowed.
- **Memory and handoff** — every action was recorded in local state with agent attribution. The audit trail is real.

### The decision model

The proof demonstrates the actual decision model:

> The agent is subject to the rules.
> The engine enforces them.
> The sidebar is only observability and control for humans.

The safety harness works even when the sidebar is closed. The agent cannot claim completion without the gate passing. The agent cannot force-push. The agent cannot skip parent tasks. The engine enforces — the UI observes.

### Test suite

In addition to the live proof, the dedicated PDA test suite passes 26/26 tests covering agent registry, memory store, task store, policy engine, gate bridge, agent detection, and handoff read/write.

### The product story, proven

This is not "AI writes more code faster."

This is "AI is constrained by state + policy + gate — and you can prove it."

The proof is in the live behavior. The safety harness is real.

---

## PDA Feedback Loop — Concrete Spec

The PDA is an enforcement and traceability layer. It does not magically self-heal the app. The value comes from using the collected local state to improve policies, gates, and human workflows.

### What the PDA captures

Every agent session records:

| Data | Source | Example |
|------|--------|---------|
| Agent identity | `agent-registry.js` | `Devin-Proof`, type `cursor`, session ID |
| Task history | `task-store.js` | Created, blocked, completed, time spent |
| Memory entries | `memory-store.js` | Decisions, facts, session notes, handoff briefs |
| Policy checks | `policy-engine.js` | Action, allowed/blocked, violation details |
| Gate results | `gate-bridge.js` | Pass/fail, blocking count, quality score |
| Handoff briefs | `handoff` commands | Summary, completed/pending tasks, files changed |

All stored locally in `.simplebeacon/agent-pda/` as JSON.

### What SimpleBeacon does with that data

#### 1. Identify recurring failure modes

```
PDA state → analyze → detect patterns

Patterns to detect:
  - policy violations that repeat (same action, same agent, same block)
  - dependency deadlocks (child tasks stuck waiting for parents that never complete)
  - gate failures before scan completion (agent claims done too early)
  - tasks that take abnormally long (possible agent confusion)
  - memories that contradict each other (possible agent drift)
```

#### 2. Tune policies

```
repeated false positives → narrow the rule
  Example: force-push blocked 5 times on feature branches
  → policy allows force-push on branches matching feature/*

repeated real violations → strengthen the block
  Example: commit-secrets triggered 3 times in one session
  → escalate from warning to block
  → add pre-commit hook automatically
```

#### 3. Improve agent behavior

```
task history → detect "claim done too early" pattern
  Signal: gate_finalize attempted, gate failed, agent moved on
  Action: flag agent in handoff brief for human review

memory history → detect drift
  Signal: two memories with same key, contradictory values
  Action: surface contradiction in next handoff brief

handoff history → improve handoffs
  Signal: handoff brief missing filesChanged
  Action: enforce filesChanged in policy
```

#### 4. Improve the gate

```
gate results → track which checks cause most blockages
  Signal: production-leak rule blocks 80% of gate attempts
  Action: review whether rule is too broad or codebase has real problem

gate results → refine severity
  Signal: warning-level findings never get fixed
  Action: escalate to blocking severity

gate results → refine exit criteria
  Signal: gate passes but next session finds new critical issues
  Action: add missing check to gate
```

#### 5. Generate reports

```
PDA state → per-agent task summaries
  "Agent Devin-Proof completed 12 tasks, blocked 3, average time 4.2 min"

PDA state → pass/fail trend analysis
  "Gate pass rate improved from 60% to 95% over 20 sessions"

PDA state → release confidence signals
  "Last 5 sessions: 0 policy violations, 0 gate failures, all dependencies satisfied"
```

### The feedback loop

```
┌─────────────────────────────────────────────────────────┐
│  1. Agent works                                         │
│     → PDA records every action, task, memory, gate      │
├─────────────────────────────────────────────────────────┤
│  2. SimpleBeacon analyzes the record                    │
│     → detects patterns, failure modes, drift            │
├─────────────────────────────────────────────────────────┤
│  3. Policies and gate logic improve                     │
│     → narrow false positives, strengthen real blocks    │
│     → escalate severities, add missing checks           │
├─────────────────────────────────────────────────────────┤
│  4. Future agent runs are safer                         │
│     → better rules, tighter gate, clearer handoffs      │
│     → measurable safety improvement over time           │
├─────────────────────────────────────────────────────────┤
│  5. Loop repeats                                        │
│     → each session feeds back into the next             │
└─────────────────────────────────────────────────────────┘
```

### Metrics to compute

| Metric | Source | What it tells you |
|--------|--------|-------------------|
| Gate pass rate | `gate-bridge.js` results | Is the codebase getting cleaner? |
| Policy violation rate | `policy-engine.js` checks | Is the agent learning? |
| Task completion rate | `task-store.js` | Is the agent finishing work? |
| Average task time | `task-store.js` `timeSpentMs` | Is the agent efficient? |
| Dependency block rate | `task-store.js` blocks | Are tasks well-ordered? |
| Handoff completeness | `handoff` briefs | Are handoffs usable by next agent? |
| Memory drift count | `memory-store.js` contradictions | Is the agent consistent? |
| Repeat false positive count | `policy-engine.js` + scan reports | Are rules too broad? |

### What this is NOT

- Not autopilot — the PDA does not self-heal the app
- Not autonomous — humans review patterns and tune rules
- Not magic — the value comes from using collected state to improve workflows

### What this IS

- Measurable safety — every session produces data
- Learnable workflow improvement — policies and gates get smarter
- Evidence-based policy tuning — not guessing, but reading the record
- Feedback-driven agent governance — the system learns from its own enforcement history

### The short answer

Yes, the PDA can be used to improve SimpleBeacon. But the real win is not autopilot. It is measurable safety and learnable workflow improvement — powered by the enforcement layer's own recorded history.

---

## Feedback Loop — Product Page Paragraph

The PDA doesn't replace judgment; it creates the evidence trail that makes better judgment possible. Every AI agent session is recorded — what tasks were attempted, what policies were triggered, what the gate blocked, what the gate allowed, what handoff summaries were written. SimpleBeacon analyzes that record to detect patterns: recurring policy violations, dependency deadlocks, premature "claim done" attempts, memory drift. Policies get narrower where they're too broad. Gates get sharper where they're too loose. Handoffs get more complete where they're missing context. Each session feeds back into the next — not autonomously, but through measurable, evidence-based improvement. The result is AI that becomes safer and more consistent over time, not because it learned on its own, but because the system learned from enforcing the rules.

---

## Technical Architecture Note

### System components

```
┌────────────────────────────────────────────────────────────┐
│  AI Agent (Cursor, Devin, Copilot, Cline, Windsurf)        │
│  Interacts via MCP tools, CLI commands, or REST API        │
└──────────────────────┬─────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────┐
│  PDA Engine (packages/simplebeacon-cli/src/agent-pda/)     │
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ agent-       │  │ memory-store │  │ task-store   │     │
│  │ registry     │  │              │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ policy-      │  │ gate-bridge  │  │ sync-layer   │     │
│  │ engine       │  │              │  │ (optional)   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                            │
│  State: .simplebeacon/agent-pda/*.json (local-first)       │
└──────────────────────┬─────────────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
   ┌──────────┐ ┌──────────┐ ┌──────────────┐
   │ CLI      │ │ MCP      │ │ REST API     │
   │ commands │ │ server   │ │ (ai-platform)│
   └──────────┘ └──────────┘ └──────────────┘
          │            │            │
          └────────────┼────────────┘
                       │
                       ▼
   ┌──────────────────────────────────────┐
   │  VS Code Sidebar (AgentPDAPanel)     │
   │  Reads/writes same local JSON state  │
   │  Observability + control for humans  │
   └──────────────────────────────────────┘
```

### Data flow

1. **Agent acts** → MCP tool call (e.g., `task_complete`, `gate_finalize`, `policy_check`)
2. **Engine enforces** → checks policy, gate, dependencies before allowing action
3. **State recorded** → every action, result, and violation written to local JSON
4. **Sidebar reflects** → human sees current state in VS Code panel
5. **SimpleBeacon analyzes** → reads PDA state to detect patterns and compute metrics
6. **Policies tuned** → human adjusts rules based on evidence
7. **Next session safer** → improved rules + gate applied to next agent run

### Security boundary

The security boundary is the engine, not the UI. The sidebar panel cannot bypass policy checks, gate validation, or dependency enforcement. It reads and writes the same JSON state, but enforcement happens in the engine layer before any state change is committed. An agent that tries to complete a task with an incomplete parent gets `parent_incomplete` regardless of which surface it uses — CLI, MCP, REST, or sidebar.

### Local-first

All PDA state lives in `.simplebeacon/agent-pda/` as JSON files. No source code is uploaded. No agent activity is sent to a server unless optional sync is explicitly enabled. The enforcement layer works fully offline.

---

## Investor / Enterprise Value Statement

### The problem

AI coding agents are becoming standard in engineering teams. But they operate as black boxes — no persistent task state, no policy enforcement, no gate validation, no audit trail. Organizations cannot answer the question: "What did the AI do, did it follow our rules, and can we prove it?"

### The solution

SimpleBeacon's Agent PDA is a local-first enforcement layer that governs AI coding agents through four mechanisms:

1. **Task tracking** — every task is created, tracked, and gated by dependency rules
2. **Policy enforcement** — forbidden actions (force-push, commit-secrets) are blocked before execution
3. **Gate validation** — agents cannot claim completion without passing a quality gate
4. **Audit trail** — every action, decision, and result is recorded with agent attribution

### The moat

The moat is not autonomous code generation. The moat is **governed AI** — AI that is constrained by state, policy, and gate, with an evidence trail that proves compliance. This matters because:

- **Regulators** are demanding AI accountability (EU AI Act, SOC 2, ISO 42001)
- **Engineering leaders** need to prove AI-assisted code is safe to ship
- **Security teams** need to detect when AI agents violate policy
- **Auditors** need traceable evidence, not promises

### The business model

| Tier | Price | Target |
|------|-------|--------|
| Developer | $49/mo | Individual developers using AI agents |
| Team Pro | $149/mo (5 seats) | Engineering teams needing policy enforcement + gate |
| Enterprise | Custom | Organizations needing compliance, audit trails, SSO |

### The market

Every engineering team using AI coding agents (Cursor, Devin, Copilot, Cline, Windsurf) needs governance. The market is growing as AI adoption accelerates and regulators tighten requirements. SimpleBeacon is the enforcement layer that makes AI-assisted development auditable.

### The proof

The PDA was proven live on 2026-08-19. 26/26 tests pass. The engine blocks invalid actions (dependency violations, force-push, premature finalization) and allows them only after rules are satisfied. The safety harness is real, not decorative.

### The summary

> The PDA doesn't replace judgment; it creates the evidence trail that makes better judgment possible.

AI goes from a black box to a governable workflow. That is the thing organizations need to buy.

---

## Architecture: Sidebar vs Engine

The sidebar is not a separate subsystem. It is the human-facing view of the same PDA state that the CLI/agent layer enforces.

**Sidebar PDA (observability and control):**
- Shows status — agents, tasks, memories, policies, gate results
- Lets humans inspect and manage PDA state
- Gives humans a visible control surface for what the engine is doing

**Real PDA engine (enforcement and accountability):**
- Registers agents
- Creates and tracks tasks
- Checks policy rules
- Gates finalization, deployment, and handoff
- Records everything for auditability

The AI does not click buttons in the sidebar. The AI is governed by the same PDA state and enforcement path underneath. The UI can look passive while the actual safety harness does the work in the CLI/backend layer.

The value is not that the AI interacts with the sidebar. The value is that the workflow has memory, policy enforcement, and an auditable gate. That is the actual trust layer.

```
┌─────────────────────────────────────────┐
│  Sidebar (VS Code panel)                │
│  ┌─────┐ ┌──────┐ ┌──────┐ ┌────────┐  │
│  │Dash │ │Tasks │ │Memory│ │Policies│  │
│  └─────┘ └──────┘ └──────┘ └────────┘  │
│         ↕ reads/writes same state       │
├─────────────────────────────────────────┤
│  PDA Engine (CLI / MCP / REST)          │
│  ┌──────────────────────────────────┐   │
│  │ agent-registry.js                │   │
│  │ memory-store.js                  │   │
│  │ task-store.js                    │   │
│  │ policy-engine.js                 │   │
│  │ gate-bridge.js                   │   │
│  └──────────────────────────────────┘   │
│         ↕ enforces                       │
├─────────────────────────────────────────┤
│  AI Agent (Cursor, Devin, Copilot...)   │
│  → writes code                          │
│  → checks policies before finalizing    │
│  → passes gate before claiming done     │
└─────────────────────────────────────────┘
```

---

## "How It Works" — Product Website Section

### The safety harness is in the engine, not the UI

SimpleBeacon doesn't rely on AI clicking the right buttons. The enforcement layer runs underneath the AI agent — in the CLI, MCP server, and CI gate — where the agent can't bypass it.

### How an AI coding session works with SimpleBeacon

```
1. Agent starts
   → PDA auto-registers the agent (Cursor, Devin, Copilot, etc.)
   → Loads workspace policies from .simplebeacon/policies.json

2. Agent works
   → Creates tasks in the PDA task store
   → Stores context in agent memory (decisions, facts, session notes)
   → Each action is checked against policies before executing

3. Agent claims done
   → PDA runs the gate: scan + policy check
   → If critical/high issues found → gate blocks, agent must fix
   → If policy violations found → gate blocks, agent must comply
   → If parent tasks incomplete → child tasks can't complete

4. Human reviews
   → Sidebar shows: what the agent did, what it checked, what the gate found
   → Handoff brief summarizes: completed tasks, pending work, files changed
   → Audit trail records: every task, memory, policy check, gate result

5. Code ships
   → Gate passed → merge with confidence
   → Gate failed → blocked from merge, no bypass
   → Compliance report generated (EU AI Act, SOC 2)
```

### Why this works even when the UI looks "invisible"

The AI agent doesn't interact with the sidebar. The agent interacts with the PDA engine through MCP tools, CLI commands, or REST API calls. The sidebar is for humans — to observe, inspect, and intervene.

The protection comes from the engine:
- **Task tracking** — the agent can't claim completion without the gate passing
- **Agent identity** — every action is attributed to a registered agent
- **Policy checks** — forbidden actions are blocked before execution
- **Gate validation** — critical/high findings block merges, no exceptions

The UI exposes that state for humans. The engine enforces it for everyone.

---

## Architecture Blurb — For Docs

SimpleBeacon's Agent PDA is a local-first enforcement layer for AI coding agents. The engine lives in the CLI package (`packages/simplebeacon-cli/src/agent-pda/`) and is exposed through four surfaces: CLI commands, MCP tools, REST API, and the VS Code sidebar panel. All surfaces read and write the same local JSON state in `.simplebeacon/agent-pda/`.

The security boundary is the engine, not the UI. The sidebar panel is a human control surface — it displays agent state, tasks, memories, policies, and gate results, and allows humans to add/remove policies and manage tasks. But the actual enforcement (policy checks, gate validation, task dependency enforcement, agent registration) happens in the engine layer, which AI agents interact with via MCP tools or CLI commands.

This means the safety harness works even when the sidebar is closed. The agent is subject to the rules, not the other way around.

---

## Landing Page Diagram

```html
<section class="how-it-works">
  <h2>How It Works</h2>
  <p class="subhead">The safety harness is in the engine — not the UI.</p>

  <div class="architecture-diagram">
    <div class="layer layer-ui">
      <h3>VS Code Sidebar</h3>
      <p>Observability &amp; control for humans</p>
      <ul>
        <li>View agent activity</li>
        <li>Inspect tasks &amp; memories</li>
        <li>Manage policies</li>
        <li>Review gate results</li>
      </ul>
    </div>

    <div class="arrow-down">↕ same local state</div>

    <div class="layer layer-engine">
      <h3>PDA Engine</h3>
      <p>Enforcement &amp; accountability</p>
      <ul>
        <li>Agent registration &amp; identity</li>
        <li>Task tracking &amp; dependencies</li>
        <li>Policy checks before actions</li>
        <li>Gate validation before merge</li>
        <li>Memory &amp; handoff records</li>
      </ul>
    </div>

    <div class="arrow-down">→ enforces</div>

    <div class="layer layer-agent">
      <h3>AI Agent</h3>
      <p>Subject to the rules</p>
      <ul>
        <li>Cursor, Devin, Copilot, Cline, Windsurf</li>
        <li>Writes code</li>
        <li>Checks policies before finalizing</li>
        <li>Passes gate before claiming done</li>
      </ul>
    </div>
  </div>

  <p class="architecture-note">
    The agent doesn't click buttons in the sidebar. The engine enforces the rules underneath.
    The UI is for humans to observe and intervene. The safety harness works even when the sidebar is closed.
  </p>
</section>
```

