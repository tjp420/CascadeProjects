# Test Plan: Phase 5 — Error Logging Standardization

**Date:** 2026-07-31
**Branch:** main
**Feature:** Add logger calls to catch blocks that send error responses without logging.

## Context

The audit found 46 catch blocks across 9 route files that call `sendError()` to send an error response to the client but do NOT log the error server-side. This makes debugging production issues impossible — the client sees an error but the server has no record of what went wrong.

## Changes

For each silent catch block, add a `logger.warn(...)` or `logger.error(...)` call before the `sendError(...)` call. The pattern to follow:

```javascript
// Before (silent):
} catch (err) {
  return sendError(res, 500, 'operation_failed', { message: err.message });
}

// After (logged):
} catch (err) {
  logger.warn('[ModuleName] operation failed:', err.message);
  return sendError(res, 500, 'operation_failed', { message: err.message });
}
```

## Files to Change (9 files, 46 catch blocks)

| File | Silent Catches | Has Logger Import? |
|------|---------------|-------------------|
| model-eval-routes.cjs | 9 | yes |
| alert-routes.cjs | 8 | TBD |
| demo-simplebeacon-api.cjs | 8 | NO — need to add |
| whitelabel-routes.cjs | 8 | yes |
| deployment-gate-routes.cjs | 4 | yes |
| audit-routes.cjs | 3 | yes |
| guardrail-routes.cjs | 3 | TBD |
| sso-config-routes.cjs | 2 | yes |
| ai-context-routes.cjs | 1 | yes |

## Objective Check-Items

### Level 1 — Deterministic

| # | Item | Expected |
|---|------|----------|
| L1.1 | `node -c` on all 9 changed files | exit 0 |
| L1.2 | `npx simplebeacon scan --gate` | PASS (exit 0) |
| L1.3 | WebSocket integration test | 16/16 pass |

### Level 2 — Behavioral

| # | Item | Expected |
|---|------|----------|
| L2.1 | Error responses still work correctly | Same status codes and response bodies |
| L2.2 | Server logs now contain error details | logger.warn/error calls visible in server output |

### Level 3 — Self-review / drift

| # | Item | Expected |
|---|------|----------|
| L3.1 | No response format changes | sendError calls unchanged |
| L3.2 | No new files created | Only edits to existing files |
| L3.3 | No new dependencies | Uses existing logger module |
