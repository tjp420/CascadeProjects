# Test Plan — Sparkline Ring-Buffer Refinement

**Branch:** `feature/sparkline-ring-buffer`
**Date:** 2026-08-02
**Status:** Active

## Objective

Add client-side ring-buffer accumulation and inline SVG sparkline rendering to all 3 telemetry dashboards (CoreReplication, Drop, Enclave), enabling trend visualization without backend changes or new time-series endpoints.

## Change Set

| File | Change |
|------|--------|
| web/dashboard/js-es2018/utils/sparkline.js | New — createRingBuffer() + renderSparkline() SVG utility |
| web/dashboard/js-es2018/services/replicationTelemetryService.js | Added ring buffer + getReplicationHistory() |
| web/dashboard/js-es2018/services/dropTelemetryService.js | Added ring buffer + getDropHistory() |
| web/dashboard/js-es2018/services/enclaveTelemetryService.js | Added ring buffer + getEnclaveHistory() |
| web/dashboard/js-es2018/components/CoreReplicationTelemetryDashboard.js | Sparkline in each metric chip |
| web/dashboard/js-es2018/components/DropTelemetryDashboard.js | Sparkline in each metric chip |
| web/dashboard/js-es2018/components/EnclaveTelemetryDashboard.js | Sparkline in each metric chip |
| web/dashboard/css/components.css | Added .sparkline CSS |
| .simplebeacon/qa/test_plan.md | Updated |
| .simplebeacon/qa/software_health_report.md | Updated |

## Design

- Ring buffer: MAX_SAMPLES=60 per counter (30min @ 30s for replication, 10min @ 10s for drop, 15min @ 15s for enclave)
- Sparkline: 60x20px inline SVG with area fill, line path, and current-value dot
- Graceful degradation: sparkline hidden when < 2 samples; only current value shown
- No backend changes, no new dependencies, no localStorage (v1)

## Check Items

### Level 1 - Deterministic
- [x] L1.1 node -c all 7 JS files - PASS
- [x] L1.2 87 existing tests pass (no regression)
- [x] L1.3 No new dependencies

### Level 2 - Functional
- [x] L2.01 sparkline.js exports createRingBuffer() and renderSparkline()
- [x] L2.02 Ring buffer accumulates samples on each fetch
- [x] L2.03 Sparkline renders when >= 2 samples available
- [x] L2.04 Sparkline hidden when < 2 samples (graceful degradation)
- [x] L2.05 All 3 dashboards render sparklines in metric chips
- [x] L2.06 SVG includes area fill, line path, and current-value dot

### Level 3 - Security
- [x] L3.01 No secrets exposed
- [x] L3.02 No scope creep
- [x] L3.03 No regression
