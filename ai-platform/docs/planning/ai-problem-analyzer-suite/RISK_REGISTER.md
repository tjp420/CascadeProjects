# AI Problem Analyzer Suite Risk Register

| ID | Risk | Impact | Likelihood | Trigger signal | Mitigation | Owner |
|---|---|---|---|---|---|---|
| R-01 | Hardened lane (A-39/A-46) destabilized by adjacent refactors | High | Medium | A-39/A-46 tests fail | Keep A-39/A-46 as protected lane and require dedicated test pass before merge | TBD |
| R-02 | Stub backlog grows faster than implementation throughput | High | High | Sprint target misses >20% | Cap WIP and enforce implemented-count KPI in weekly review | TBD |
| R-03 | Score-to-severity behavior diverges across analyzers | High | Medium | Equivalent risk scores map differently | Reuse shared scoring utilities and threshold contract tests | TBD |
| R-04 | Fixture quality too weak for deterministic confidence | High | Medium | Flaky or low-signal regression outcomes | Build and maintain deterministic fixture packs per analyzer family | TBD |
| R-05 | Dashboard contract drift | Medium | Medium | UI parse errors or missing fields | Add payload schema validation and dashboard smoke checks | TBD |
| R-06 | Security signatures lag emerging prompt-injection patterns | High | Medium | Incidents not caught in analyzer outputs | Refresh signature corpus on fixed cadence; add red-team cases | TBD |
| R-07 | Error-handling risk misclassification under low evidence | Medium | Medium | Critical labels appear with insufficient sample size | Preserve minimum-evidence moderation and enforce tests | TBD |
| R-08 | Ownership gaps across sprint board | High | High | Unowned rows in active sprint | Require owner assignment before sprint entry in `SPRINT_EXECUTION_BOARD.md` | TBD |
| R-09 | Parallel analyzer work creates merge conflicts | Medium | Medium | Repeated conflict churn in suite files | Work in category lanes and reserve critical tranche files | TBD |
| R-10 | DoD gate run inconsistently | High | Medium | Milestone closes without evidence | Require DoD sign-off artifact in weekly execution review | TBD |
| R-11 | A-03/A-04 slips and blocks A-05/A-06 | High | Medium | S2 incomplete at sprint close | Enforce tranche dependency; defer S3 entry until S2 gate is green | TBD |
| R-12 | New analyzer marked implemented before validation | High | Medium | Tracker shows implemented with incomplete checks | Enforce `validationChecklist` completion in `analyzer-tracker.json` before status transition | TBD |

## Review cadence
- Weekly: reassess likelihood, impact, and mitigation status.
- Sprint close: re-rank top 3 risks and assign next sprint actions.
# AI Problem Analyzer Suite Risk Register

| ID | Risk | Impact | Likelihood | Trigger signal | Mitigation | Owner |
|---|---|---|---|---|---|---|
| R-01 | Active tranche (A-39/A-46) destabilized by adjacent refactors | High | Medium | A-39/A-46 tests fail | Keep A-39/A-46 as protected critical lane and require dedicated test pass before merge | critical-lane (confirm by 2026-05-31) |
| R-02 | Stub backlog grows faster than implementation throughput | High | High | Sprint target misses >20% | Cap WIP and enforce implemented-count KPI in weekly review | planning-ops-lane (assign by 2026-06-07) |
| R-03 | Score-to-severity behavior diverges across analyzers | High | Medium | Equivalent risk scores map differently | Reuse shared scoring utilities and threshold contract tests | core-analyzers-lane (confirm by 2026-05-31) |
| R-04 | Fixture quality too weak for deterministic confidence | High | Medium | Flaky or low-signal regression outcomes | Build and maintain deterministic fixture packs per analyzer family | qa-fixtures-lane (assign by 2026-06-07) |
| R-05 | Dashboard contract drift | Medium | Medium | UI parse errors or missing fields | Add payload schema validation and dashboard smoke checks | dashboard-contract-lane (assign by 2026-06-07) |
| R-06 | Security signatures lag emerging prompt-injection patterns | High | Medium | Incidents not caught in analyzer outputs | Refresh signature corpus on fixed cadence; add red-team cases | trust-security-lane (assign by 2026-06-07) |
| R-07 | Error-handling risk misclassification under low evidence | Medium | Medium | Critical labels appear with insufficient sample size | Preserve minimum-evidence moderation and enforce tests | critical-lane (confirm by 2026-05-31) |
| R-08 | Ownership gaps across 47-analyzer matrix | High | High | Unowned rows in active sprint | Require owner assignment before sprint entry | planning-ops-lane (assign by 2026-06-07) |
| R-09 | Parallel analyzer work creates merge conflicts | Medium | Medium | Repeated conflict churn in suite files | Work in category lanes and reserve critical tranche files | planning-ops-lane (assign by 2026-06-07) |
| R-10 | DoD gate run inconsistently | High | Medium | Milestone closes without evidence | Require DoD sign-off artifact in weekly execution review | release-governance-lane (assign by 2026-06-07) |

## Review cadence
- Weekly: reassess likelihood, impact, and mitigation status.
- Sprint close: re-rank top 3 risks and assign next sprint actions.

## Owner status semantics
- `confirm by <date>` = lane already active in current sprint and must be mapped to a named assignee by that date.
- `assign by <date>` = lane not yet person-assigned; due date is the handoff deadline for Week 2 planning.
