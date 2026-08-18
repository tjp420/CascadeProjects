# SimpleBeacon AI Operator Roadmap

**Status:** Draft — 2026-08-31
**Branch:** `fix/lighthouse-a11y-fixes`
**Author:** Product engineering
**Companion docs:** [Spec](./ai-operator-spec.md) · [Pitch](../marketing/ai-operator-pitch.md)

---

## 1. Guiding principles

1. **No breaking changes.** Every phase extends existing tools; none replaces them.
2. **Each phase ships independently.** A phase is done when its tests pass and the CLI suite stays green (currently 1041 tests, 1040 pass, 1 skipped).
3. **No SQLite.** All new state lives in capped JSON files in `.simplebeacon/`, matching the existing architecture.
4. **No source upload.** All scans remain local.
5. **Extend existing files.** New modules go in `src/lib/` and `src/mcp/handlers/`; new tools are added to `tools.js`. No parallel implementations.
6. **Test first.** Each phase ships with tests before the implementation is considered complete.

---

## 2. Phase summary

| Phase | Theme | New tools | New files | Ship criteria |
|---|---|---|---|---|
| 0 | Conceptual contract | 0 | `policy.json` schema doc | Schema documented, no code changes |
| 1 | Operational modes | 1 (`set_mode`) | `src/lib/operational-modes.js` | Mode gating works, tests pass |
| 2 | Policy packs | 0 (extends `verify_before_write`) | `src/lib/policy-pack.js` | Protected paths enforced, tests pass |
| 3 | Action ledger | 2 (`get_action_ledger`, `revert_fix`) | `src/lib/action-ledger.js` | All actions logged, revert works |
| 4 | Risk score | 0 (extends `verify_before_write`, `propose_fix`) | `src/lib/risk-score.js` | Score surfaces in responses, tests pass |
| 5 | Approval gates | 1 (`request_approval`) | `src/mcp/handlers/approval-handlers.js` | Approval flow works, escalation matrix enforced |
| 6 | Workspace view | 1 (`get_workspace`) | `src/lib/workspace-view.js` | Workspace JSON renders, all data sources wired |
| 7 | Dry-run + revert loop | 0 (extends `verify_fix`) | extends `src/mcp/handlers/fix-handlers.js` | Dry-run previews without applying, revert undoes |

**Total new tools: 5** — matches the spec (§11.2).
**Total new lib modules: 5** — `operational-modes.js`, `policy-pack.js`, `action-ledger.js`, `risk-score.js`, `workspace-view.js`.
**Total new handler modules: 1** — `approval-handlers.js`.

---

## 3. Phase 0 — Conceptual contract

**Goal:** Document the policy pack schema and mode definitions before writing any code. This phase is documentation-only.

**Deliverables:**
- This roadmap and the spec are the deliverables.
- A sample `.simplebeacon/policy.json` checked in as `.simplebeacon/policy.example.json` for reference.

**Ship criteria:**
- Spec and roadmap reviewed.
- `policy.example.json` documents the schema from spec §5.2.

**No code changes. No tests. No tool changes.**

---

## 4. Phase 1 — Operational modes

**Goal:** Introduce `safe`, `review`, `autonomous`, `emergency` as a first-class concept that gates which tools the agent may call.

**New files:**
- `packages/simplebeacon-cli/src/lib/operational-modes.js` — `MODE_ALLOWED_TOOLS` map, `resolveMode(session)`, `assertModeAllows(tool, mode)`, `transitionMode(from, to, reason)`.
- `packages/simplebeacon-cli/tests/operational-modes.test.js` — mode gating, escalation-only transitions, tier × mode intersection.

**New tool:**
- `set_mode` — transitions to a higher mode within a session. Params: `mode`, `reason`. Returns the new mode and the allowed tool list. Refuses to de-escalate (must start a new session).

**Extended files:**
- `src/mcp/tools.js` — add `set_mode` to `TOOL_DEFINITIONS` and `TOOL_CATEGORIES` (core, free).
- `src/mcp/stdio-server.js` — load active mode from session state, gate every tool call through `assertModeAllows` before dispatching.
- `src/lib/agent-supercharge.js` — accept `mode` param, surface active mode in the briefing.
- `src/mcp/handlers/agent-verify-handlers.js` — record mode in failure-log entries.

**Ship criteria:**
- `set_mode` refuses to de-escalate within a session.
- Tools not allowed in the active mode return `{ blocked: true, reason: "mode-not-allowed", activeMode: "safe", requiredMode: "review" }`.
- Mode is recorded in every action that goes through the failure log.
- Full CLI test suite stays green.
- New test file covers: mode gating per tool, escalation-only transitions, tier × mode intersection (a Free user in autonomous mode still can't call `scan_file`).

**Dependencies:** None. This phase has no dependencies on later phases.

---

## 5. Phase 2 — Policy packs

**Goal:** Introduce `.simplebeacon/policy.json` and enforce protected paths, auto-fix limits, and forbidden patterns.

**New files:**
- `packages/simplebeacon-cli/src/lib/policy-pack.js` — `loadPolicyPack(projectRoot)`, `assertPolicyAllows(action, target, policy)`, `getProtectedPathMatches(target, policy)`, built-in pack definitions (`secure-defaults`, `production-safe`, `compliance`, `experimental`).
- `packages/simplebeacon-cli/tests/policy-pack.test.js` — protected path matching, auto-fix counter, forbidden pattern detection, built-in pack validation.

**Extended files:**
- `src/mcp/handlers/agent-verify-handlers.js` — `verify_before_write` checks `protectedPaths` from active policy pack; blocks writes to protected paths unless mode is `emergency`.
- `src/mcp/handlers/fix-handlers.js` — `propose_fix` and `verify_fix` check `maxAutoFixesPerSession` and `requireApprovalAbove`.
- `src/lib/agent-supercharge.js` — accept `policyPack` param, surface active policy in the briefing.
- `.simplebeacon/policy.example.json` — sample policy pack for reference.

**Ship criteria:**
- `verify_before_write` blocks writes to `protectedPaths` with `reason: "policy-violation:protected-path"`.
- `propose_fix` returns `{ blocked: true, reason: "auto-fix-limit-reached", used: 5, max: 5 }` when the session limit is hit.
- Built-in packs load correctly; `org-specific` pack loads from `.simplebeacon/policy.json` when present.
- When no policy is specified, `secure-defaults` is applied.
- Full CLI test suite stays green.

**Dependencies:** Phase 1 (modes). Policy enforcement differs by mode — `emergency` mode can touch protected paths under emergency policy.

---

## 6. Phase 3 — Action ledger

**Goal:** Record every agent action — proposed, allowed, blocked, applied, reverted — in a durable, append-only ledger.

**New files:**
- `packages/simplebeacon-cli/src/lib/action-ledger.js` — `recordAction(entry)`, `getActions(filter)`, `markReverted(actionId, reason)`, capped at 500 entries.
- `packages/simplebeacon-cli/src/mcp/handlers/action-ledger-handlers.js` — handlers for `get_action_ledger` and `revert_fix`.
- `packages/simplebeacon-cli/tests/action-ledger.test.js` — append, cap, filter by session/mode/outcome, revert marking.

**New tools:**
- `get_action_ledger` — returns recent entries, filterable by `sessionId`, `mode`, `outcome`, `tool`. Free tier.
- `revert_fix` — marks an entry as reverted and attempts to revert the underlying change. Agent tier.

**Extended files:**
- `src/mcp/tools.js` — add both tools to `TOOL_DEFINITIONS` and `TOOL_CATEGORIES`.
- `src/mcp/handlers/agent-verify-handlers.js` — record `verify_before_write` outcomes to the ledger.
- `src/mcp/handlers/fix-handlers.js` — record `propose_fix` and `verify_fix` outcomes to the ledger.
- `src/mcp/handlers/failure-tracking-handlers.js` — record validation run outcomes to the ledger.

**Ship criteria:**
- Every `verify_before_write`, `propose_fix`, `verify_fix`, and `log_validation_run` call writes a ledger entry.
- Ledger caps at 500 entries; oldest entries dropped on overflow.
- `revert_fix` marks entries as reverted and records `revertReason`.
- `get_action_ledger` filters by session, mode, outcome.
- Full CLI test suite stays green.

**Dependencies:** Phase 1 (modes — ledger entries record the active mode). Phase 2 (policy — ledger entries record the active policy pack).

---

## 7. Phase 4 — Risk score

**Goal:** Produce a single risk score in `[0, 1]` for every proposed action, surfaced in tool responses and stored in the action ledger.

**New files:**
- `packages/simplebeacon-cli/src/lib/risk-score.js` — `calculateRiskScore({ blockingCount, highSeverityCount, protectedPathTouches, policyViolations })`, `interpretRiskBand(score)`.
- `packages/simplebeacon-cli/tests/risk-score.test.js` — formula correctness, band boundaries, clamp behavior.

**Extended files:**
- `src/mcp/handlers/agent-verify-handlers.js` — `verify_before_write` response gains `riskScore` and `riskBand` fields.
- `src/mcp/handlers/fix-handlers.js` — `propose_fix` response gains `riskScore` and `riskBand` fields.
- `src/lib/action-ledger.js` — entries store `riskScore`.

**Ship criteria:**
- `verify_before_write` and `propose_fix` responses include `riskScore` (number) and `riskBand` (`safe` | `review` | `elevated` | `critical`).
- Score is calculated from the spec formula (§8.2).
- Score is stored in the action ledger.
- Full CLI test suite stays green.

**Dependencies:** Phase 2 (policy — `protectedPathTouches` and `policyViolations` inputs come from policy enforcement). Phase 3 (ledger — score is stored in ledger entries).

---

## 8. Phase 5 — Approval gates

**Goal:** When a proposed action exceeds the policy pack's threshold or touches a protected path, the agent must request approval through a first-class MCP interaction.

**New files:**
- `packages/simplebeacon-cli/src/mcp/handlers/approval-handlers.js` — handler for `request_approval`.
- `packages/simplebeacon-cli/tests/approval-handlers.test.js` — escalation matrix enforcement, approval state transitions, expiry.

**New tool:**
- `request_approval` — params: `action`, `target`, `riskScore`, `reason`, `policyPack`, `patchPreview`. Returns `{ approved, reason, reviewer, expiresAt }`.

**Extended files:**
- `src/mcp/tools.js` — add `request_approval` to `TOOL_DEFINITIONS` and `TOOL_CATEGORIES` (core, free).
- `src/mcp/handlers/fix-handlers.js` — `verify_fix` in `review` mode with `dryRun: false` requires an approval ID before applying.
- `src/lib/action-ledger.js` — record approval requests and outcomes.

**Ship criteria:**
- The escalation matrix from spec §6.3 is enforced: risk ≥ 0.5 requires approval, protected path in autonomous mode requires approval, forbidden patterns always block.
- `request_approval` returns `approved: false` when human review is required.
- Approval state is recorded in the action ledger.
- Full CLI test suite stays green.

**Dependencies:** Phase 2 (policy thresholds), Phase 3 (ledger), Phase 4 (risk score).

---

## 9. Phase 6 — Workspace view

**Goal:** A single MCP tool that returns the structured JSON for the agent workspace view — repo health, changed files, risk profile, policy status, recent findings, suggested next action.

**New files:**
- `packages/simplebeacon-cli/src/lib/workspace-view.js` — `buildWorkspaceView(projectRoot, sessionId)`, aggregates data from gate status, git diff, risk score, policy pack, action ledger, failure log, improvement signals, action plan.
- `packages/simplebeacon-cli/tests/workspace-view.test.js` — data source aggregation, missing-data graceful degradation, changed-file risk profile.

**New tool:**
- `get_workspace` — params: `projectRoot`, `sessionId`. Returns the workspace view JSON from spec §9.2.

**Extended files:**
- `src/mcp/tools.js` — add `get_workspace` to `TOOL_DEFINITIONS` and `TOOL_CATEGORIES` (core, free).
- `src/lib/agent-supercharge.js` — `supercharge_agent` response includes a `workspace` field that calls `buildWorkspaceView` when mode and policy are set.

**Ship criteria:**
- `get_workspace` returns all sections from spec §9.2: repo health, active mode + session, changed files with per-file risk, risk profile, policy status, recent findings, suggested next action.
- Gracefully degrades when data sources are missing (no report.json, no action ledger, no failure log).
- Full CLI test suite stays green.

**Dependencies:** Phases 1–4 (uses mode, policy, action ledger, risk score).

---

## 10. Phase 7 — Dry-run and revert loop

**Goal:** `verify_fix` gains a `dryRun` parameter that previews without applying, and `revert_fix` from Phase 3 is wired to actually revert the underlying change.

**Extended files:**
- `src/mcp/handlers/fix-handlers.js` — `verify_fix` accepts `dryRun: true`; returns patch preview without applying. In `review` mode, `dryRun: false` requires an approval ID.
- `src/lib/action-ledger.js` — `markReverted` attempts to revert the file change (using `git checkout` or the stored before/after content) when `revertible: true` and within `revertWindowHours`.
- `src/mcp/handlers/action-ledger-handlers.js` — `revert_fix` calls `markReverted` and returns the revert outcome.

**Ship criteria:**
- `verify_fix` with `dryRun: true` returns the patch preview without modifying files.
- `verify_fix` with `dryRun: false` in `review` mode requires an approval ID.
- `revert_fix` reverts the file change when within the revert window.
- `revert_fix` refuses to revert when the revert window has expired.
- Full CLI test suite stays green.

**Dependencies:** Phase 3 (action ledger — revert uses ledger entries), Phase 5 (approval — `dryRun: false` in review mode requires approval).

---

## 11. Sequencing and critical path

```
Phase 0 (docs only)
   |
   v
Phase 1 (modes) ────────────────────────────────┐
   |                                             |
   v                                             |
Phase 2 (policy packs) ──────────────┐           |
   |                                 |           |
   v                                 v           v
Phase 3 (action ledger) ────────> Phase 4 (risk score)
   |                                 |
   v                                 v
Phase 5 (approval gates) <──────────┘
   |
   v
Phase 6 (workspace view) ───────────────────────┘
   |
   v
Phase 7 (dry-run + revert)
```

**Critical path:** 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7.

**Parallelizable:** Phases 3 and 4 can be developed in parallel after Phase 2 (both depend on Phase 2, not on each other). Phase 6 can start after Phase 4 if the workspace view is built with stub data for approval gates.

---

## 12. Test strategy

Every phase ships with a new test file in `packages/simplebeacon-cli/tests/`. The full CLI suite must stay green after each phase.

**Test commands:**
```bash
# Phase-specific tests
node --test packages/simplebeacon-cli/tests/operational-modes.test.js
node --test packages/simplebeacon-cli/tests/policy-pack.test.js
node --test packages/simplebeacon-cli/tests/action-ledger.test.js
node --test packages/simplebeacon-cli/tests/risk-score.test.js
node --test packages/simplebeacon-cli/tests/approval-handlers.test.js
node --test packages/simplebeacon-cli/tests/workspace-view.test.js

# Full suite (must stay green)
npm test
```

**Current baseline:** 1041 tests, 1040 pass, 0 fail, 1 skipped.

**After all phases:** estimated 1080–1100 tests (5 new test files, ~8–12 tests each).

---

## 13. Rollout

- All phases ship to the `fix/lighthouse-a11y-fixes` branch (or a successor feature branch).
- No phase is deployed to production until Phase 6 (workspace view) is complete — the workspace view is what makes the operator model visible to users.
- Phases 1–5 are CLI-only; no dashboard changes required.
- Phase 6 is the first phase that may involve dashboard changes (rendering the workspace view in the VS Code extension).
- Phase 7 is the final phase; after it ships, the operator model is feature-complete.

---

## 14. Out of scope for this roadmap

- Dashboard UI for the workspace view (Phase 6 ships the JSON; UI rendering is a separate effort).
- VS Code extension changes (extension will consume the new MCP tools; no extension code changes in this roadmap).
- Marketing site updates (the pitch doc handles positioning; code ships first).
- Pricing changes (modes are free; policy packs are free; `revert_fix` is Agent tier; everything else is free or matches existing tier mapping).
- SQLite migration (explicitly rejected — all new state is JSON).
- Cloud sync of action ledger (local-only for now; cloud sync is a future possibility but not in this roadmap).

---

## 15. References

- Spec: [./ai-operator-spec.md](./ai-operator-spec.md)
- Pitch: [../marketing/ai-operator-pitch.md](../marketing/ai-operator-pitch.md)
- Existing tool definitions: `packages/simplebeacon-cli/src/mcp/tools.js`
- Existing tier gating: `packages/simplebeacon-cli/src/lib/agent-tier-capabilities.js`
- Existing failure tracking: `packages/simplebeacon-cli/src/lib/failure-log.js`
- Existing pre-edit gate: `packages/simplebeacon-cli/src/mcp/handlers/agent-verify-handlers.js`
