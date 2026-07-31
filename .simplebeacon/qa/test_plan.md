# Test Plan: Playwright E2E Fix + Whitelabel E2E + Analytics Seed

**Date:** 2026-07-31
**Branch:** main
**Features:** 
1. Fix 4 Playwright E2E failures (base path routing)
2. Whitelabel brand injection E2E verification
3. Seed usage analytics data via seed-analytics.cjs

## Objective Check-Items

### Level 1 — Deterministic (required)

| # | Item | Command | Pass Criteria |
|---|------|---------|---------------|
| L1.1 | Playwright installed | `npm ls @playwright/test` in dashboard | Listed in devDependencies |
| L1.2 | All smoke tests pass | `npx playwright test e2e/smoke.spec.ts` | 9 passed |
| L1.3 | All whitelabel tests pass | `npx playwright test e2e/whitelabel.spec.ts` | 6 passed, 2 skipped |
| L1.4 | Full suite passes | `npx playwright test` | 15 passed, 2 skipped |
| L1.5 | Gate scan passes | `npx simplebeacon scan --gate` | Exit 0 |
| L1.6 | Analytics store has data | `node -e` check store | 868 scans, 4 orgs |
| L1.7 | getGlobalStats returns data | `node -e` check | totalScans > 0 |
| L1.8 | getTrendData returns data | `node -e` check | trend.length > 0 |
| L1.9 | getViolationHeatmap returns data | `node -e` check | heatmap.length > 0 |
| L1.10 | getTopRepositories returns data | `node -e` check | repos.length > 0 |

### Level 2 — Behavioral

| # | Item | Method | Pass Criteria |
|---|------|--------|---------------|
| L2.1 | Smoke tests navigate to /dashboard/ base | Check test URLs | All use /dashboard/ prefix |
| L2.2 | webServer auto-starts Vite | playwright.config.ts | Has webServer config |
| L2.3 | Brand CSS injection creates style element | Playwright test | #whitelabel-brand-css attached |
| L2.4 | CSS variables accessible via getComputedStyle | Playwright test | Returns correct values |
| L2.5 | Document title updates with brand | Playwright test | Title contains productName |
| L2.6 | window.__SIMPLEBEACON_BRAND__ set via initScript | Playwright test | Global accessible |
| L2.7 | customCss appended after CSS variables | Playwright test | CSS contains custom rules |
| L2.8 | Favicon link updates | Playwright test | href matches |

### Level 3 — Self-review / Drift

| # | Item | Pass Criteria |
|---|------|---------------|
| L3.1 | No new dependencies beyond @playwright/test | package.json checked |
| L3.2 | Pre-existing TS errors not introduced by changes | IntegrationsView/OrganizationView errors pre-existing |
| L3.3 | seed-analytics.cjs not modified | Existing script used as-is |
| L3.4 | analytics-routes.cjs not modified | Existing routes work with seeded data |
| L3.5 | BrandContext.tsx debug log removed | No console.log in production code |

## Files Changed

| File | Action | Purpose |
|------|--------|---------|
| `ai-platform/web/simplebeacon-dashboard/package.json` | MODIFIED | Add @playwright/test devDep + test:e2e scripts |
| `ai-platform/web/simplebeacon-dashboard/playwright.config.ts` | MODIFIED | Fix baseURL, add webServer config |
| `ai-platform/web/simplebeacon-dashboard/e2e/smoke.spec.ts` | MODIFIED | Fix all navigation paths for /dashboard/ base |
| `ai-platform/web/simplebeacon-dashboard/e2e/whitelabel.spec.ts` | NEW | Brand CSS injection + API endpoint tests |
| `ai-platform/web/simplebeacon-dashboard/src/contexts/BrandContext.tsx` | MODIFIED | Remove temporary debug log |
| `ai-platform/.simplebeacon/usage-analytics.json` | NEW (data) | 868 seeded scans across 4 orgs |
