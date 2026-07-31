# Test Plan: Phase 4 — Standardized Error Response Helper

**Date:** 2026-07-31
**Branch:** main
**Feature:** Create shared `sendError`/`sendSuccess` helpers and apply
to the top 3 highest-impact route files (179 responses, 39.8% of total).

## Context

The error response audit found:
- 450 total error responses across 35 route files
- 6 different format patterns
- Dominant: `{ success: false, error: '...' }` (48.2%, 217 responses)
- Second: `{ error: '...' }` no message (18.4%, 83 responses)
- Third: `{ error: 'code', message: '...' }` (16.7%, 75 responses)

The third pattern carries MORE information (error code + message) than
the dominant pattern. The helper must support all patterns without
losing information.

## Design

### Target format (backward-compatible superset)
```javascript
{
  success: false,
  error: 'error_message_or_code',
  message: 'optional details',     // optional
  code: 'optional_machine_code',   // optional
  details: 'optional debug info'   // optional
}
```

### Helper API
```javascript
// Simple: sendError(res, 500, 'Failed to fetch')
// → { success: false, error: 'Failed to fetch' }

// With message: sendError(res, 500, 'stats_failed', { message: err.message })
// → { success: false, error: 'stats_failed', message: err.message }

// With code: sendError(res, 400, 'Invalid input', { code: 'VALIDATION_ERROR' })
// → { success: false, error: 'Invalid input', code: 'VALIDATION_ERROR' }
```

## Scope

This commit covers the top 3 files (179 responses, 39.8%):
1. `flexible-analyze-api.cjs` — 65 responses (mixed formats)
2. `analytics-routes.cjs` — 58 responses (`{ error: 'code', message: '...' }`)
3. `admin-api.cjs` — 56 responses (already `{ success: false, error: '...' }`)

Remaining 32 files (271 responses) deferred to future commits.

## Files to Change

### New file (1)
| File | Purpose |
|------|---------|
| `server/lib/response-helpers.cjs` | `sendError` + `sendSuccess` helpers |

### Edits (3 files)
| File | Responses | Current Format | Change |
|------|-----------|----------------|-------|
| `flexible-analyze-api.cjs` | 65 | Mixed | Import helper, replace all error responses |
| `analytics-routes.cjs` | 58 | `{ error: 'code', message: '...' }` | Import helper, replace with `sendError(res, N, 'code', { message })` |
| `admin-api.cjs` | 56 | `{ success: false, error: '...' }` | Import helper, replace with `sendError(res, N, '...')` |

## Objective Check-Items

### Level 1 — Deterministic

| # | Item | Expected |
|---|------|----------|
| L1.1 | `node -c` on all 4 files (1 new + 3 edited) | exit 0 |
| L1.2 | `npx simplebeacon scan --gate` (local CLI) | PASS (exit 0) |
| L1.3 | WebSocket integration test | 16/16 pass |

### Level 2 — Behavioral

| # | Item | Expected |
|---|------|----------|
| L2.1 | Error responses include `success: false` | All 179 responses |
| L2.2 | Error responses include `error` field | All 179 responses |
| L2.3 | analytics-routes preserves `message` field | `sendError(res, N, 'code', { message })` |
| L2.4 | Existing API clients unaffected | Same status codes + body fields |

### Level 3 — Self-review / drift

| # | Item | Expected |
|---|------|----------|
| L3.1 | Only 1 new file created | Broom strategy |
| L3.2 | No new dependencies | Pure JS |
| L3.3 | No information lost | `message` field preserved where it existed |
| L3.4 | Remaining 32 files documented | Deferred to future commits |
