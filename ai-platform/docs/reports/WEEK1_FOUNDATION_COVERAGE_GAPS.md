# Week 1 Foundation Coverage Gaps

Generated from `coverage/dashboard/coverage-summary.json` after `npm run coverage`.

## Current Baseline

- Lines: `85.45%` (799/935)
- Statements: `84.65%` (894/1056)
- Functions: `77.46%` (165/213)
- Branches: `64.55%` (519/804)

## Top-10 High-Impact Uncovered Areas

1. `src/api/dashboard-stub-api.js` — branch coverage `42.77%` (151/353), function coverage `72.78%`; high route surface and fallback behavior.
2. `src/api/dashboard-stub-api.js` — line coverage `82.27%` (520/632); large API payload composition logic still under-tested.
3. `server/lib/npm-audit-runner.js` — branch coverage `65.38%` (34/52); risk area for security reporting and failure handling.
4. `server/bootstrap/phase2-integration.js` — branch coverage `70.83%` (34/48); auth gate/public-route bypass matrix needs deeper negative-path tests.
5. `server/services/user-service.js` — branch coverage `72.58%` (45/62); auth source fallback and credential mismatch paths.
6. `server/bootstrap/phase2-integration.js` — line coverage `91.75%` but route wiring plus optional infra behavior not fully exercised.
7. `server/services/user-service.js` — statements `81.81%` (36/44); low-volume but security-adjacent auth logic.
8. `server/lib/npm-audit-runner.js` — statements `82.92%` (34/41); parsing/error branches for malformed audit payloads.
9. `src/api/dashboard-stub-api.js` — function coverage gap (46 functions uncovered) across endpoint-specific helpers.
10. `coverage model scope gap` — only 7 files are included in `collectCoverageFrom`; many route/middleware modules have no measured coverage yet.

## Next Tranche Test Targets

- Prioritize branch tests for `dashboard-stub-api` route handlers and fallback branches.
- Add explicit negative-path tests for auth and public-route gating in `phase2-integration`.
- Add parser/error-shape tests for `npm-audit-runner` to harden security telemetry behavior.
