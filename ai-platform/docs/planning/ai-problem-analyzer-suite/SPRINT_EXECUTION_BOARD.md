# Analyzer Sprint Execution Board (Next 8 Weeks)

Scope: operational board for immediate delivery using current baseline (5 implemented, 42 remaining).

## Completed hardening lane
| Analyzer ID | Status | Notes | Locked checks |
|---|---|---|---|
| A-39 | Implemented + hardened | Security risk evidence moderation complete | Unit fixture lane + schema contract stability |
| A-46 | Implemented + hardened | Error handling low/limited evidence moderation complete | Unit fixture lane + schema contract stability |

## Sprint S2 (Weeks 3-4) - coding tranche 1
| Analyzer ID | Owner placeholder | Dependencies | Tests required | Exit criteria |
|---|---|---|---|---|
| A-03 | TBD-Core-1 | Shared scoring helpers, analyzer fixture template | Add deterministic unit fixtures in `tests/unit/ai-systems-issue-analyzer.test.js`; run `npm test -- --no-coverage tests/unit/ai-systems-issue-analyzer.test.js` | Returns `status: implemented`; required result fields present; deterministic fixture pass |
| A-04 | TBD-Core-2 | Shared scoring helpers, data quality fixture pack | Add deterministic unit fixtures in `tests/unit/ai-systems-issue-analyzer.test.js`; run `npm test -- --no-coverage tests/unit/ai-systems-issue-analyzer.test.js` | Returns `status: implemented`; required result fields present; deterministic fixture pass |

S2 board gate commands (run from `ai-platform`):
- `npm test -- --no-coverage tests/unit/ai-systems-issue-analyzer.test.js`
- `npm run simplebeacon:report`

## Sprint S3 (Weeks 5-6) - coding tranche 2
| Analyzer ID | Owner placeholder | Dependencies | Tests required | Exit criteria |
|---|---|---|---|---|
| A-05 | TBD-Core-1 | A-03/A-04 fixture patterns, throughput/latency synthetic inputs | Add deterministic unit fixtures; run unit suite + `npm run test:integration` | Returns `status: implemented`; required result fields present; deterministic fixtures and integration checks pass |
| A-06 | TBD-Core-2 | A-03/A-04 fixture patterns, ID/OOD benchmark fixtures | Add deterministic unit fixtures; run unit suite + `npm run test:integration` | Returns `status: implemented`; required result fields present; deterministic fixtures and integration checks pass |

S3 board gate commands (run from `ai-platform`):
- `npm test -- --no-coverage tests/unit/ai-systems-issue-analyzer.test.js`
- `npm run simplebeacon:report`
- `npm run test:integration`

## Cross-sprint controls
- Keep A-39/A-46 fixture assertions unchanged unless explicitly in hardening scope.
- Update `analyzer-tracker.json` at sprint close (`status`, `targetSprint`, `risk`, `validationChecklist`).
- Record blockers by analyzer ID in `RISK_REGISTER.md`.
