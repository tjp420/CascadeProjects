# Analyzer Backlog Matrix (48 Analyzers)

Status and phase mapping is aligned to `web/simplebeacon-dashboard/js/services/aiProblemAnalyzerSuite.mjs`.

Legend: Status = `implemented` / `stub` / `implemented+hardened`; Complexity = `S`/`M`/`H`.

## Current state snapshot
- Implemented: 10 (`A-01`, `A-02`, `A-03`, `A-04`, `A-05`, `A-06`, `A-23`, `A-39`, `A-46`, `A-48`)
- Remaining: 38
- Hardened critical lane: `A-39`, `A-46` (A-46 enhanced with text/code/log extraction + MTTR; keep protected)

## Phase 1 data infrastructure (MVP)
| Workstream | Status | Notes |
|---|---|---|
| `collectAnalyzerInputs()` + `resolveAnalyzerContext()` | complete | Shared snippets flow to all 10 implemented analyzers; scan issues derive subgroup/error cases |
| `buildAiSystemsIssueAnalysis()` context merge | complete | Flat or nested `context` always collected before per-analyzer overrides |
| `runAllAnalyzers(context)` | complete | Runs all implemented issue IDs with one shared context object |
| AnalyzeView context wiring | complete | Scan report, backlog snippet, codebase findings, and logs passed on "Analyze selected analyzers" |
| Eval fixtures (`tests/fixtures/ai-analyzer-eval/`) | complete | 10 category-grouped JSON fixtures + `EVAL_FIXTURES.md` |

## Priority matrix (operational rows)
| ID | Analyzer | Status | 48-week phase | Near-term sprint | Priority | Owner | Dependencies | Minimum acceptance checks |
|---|---|---|---|---|---|---|---|---|
| A-39 | Security Risk Analyzer | implemented+hardened | P1 (Weeks 1-2) | S0 (complete) | Critical | critical-lane (confirm by 2026-05-31) | Preserve evidence moderation behavior | Unit fixture pass incl. low/insufficient evidence + no payload contract regression |
| A-46 | Error Handling Analyzer | implemented+hardened | P1 (Weeks 1-2) | S0 (complete) | Critical | critical-lane (confirm by 2026-05-31) | Text/code/log extraction, MTTR, remediation coverage | Unit fixture pass incl. good-score fixture + limited evidence suppression |
| A-03 | Interpretability Analyzer | implemented | P2 (Weeks 3-8) | S1 (complete) | High | coverage-expansion-lane (assign by 2026-06-14) | Shared scoring helpers, fixture pack | Deterministic unit fixture + schema contract + non-zero data_analyzed |
| A-04 | Data Quality Analyzer | implemented | P2 (Weeks 3-8) | S1 (complete) | High | coverage-expansion-lane (assign by 2026-06-14) | Shared scoring helpers, fixture pack | Deterministic unit fixture + schema contract + non-zero data_analyzed |
| A-05 | Scalability Analyzer | implemented | P2 (Weeks 3-8) | S2 (complete) | High | coverage-expansion-lane (assign by 2026-06-14) | Shared scoring helpers, fixture pack, latency/throughput test inputs | Deterministic unit fixture + claim-vs-evidence checks |
| A-06 | Generalization Analyzer | implemented | P2 (Weeks 3-8) | S2 (complete) | High | coverage-expansion-lane (assign by 2026-06-14) | Shared scoring helpers, fixture pack, ID/OOD benchmark fixtures | Deterministic unit fixture + ID/OOD retention scoring |
| A-08 | Adversarial Vulnerability Analyzer | implemented | P3 (Weeks 9-14) | Backlog (next) | Medium | trust-security-lane (assign by 2026-06-07) | A-39 patterns and fixture strategy | Unit deterministic fixture + contract checks |
| A-10 | Privacy Violation Analyzer | implemented | P3 (Weeks 9-14) | Backlog (next) | Medium | trust-security-lane (assign by 2026-06-07) | Privacy pattern catalog + policy rules | Unit deterministic fixture + contract checks |
| A-40 | Content Filtering Analyzer | implemented | P3 (Weeks 9-14) | Backlog (next) | Medium | trust-security-lane (assign by 2026-06-07) | Moderation policy matrix | Unit deterministic fixture + contract checks |
| A-41 | Transparency Analyzer | implemented | P4 (Weeks 15-20) | Backlog | Medium | coverage-expansion-lane (assign by 2026-06-14) | Rationale payload field standards | Unit deterministic fixture + contract checks |

## Full backlog mapping by phase
| Phase | Weeks | Analyzer IDs |
|---|---:|---|
| P1 | 1-2 | A-39, A-46 |
| P2 | 3-8 | A-03, A-04, A-05, A-06 |
| P3 | 9-14 | A-07, A-08, A-09, A-10, A-11, A-12, A-13, A-14, A-15, A-16 |
| P4 | 15-20 | A-24, A-25, A-26, A-27, A-33, A-34, A-35, A-36, A-37, A-38, A-40, A-41, A-42, A-43, A-44, A-45 |
| P5 | 21-28 | A-17, A-18, A-19, A-20, A-21 |
| P6 | 29-36 | A-28, A-29, A-30, A-31, A-32, A-47 |
| P7 | 37-42 | Cross-suite integration hardening across all implemented analyzers |
| P8 | 43-48 | Release hardening, risk closure, DoD completion |
# Analyzer Backlog Matrix (48 Analyzers)

Status and phase mapping is aligned to `web/simplebeacon-dashboard/js/services/aiProblemAnalyzerSuite.mjs`.

Legend: Status = `implemented` / `stub` / `active-critical`; Complexity = `S`/`M`/`H`.

| ID | Analyzer | Status | Priority | Phase | Complexity | Prerequisites | Owner | Test requirements |
|---|---|---|---|---|---|---|---|---|
| A-01 | Hallucination Analyzer | implemented | P1-High | P1 (Weeks 3-8) | M | Regression fixtures + contract lock | core-analyzers-lane (confirm by 2026-05-31) | Unit deterministic fixture + schema contract assertion |
| A-02 | Bias Detection Analyzer | implemented | P1-High | P1 (Weeks 3-8) | M | Regression fixtures + contract lock | core-analyzers-lane (confirm by 2026-05-31) | Unit deterministic fixture + schema contract assertion |
| A-03 | Interpretability Analyzer | implemented | P2-Medium | P2 (Weeks 9-20) | M | Shared scoring helpers + fixture pack | coverage-expansion-lane (assign by 2026-06-14) | Unit deterministic fixture + schema contract assertion |
| A-04 | Data Quality Analyzer | implemented | P2-Medium | P2 (Weeks 9-20) | M | Shared scoring helpers + fixture pack | coverage-expansion-lane (assign by 2026-06-14) | Unit deterministic fixture + schema contract assertion |
| A-05 | Scalability Analyzer | implemented | P2-Medium | P2 (Weeks 9-20) | M | Shared scoring helpers + fixture pack | coverage-expansion-lane (assign by 2026-06-14) | Unit deterministic fixture + schema contract assertion |
| A-06 | Generalization Analyzer | implemented | P2-Medium | P2 (Weeks 9-20) | M | Shared scoring helpers + fixture pack | coverage-expansion-lane (assign by 2026-06-14) | Unit deterministic fixture + schema contract assertion |
| A-07 | Catastrophic Forgetting Analyzer | implemented | P2-Medium | P2 (Weeks 9-20) | M | Shared scoring helpers + fixture pack | coverage-expansion-lane (assign by 2026-06-14) | Unit deterministic fixture + schema contract assertion |
| A-08 | Adversarial Vulnerability Analyzer | implemented | P1-High | P1 (Weeks 3-8) | M | Shared scoring helpers + fixture pack | trust-security-lane (assign by 2026-06-07) | Unit deterministic fixture + schema contract assertion |
| A-09 | Job Displacement Impact Analyzer | implemented | P2-Medium | P2 (Weeks 9-20) | M | Shared scoring helpers + fixture pack | coverage-expansion-lane (assign by 2026-06-14) | Unit deterministic fixture + schema contract assertion |
| A-10 | Privacy Violation Analyzer | implemented | P1-High | P1 (Weeks 3-8) | M | Shared scoring helpers + fixture pack | trust-security-lane (assign by 2026-06-07) | Unit deterministic fixture + schema contract assertion |
| A-11 | Copyright Infringement Analyzer | implemented | P2-Medium | P2 (Weeks 9-20) | M | Shared scoring helpers + fixture pack | coverage-expansion-lane (assign by 2026-06-14) | Unit deterministic fixture + schema contract assertion |
| A-12 | Misinformation Generation Analyzer | implemented | P2-Medium | P2 (Weeks 9-20) | M | Shared scoring helpers + fixture pack | coverage-expansion-lane (assign by 2026-06-14) | Unit deterministic fixture + schema contract assertion |
| A-13 | Deepfake Detection Analyzer | implemented | P2-Medium | P2 (Weeks 9-20) | M | Shared scoring helpers + fixture pack | coverage-expansion-lane (assign by 2026-06-14) | Unit deterministic fixture + schema contract assertion |
| A-14 | Autonomous Weapon Safety Analyzer | implemented | P2-Medium | P2 (Weeks 9-20) | M | Shared scoring helpers + fixture pack | coverage-expansion-lane (assign by 2026-06-14) | Unit deterministic fixture + schema contract assertion |
| A-15 | Surveillance Impact Analyzer | implemented | P2-Medium | P2 (Weeks 9-20) | M | Shared scoring helpers + fixture pack | coverage-expansion-lane (assign by 2026-06-14) | Unit deterministic fixture + schema contract assertion |
| A-16 | Digital Divide Analyzer | implemented | P2-Medium | P2 (Weeks 9-20) | M | Shared scoring helpers + fixture pack | coverage-expansion-lane (assign by 2026-06-14) | Unit deterministic fixture + schema contract assertion |
| A-17 | Market Monopolization Analyzer | implemented | P3-Low | P3 (Weeks 21-36) | H | Shared scoring helpers + fixture pack | long-tail-lane (assign by 2026-06-21) | Unit deterministic fixture + schema contract assertion |
| A-18 | Environmental Impact Analyzer | implemented | P3-Low | P3 (Weeks 21-36) | H | Shared scoring helpers + fixture pack | long-tail-lane (assign by 2026-06-21) | Unit deterministic fixture + schema contract assertion |
| A-19 | Regulatory Compliance Analyzer | implemented | P3-Low | P3 (Weeks 21-36) | H | Shared scoring helpers + fixture pack | long-tail-lane (assign by 2026-06-21) | Unit deterministic fixture + schema contract assertion |
| A-20 | Liability Assessment Analyzer | implemented | P3-Low | P3 (Weeks 21-36) | H | Shared scoring helpers + fixture pack | long-tail-lane (assign by 2026-06-21) | Unit deterministic fixture + schema contract assertion |
| A-21 | Market Manipulation Analyzer | implemented | P3-Low | P3 (Weeks 21-36) | H | Shared scoring helpers + fixture pack | long-tail-lane (assign by 2026-06-21) | Unit deterministic fixture + schema contract assertion |
| A-22 | Intellectual Property Analyzer | implemented | P1-High | P1 (Weeks 3-8) | H | Regression fixtures + contract lock | core-analyzers-lane (confirm by 2026-05-31) | Unit deterministic fixture + schema contract assertion |
| A-23 | Response Consistency Analyzer | implemented | P1-High | P1 (Weeks 3-8) | M | Regression fixtures + contract lock | core-analyzers-lane (confirm by 2026-05-31) | Unit deterministic fixture + schema contract assertion |
| A-24 | Confidence Accuracy Analyzer | implemented | P2-Medium | P2 (Weeks 9-20) | M | Shared scoring helpers + fixture pack | coverage-expansion-lane (assign by 2026-06-14) | Unit deterministic fixture + schema contract assertion |
| A-25 | Context Retention Analyzer | implemented | P2-Medium | P2 (Weeks 9-20) | M | Shared scoring helpers + fixture pack | coverage-expansion-lane (assign by 2026-06-14) | Unit deterministic fixture + schema contract assertion |
| A-26 | Knowledge Freshness Analyzer | implemented | P2-Medium | P2 (Weeks 9-20) | M | Shared scoring helpers + fixture pack | coverage-expansion-lane (assign by 2026-06-14) | Unit deterministic fixture + schema contract assertion |
| A-27 | Reasoning Capability Analyzer | implemented | P2-Medium | P2 (Weeks 9-20) | M | Shared scoring helpers + fixture pack | coverage-expansion-lane (assign by 2026-06-14) | Unit deterministic fixture + schema contract assertion |
| A-28 | Prompt Engineering Difficulty Analyzer | implemented | P3-Low | P3 (Weeks 21-36) | M | Shared scoring helpers + fixture pack | long-tail-lane (assign by 2026-06-21) | Unit deterministic fixture + schema contract assertion |
| A-29 | Response Latency Analyzer | implemented | P3-Low | P3 (Weeks 21-36) | M | Shared scoring helpers + fixture pack | long-tail-lane (assign by 2026-06-21) | Unit deterministic fixture + schema contract assertion |
| A-30 | Cost Barrier Analyzer | implemented | P3-Low | P3 (Weeks 21-36) | M | Shared scoring helpers + fixture pack | long-tail-lane (assign by 2026-06-21) | Unit deterministic fixture + schema contract assertion |
| A-31 | Usage Limit Analyzer | implemented | P3-Low | P3 (Weeks 21-36) | M | Shared scoring helpers + fixture pack | long-tail-lane (assign by 2026-06-21) | Unit deterministic fixture + schema contract assertion |
| A-32 | Platform Lock-in Analyzer | implemented | P3-Low | P3 (Weeks 21-36) | M | Shared scoring helpers + fixture pack | long-tail-lane (assign by 2026-06-21) | Unit deterministic fixture + schema contract assertion |
| A-33 | False Positive/Negative Analyzer | implemented | P2-Medium | P2 (Weeks 9-20) | M | Shared scoring helpers + fixture pack | coverage-expansion-lane (assign by 2026-06-14) | Unit deterministic fixture + schema contract assertion |
| A-34 | Language Limitation Analyzer | implemented | P2-Medium | P2 (Weeks 9-20) | M | Shared scoring helpers + fixture pack | coverage-expansion-lane (assign by 2026-06-14) | Unit deterministic fixture + schema contract assertion |
| A-35 | Domain Knowledge Analyzer | implemented | P2-Medium | P2 (Weeks 9-20) | M | Shared scoring helpers + fixture pack | coverage-expansion-lane (assign by 2026-06-14) | Unit deterministic fixture + schema contract assertion |
| A-36 | Output Consistency Analyzer | implemented | P2-Medium | P2 (Weeks 9-20) | M | Shared scoring helpers + fixture pack | coverage-expansion-lane (assign by 2026-06-14) | Unit deterministic fixture + schema contract assertion |
| A-37 | Session Management Analyzer | implemented | P2-Medium | P2 (Weeks 9-20) | M | Shared scoring helpers + fixture pack | coverage-expansion-lane (assign by 2026-06-14) | Unit deterministic fixture + schema contract assertion |
| A-38 | Privacy Concern Analyzer | implemented | P2-Medium | P2 (Weeks 9-20) | H | Shared scoring helpers + fixture pack | coverage-expansion-lane (assign by 2026-06-14) | Unit deterministic fixture + schema contract assertion |
| A-39 | Security Risk Analyzer | active-critical | P0-Critical | P0 (Weeks 1-2) | H | Preserve current tranche behavior + evidence moderation | critical-lane (confirm by 2026-05-31) | High-risk + insufficient-data fixture coverage in `tests/unit/ai-systems-issue-analyzer.test.js` |
| A-40 | Content Filtering Analyzer | implemented | P2-Medium | P2 (Weeks 9-20) | H | Shared scoring helpers + fixture pack | coverage-expansion-lane (assign by 2026-06-14) | Unit deterministic fixture + schema contract assertion |
| A-41 | Transparency Analyzer | implemented | P2-Medium | P2 (Weeks 9-20) | H | Shared scoring helpers + fixture pack | coverage-expansion-lane (assign by 2026-06-14) | Unit deterministic fixture + schema contract assertion |
| A-42 | Dependence Risk Analyzer | implemented | P2-Medium | P2 (Weeks 9-20) | H | Shared scoring helpers + fixture pack | coverage-expansion-lane (assign by 2026-06-14) | Unit deterministic fixture + schema contract assertion |
| A-43 | API Complexity Analyzer | implemented | P2-Medium | P2 (Weeks 9-20) | M | Shared scoring helpers + fixture pack | coverage-expansion-lane (assign by 2026-06-14) | Unit deterministic fixture + schema contract assertion |
| A-44 | Compatibility Analyzer | implemented | P2-Medium | P2 (Weeks 9-20) | M | Shared scoring helpers + fixture pack | coverage-expansion-lane (assign by 2026-06-14) | Unit deterministic fixture + schema contract assertion |
| A-45 | Maintenance Overhead Analyzer | implemented | P2-Medium | P2 (Weeks 9-20) | M | Shared scoring helpers + fixture pack | coverage-expansion-lane (assign by 2026-06-14) | Unit deterministic fixture + schema contract assertion |
| A-46 | Error Handling Analyzer | implemented+hardened | P0-Critical | P0 (Weeks 1-2) | M | Text/code/log extraction + MTTR + remediation coverage | critical-lane (confirm by 2026-05-31) | High-risk + good-score + insufficient-data fixture coverage in `tests/unit/ai-systems-issue-analyzer.test.js` |
| A-47 | Customization Limit Analyzer | implemented | P3-Low | P3 (Weeks 21-36) | M | Shared scoring helpers + fixture pack | long-tail-lane (assign by 2026-06-21) | Unit deterministic fixture + schema contract assertion |
| A-48 | AI Output Reliability Analyzer | implemented | P1-High | P1 (Weeks 3-8) | M | Overconfidence/plausibility pattern catalog | core-analyzers-lane (confirm by 2026-05-31) | Unit deterministic fixture + reliabilityAssessment contract assertion |

## Critical tranche note
- A-39 and A-46 are intentionally marked `active-critical` and should remain isolated from unrelated analyzer edits while tranche work is in progress.

## Week 1 owner semantics
- `confirm by <date>` means lane owner must map to a named assignee in `analyzer-tracker.json` by that date before sprint entry.
- `assign by <date>` means no sprint activation is allowed for that analyzer row until a named assignee is set.
