# Test Plan: Whitelabel Sub-Domain Routing Matrix

**Date:** 2026-07-31
**Branch:** main
**Feature:** Domain-aware middleware + BrandContext provider for reseller branding

## Objective Check-Items

### Level 1 — Deterministic (required)

| # | Item | Command | Pass Criteria |
|---|------|---------|---------------|
| L1.1 | Middleware syntax valid | `node -c ai-platform/server/lib/whitelabel-middleware.cjs` | Exit 0 |
| L1.2 | Server index syntax valid | `node -c ai-platform/server/index.cjs` | Exit 0 |
| L1.3 | BrandContext TS compiles | `npx tsc --noEmit --skipLibCheck` in dashboard | No errors for BrandContext.tsx |
| L1.4 | App.tsx TS compiles | `npx tsc --noEmit --skipLibCheck` in dashboard | No errors for App.tsx |
| L1.5 | SimpleBeacon gate scan passes | `npx simplebeacon scan --gate` | Exit 0 |
| L1.6 | Middleware resolves partner by domain | `node -e` test | Returns partner object |
| L1.7 | Middleware resolves partner by subdomain | `node -e` test | Returns partner object |
| L1.8 | Middleware falls back to default brand | `node -e` test | Returns DEFAULT_BRAND |
| L1.9 | extractSubdomain handles edge cases | `node -e` test | null for base domain, prefix for subdomain |

### Level 2 — Behavioral

| # | Item | Method | Pass Criteria |
|---|------|--------|---------------|
| L2.1 | Brand CSS variables injected into HTML | Inspect `buildBrandInjection()` output | Contains `:root { --brand-primary: ... }` |
| L2.2 | BrandProvider applies CSS at runtime | Component renders without error | No React errors |
| L2.3 | useBrand hook returns default brand | Component test | brand.productName === 'SimpleBeacon' |
| L2.4 | Favicon updated when provided | DOM check | link[rel=icon] href matches |
| L2.5 | Document title updated for whitelabeled partner | DOM check | title contains partner productName |

### Level 3 — Self-review / Drift

| # | Item | Pass Criteria |
|---|------|---------------|
| L3.1 | No ghost files referenced | All imports resolve to real files |
| L3.2 | No new dependencies added | package.json unchanged |
| L3.3 | Existing whitelabel-config-store.cjs NOT modified | git diff shows no changes |
| L3.4 | Existing whitelabel-routes.cjs NOT modified | git diff shows no changes |
| L3.5 | Middleware never blocks request on error | Error path calls next() |

## Files Changed

| File | Action | Purpose |
|------|--------|---------|
| `ai-platform/server/lib/whitelabel-middleware.cjs` | NEW | Domain resolution middleware + brand injection helper |
| `ai-platform/web/simplebeacon-dashboard/src/contexts/BrandContext.tsx` | NEW | React context provider + useBrand hook |
| `ai-platform/server/index.cjs` | MODIFIED | Mount middleware + inject brand into dashboard HTML |
| `ai-platform/web/simplebeacon-dashboard/src/App.tsx` | MODIFIED | Wrap app with BrandProvider |

## Routes/Endpoints

- Existing: `GET /api/whitelabel/resolve?domain=...` (unchanged)
- Existing: `GET /api/whitelabel/brand.css?domain=...` (unchanged)
- New: Middleware runs on ALL requests, sets `req.brand` and `req.whitelabelPartner`
- New: Dashboard HTML includes `window.__SIMPLEBEACON_BRAND__` injection
