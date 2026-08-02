# Test Plan — Track 34 Phase 8: Consensus Telemetry Dashboard

**Branch:** `feature/track34-telemetry-dashboard`
**Date:** 2026-08-02
**Status:** Retroactive (hotfix per QA framework)

## Objective

Expose the rich array of consensus Prometheus metrics (leadership states, anti-replay drops, snapshot compaction events, outbound signing counters) to the frontend Analytical Dashboard, bridging the gap between the back-end distributed engine and real-time operational visibility.

## Change Set

| File | Change |
|------|--------|
| `server/routes/hsm-vault-routes.cjs` | New `GET /api/vault/consensus/status` endpoint — returns JSON with engine state + all consensus counters |
| `server/lib/hsm-adapter/base-adapter.cjs` | New `registerConsensusEngine()` / `getConsensusEngine()` module-level registry. Auto-registers when adapter receives a `consensusEngine` option. Exported in `module.exports`. |
| `web/simplebeacon-dashboard/src/views/PlatformView.tsx` | New Consensus Telemetry card — fetches `/api/vault/consensus/status`, displays engine state (node role, term, commit index, log length, cluster size), leader info, snapshot info, and all counters in a reactive grid |
| `server/lib/__tests__/hsm-vault-consensus-status.test.cjs` | 12 new tests |

## Check Items

### Level 1 — Deterministic (required)

- [x] **L1.1** `node -c hsm-vault-routes.cjs` — syntax pass
- [x] **L1.2** `node -c base-adapter.cjs` — syntax pass
- [x] **L1.3** `node -c hsm-vault-consensus-status.test.cjs` — syntax pass
- [x] **L1.4** `npx tsc --noEmit` (simplebeacon-dashboard) — TypeScript compiles clean
- [x] **L1.5** `npm test` (ai-platform) — 246 suites pass, 2684 tests pass
- [x] **L1.6** No new dependencies added
- [x] **L1.7** No secrets/keys committed

### Level 2 — Behavioral

- [x] **L2.1** Returns 200 with JSON consensus state for admin
- [x] **L2.2** Includes all 21 expected consensus counter names
- [x] **L2.3** Returns engine state when consensus engine is registered
- [x] **L2.4** Returns null engine when no engine is registered
- [x] **L2.5** Returns 403 for non-admin users
- [x] **L2.6** Returns 403 without user context
- [x] **L2.7** Counters only include `hsm_consensus_` prefixed keys
- [x] **L2.8** Handles engine without getState gracefully
- [x] **L2.9** Timestamp is recent (within 5 seconds)
- [x] **L2.10** registerConsensusEngine / getConsensusEngine registry works
- [x] **L2.11** registerConsensusEngine(null) clears the registry
- [x] **L2.12** Frontend TypeScript compiles with new ConsensusStatus types

### Level 3 — Self-review / drift

- [x] **L3.1** No scope creep — only telemetry exposure added
- [x] **L3.2** No ghost files
- [x] **L3.3** All 162 existing Track 34 tests still pass (no regression)
- [x] **L3.4** Endpoint follows existing route patterns (authorize, runAsync, sendError)
- [x] **L3.5** Frontend card follows existing PlatformView patterns (Card, Badge, fetch)
- [x] **L3.6** Engine registry is module-level, auto-registers in constructor

## Pre-existing Failures (not caused by this change)

| Suite | Cause |
|-------|-------|
| `hsm-vault-throttle.test.cjs` | Pre-existing |
| `hub-smoke.test.js` | Pre-existing |
| `dashboard-auth.test.cjs` | Pre-existing |
