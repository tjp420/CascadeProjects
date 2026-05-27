# AI Problem Analyzer Suite Next 8 Weeks (MVP Window)

## MVP objective
Deliver a stable near-term baseline by implementing the next 4 analyzers (A-03, A-04, A-05, A-06) while preserving hardened A-39 and A-46 quality.

## Sprint plan (4 x 2 weeks)

| Sprint | Goal | Concrete deliverables | KPI targets | Stop/Go criteria |
|---|---|---|---|---|
| S1 (Weeks 1-2) | Completed hardening baseline | Keep A-39/A-46 hardening stable; finalize tracker state | Implemented analyzers remain 5; 0 A-39/A-46 regressions | **Go** if hardening checks remain green; **Stop** on evidence moderation regression |
| S2 (Weeks 3-4) | Build foundation tranche part 1 | Implement A-03 + A-04 with deterministic fixtures | Implemented analyzers = 7; schema contract pass on both analyzers | **Go** if S2 gates pass; **Stop** if either analyzer fails schema/fixture gate |
| S3 (Weeks 5-6) | Build foundation tranche part 2 | Implement A-05 + A-06 with deterministic fixtures | Implemented analyzers = 9; no contract regressions | **Go** if S3 gates pass; **Stop** on any regression in A-39/A-46 behavior |
| S4 (Weeks 7-8) | Stabilization and throughput prep | Harden all four new analyzers and prep P3 queue | 4/4 newly implemented analyzers pass min quality gate; no open critical DoD item | **Go** if DoD + risk gates pass; **Stop** if critical risk remains unmitigated |

## Weekly execution KPIs
- Implemented analyzer count trajectory: 5 -> 7 -> 9 -> 9.
- Regression count in `tests/unit/ai-systems-issue-analyzer.test.js`: target 0.
- Open critical findings from analyzer release checks: target 0 at sprint close.
- Backlog freshness (`analyzer-tracker.json` rows updated): target 48/48 weekly.

## Mandatory weekly command set
Run from `ai-platform`:
- `npm test -- --no-coverage tests/unit/ai-systems-issue-analyzer.test.js`
- `npm run simplebeacon:report`
- `npm run test:integration` (at least once per sprint)
- `npm run verify:production-deploy` (before MVP gate)

## Hard non-go conditions
- A-39/A-46 evidence moderation regression.
- Implemented analyzer count below sprint target by more than 1.
- Any unowned critical-path analyzer row in active sprint.
- Unresolved critical DoD gate item.

## Concrete next coding tranche
- S2 (Weeks 3-4): A-03, A-04.
- S3 (Weeks 5-6): A-05, A-06.
- Sequence rule: do not begin A-05/A-06 until A-03/A-04 contract + fixtures are merged.
