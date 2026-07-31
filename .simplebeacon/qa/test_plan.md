# Test Plan: Backend Phase 1 — Patch File Cleanup + Query Parameter Bounds Checking

**Date:** 2026-07-31
**Branch:** main
**Feature:** Delete 12 unreferenced `.patch-fix` files from server/ and
add bounds checking to query parameters to prevent DoS via large limit values.

## Context

The backend audit found 23 issues across 45+ route files. Phase 1
addresses the safest high-impact wins:

1. **Patch file cleanup**: 12 `.patch-fix` files in server/ are tracked
   in git but never referenced (grep confirmed 0 require/import matches).
   Same pattern as the frontend Phase 1 cleanup.

2. **Query parameter bounds checking**: 9 occurrences of
   `parseInt(req.query.limit, 10) || N` with no max value. A malicious
   client can request `?limit=999999999` to cause memory exhaustion.
   Fix: wrap each in `Math.min(Math.max(..., 1), MAX_LIMIT)`.

3. **Deferred items** (not in this commit):
   - Auth route consolidation (4 files with duplicate endpoints) —
     requires careful client migration
   - Route parameter validation (7 occurrences) — needs per-route
     format analysis
   - Response format standardization — large refactor across 50+ files
   - Try/catch blocks — needs per-route analysis

## Files to Change

### Deletions (12 files)
| File | Reason |
|------|--------|
| `server/ai-proxy-gateway.cjs.patch-fix` | Unreferenced patch artifact |
| `server/dlp-dashboard.cjs.patch-fix` | Unreferenced patch artifact |
| `server/lib/ai-analyst.cjs.patch-fix` | Unreferenced patch artifact |
| `server/lib/compliance-rules.cjs.patch-fix` | Unreferenced patch artifact |
| `server/lib/enhanced-ai-orchestrator.cjs.patch-fix` | Unreferenced patch artifact |
| `server/lib/recoverable-io.cjs.patch-fix` | Unreferenced patch artifact |
| `server/lib/user-ai-keys-store.cjs.patch-fix` | Unreferenced patch artifact |
| `server/routes/flexible-analyze-api.cjs.patch-fix` | Unreferenced patch artifact |
| `server/services/cloud-inference-service.cjs.patch-fix` | Unreferenced patch artifact |
| `server/services/enhanced-model-manager.cjs.patch-fix` | Unreferenced patch artifact |
| `server/test-gateway.js.patch-fix` | Unreferenced patch artifact |
| `server/utils/data-processor.cjs.patch-fix` | Unreferenced patch artifact |

### Edits (bounds checking)
| File | Lines | Change |
|------|-------|--------|
| `server/routes/analytics-routes.cjs` | 177-178, 230, 242, 351-352 | Add Math.min/max bounds |
| `server/routes/enterprise-analytics-routes.cjs` | 21, 34 | Add Math.min/max bounds |
| `server/routes/admin-api.cjs` | 435, 445 | Add Math.min/max bounds |

## Objective Check-Items

### Level 1 — Deterministic

| # | Item | Expected |
|---|------|----------|
| L1.1 | `npx simplebeacon scan --gate` | PASS (exit 0) |
| L1.2 | WebSocket integration test still passes | 16/16 pass |
| L1.3 | No imports reference deleted patch files | grep returns 0 matches |
| L1.4 | `node -c` on all edited route files | exit 0 |

### Level 2 — Behavioral

| # | Item | Expected |
|---|------|----------|
| L2.1 | `?limit=999999` returns max 1000 items | Bounds enforced |
| L2.2 | `?limit=0` returns at least 1 item | Lower bound enforced |
| L2.3 | `?limit=50` (default) returns 50 items | Default unchanged |
| L2.4 | `?days=999999` returns max 365 days | Days bounded |

### Level 3 — Self-review / drift

| # | Item | Expected |
|---|------|----------|
| L3.1 | No new files created | Only deletions + inline edits |
| L3.2 | No new dependencies | Uses Math.min/max (built-in) |
| L3.3 | Bounds are reasonable for each endpoint | 1000 for lists, 365 for days |
| L3.4 | Auth route consolidation deferred | Documented in health report |
