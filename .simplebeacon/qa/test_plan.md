# Test Plan — Dashboard UI Integration

**Branch:** `feature/dashboard-ui-integration`
**Date:** 2026-08-02
**Status:** Active

## Objective

Wire CoreReplicationTelemetryDashboard and DropTelemetryDashboard into AdminPanelView to complete the end-to-end observability loop.

## Change Set

| File | Change |
|------|--------|
| web/dashboard/js-es2018/services/replicationTelemetryService.js | Fixed (was placeholder) |
| web/dashboard/js-es2018/components/CoreReplicationTelemetryDashboard.js | Fixed (was placeholder) |
| web/dashboard/js-es2018/services/dropTelemetryService.js | New |
| web/dashboard/js-es2018/components/DropTelemetryDashboard.js | New |
| web/dashboard/js-es2018/views/AdminPanelView.js | Add imports + telemetry section + mountTelemetryDashboards() |
| web/dashboard/css/components.css | Add .admin-telemetry-grid CSS |

## Check Items

### Level 1 - Deterministic
- [x] L1.1 node -c all 5 JS files - PASS
- [x] L1.2 All 92 existing tests pass (no regression)
- [x] L1.3 No new dependencies

### Level 2 - Functional
- [x] L2.01 AdminPanelView imports both dashboard components
- [x] L2.02 Telemetry section rendered between stats and admin-layout
- [x] L2.03 mountTelemetryDashboards() mounts both dashboards into grid
- [x] L2.04 CoreReplicationTelemetryDashboard fetches from /api/vault/replication/status
- [x] L2.05 DropTelemetryDashboard reads client-side counters
- [x] L2.06 CSS grid layout for responsive dashboard panels

### Level 3 - Security
- [x] L3.01 No secrets exposed
- [x] L3.02 No scope creep
- [x] L3.03 No regression
