# AI Problem Analyzer Suite Master Roadmap

## Scope and current baseline
- Taxonomy source of truth: `web/simplebeacon-dashboard/js/services/aiProblemAnalyzerSuite.mjs`.
- Total analyzers: 47.
- Current implementation state: 5 implemented, 42 remaining.
- Implemented analyzers: A-01, A-02, A-23, A-39, A-46.
- Completed hardening tranche: A-39 + A-46 (keep protected from unrelated edits).

## 8-phase delivery plan (48 weeks)

| Phase | Weeks | Delivery objective | Exit criteria |
|---|---:|---|---|
| P1 | 1-2 | Critical hardening and baseline lock | A-39/A-46 hardening complete; unit regression suite stable |
| P2 | 3-8 | Foundation analyzer tranche | A-03/A-04/A-05/A-06 implemented with deterministic fixtures |
| P3 | 9-14 | Trust/safety expansion | High-priority trust/safety analyzers moved from stub to implemented |
| P4 | 15-20 | Reliability lane expansion | Reliability lane analyzers meet contract + fixture gates |
| P5 | 21-28 | Economic/regulatory lane | Economic/regulatory analyzers implemented to minimum gate |
| P6 | 29-36 | UX/practical long-tail completion | Remaining UX/practical analyzers implemented and validated |
| P7 | 37-42 | Integration and operational hardening | Integration analyzers + cross-suite contract checks are green |
| P8 | 43-48 | Release readiness and stabilization | DoD checklist, risk register mitigations, and release gate pass |

## Immediate delivery milestones

### M1 (Week 2) - Completed baseline hardening
- A-39 and A-46 hardening completed and tracked in `docs/analyzers-tranche-2026-05-a39-a46.md`.
- Preserve evidence moderation behavior and payload compatibility.

### M2 (Week 8) - Foundation tranche complete
- A-03, A-04, A-05, A-06 implemented.
- Suite implemented count target: 9 (from current 5).

### M3 (Week 20) - Midpoint throughput gate
- Implemented count target: >= 25.
- No release-critical contract regressions in analyzer payload shape.

### M4 (Week 48) - Full taxonomy gate
- Implemented count target: 48/48.
- `status: not_implemented` is absent for release-selected analyzers.

## Common dependencies and command gates
- Scoring contract consistency via shared helpers (`normalizeRiskScore`, severity/risk-band mapping).
- Deterministic fixtures in `tests/unit/ai-systems-issue-analyzer.test.js`.
- Operational checks from `ai-platform`:
  - `npm test -- --no-coverage tests/unit/ai-systems-issue-analyzer.test.js`
  - `npm run simplebeacon:report`
  - `npm run test:integration`
  - `npm run verify:production-deploy`

## Weekly review protocol
- Update `analyzer-tracker.json` (`status`, `phase`, `targetSprint`, `risk`, `validationChecklist`).
- Review top risks and mitigations in `RISK_REGISTER.md`.
- Reconcile sprint board in `SPRINT_EXECUTION_BOARD.md`.
- Record implemented-count delta and gate pass/fail evidence.
