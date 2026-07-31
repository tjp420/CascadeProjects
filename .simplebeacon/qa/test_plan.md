# Test Plan: Route Parameter Validation — Defense-in-Depth

**Date:** 2026-07-31
**Branch:** main
**Feature:** Add shared `validateParam` middleware to enforce format
validation on 17 route parameters across 7 route files.

## Context

The Phase 3 investigation confirmed all 17 endpoints are LOW risk —
no SQL injection or path traversal vulnerabilities. All params are
used as object/Map keys or parameterized SQL query values.

However, adding format validation provides:
- **Defense-in-depth** — fail fast on malformed input
- **Better error messages** — 400 with clear format hint vs 404/500
- **API consistency** — all params validated to expected formats
- **Reduced log noise** — malformed requests rejected before hitting stores

## Validation Patterns

| Param | Pattern | Format | Files |
|-------|---------|--------|-------|
| `orgId` | `^[a-zA-Z0-9_-]{1,100}$` | Alphanumeric slug | analytics-routes, sso-config-routes |
| `partnerId` | `^wl-[a-f0-9]{8}$` | `wl-` + 8 hex | whitelabel-routes (×6) |
| `configId` | `^int-[a-f0-9]{8}$` | `int-` + 8 hex | integration-routes (×3) |
| `providerId` | `^sso-[a-f0-9]{8}$` | `sso-` + 8 hex | sso-config-routes (×5) |
| `id` (admin) | `^[a-zA-Z0-9_-]{1,100}$` | User ID slug | admin-api (×1) |
| `provider` | `^[a-z]{3,20}$` | Lowercase provider name | sso-routes (×2) |
| `id` (workspaces) | `^[a-f0-9-]{36}$` | UUID | workspaces (×3) |

## Files to Change

### New file (1)
| File | Purpose |
|------|---------|
| `server/middleware/validate-params.cjs` | Shared `validateParam` middleware + `VALIDATION_PATTERNS` |

### Edits (7 files)
| File | Endpoints | Change |
|------|-----------|--------|
| `server/routes/analytics-routes.cjs` | 1 | Add `validateParam('orgId', ...)` to `GET /org/:orgId` |
| `server/routes/whitelabel-routes.cjs` | 6 | Add `validateParam('partnerId', ...)` to all `:partnerId` routes |
| `server/routes/integration-routes.cjs` | 3 | Add `validateParam('configId', ...)` to all `:configId` routes |
| `server/routes/sso-config-routes.cjs` | 6 | Add `validateParam` for `:orgId` and `:providerId` routes |
| `server/routes/admin-api.cjs` | 1 | Add `validateParam('id', ...)` to `GET /users/:id/details` |
| `server/routes/sso-routes.cjs` | 2 | Add `validateParam('provider', ...)` to login + metadata |
| `server/routes/workspaces.cjs` | 3 | Add `validateParam('id', ...)` to GET, PATCH, DELETE |

## Objective Check-Items

### Level 1 — Deterministic

| # | Item | Expected |
|---|------|----------|
| L1.1 | `node -c` on all 8 files (1 new + 7 edited) | exit 0 |
| L1.2 | `npx simplebeacon scan --gate` (local CLI) | PASS (exit 0) |
| L1.3 | WebSocket integration test | 16/16 pass |

### Level 2 — Behavioral

| # | Item | Expected |
|---|------|----------|
| L2.1 | `GET /api/analytics/org/valid-org-1` | 200 (valid format) |
| L2.2 | `GET /api/analytics/org/../../etc/passwd` | 400 (invalid format) |
| L2.3 | `GET /api/analytics/org/<script>alert(1)</script>` | 400 (invalid format) |
| L2.4 | `GET /api/whitelabel/partners/wl-abcdef12` | 200 or 404 (valid format) |
| L2.5 | `GET /api/whitelabel/partners/invalid-id` | 400 (invalid format) |
| L2.6 | Valid UUID passes workspaces validation | `^[a-f0-9-]{36}$` accepted |

### Level 3 — Self-review / drift

| # | Item | Expected |
|---|------|----------|
| L3.1 | Only 1 new file created (middleware) | Broom strategy — minimal new files |
| L3.2 | No new dependencies | Uses built-in RegExp |
| L3.3 | Validation runs before route handler | Middleware order: validate → handler |
| L3.4 | Error response format consistent | `{ error: 'invalid_parameter', message, paramName }` |
| L3.5 | Existing valid requests unaffected | Valid format params pass through normally |
