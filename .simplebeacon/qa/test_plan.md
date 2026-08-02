# Test Plan — Enclave Telemetry Card Integration

**Branch:** `feature/enclave-telemetry-card`
**Date:** 2026-08-02
**Status:** Active

## Objective

Wire EnclaveTelemetryDashboard into AdminPanelView to expose the 10 Track 41 enclave counters via the admin panel, completing the end-to-end observability loop for hardware enclave isolation.

## Change Set

| File | Change |
|------|--------|
| web/dashboard/js-es2018/services/enclaveTelemetryService.js | New — fetches GET /api/vault/enclave/status |
| web/dashboard/js-es2018/components/EnclaveTelemetryDashboard.js | New — renders 10 counters + enclave state banner |
| web/dashboard/js-es2018/views/AdminPanelView.js | Added import + mount in mountTelemetryDashboards() |
| web/dashboard/css/components.css | Added severity chip + enclave state banner CSS |
| .simplebeacon/qa/test_plan.md | Updated |
| .simplebeacon/qa/software_health_report.md | Updated |

## 10 Counters with Severity Logic

| Counter | Label | Severity |
|---------|-------|----------|
| hsm_enclave_bootstrap_total | Bootstrap OK | positive (green if >0) |
| hsm_enclave_bootstrap_failed_total | Bootstrap Fail | danger (red if >0) |
| hsm_enclave_seal_total | Sealed | positive |
| hsm_enclave_unseal_total | Unsealed | positive |
| hsm_enclave_unseal_failed_total | Unseal Fail | danger |
| hsm_enclave_key_provisioned_total | Keys Provisioned | positive |
| hsm_enclave_key_provision_blocked_total | Provision Blocked | warning (amber if >0) |
| hsm_enclave_attestation_verified_total | Attestation OK | positive |
| hsm_enclave_attestation_rejected_total | Attestation Rejected | danger |
| hsm_enclave_active | Active Enclaves | active (green if >0, amber if 0) |

## Check Items

### Level 1 - Deterministic
- [x] L1.1 node -c all 3 JS files - PASS
- [x] L1.2 79 existing tests pass (no regression)
- [x] L1.3 No new dependencies

### Level 2 - Functional
- [x] L2.01 enclaveTelemetryService fetches /api/vault/enclave/status
- [x] L2.02 EnclaveTelemetryDashboard renders 10 counter chips
- [x] L2.03 Enclave state banner shows backend, mrenclave, initialized status
- [x] L2.04 Severity colors: green/amber/red based on counter values
- [x] L2.05 15s auto-refresh interval
- [x] L2.06 Graceful handling of unavailable/forbidden/error states
- [x] L2.07 AdminPanelView mounts enclave dashboard in telemetry grid

### Level 3 - Security
- [x] L3.01 No secrets exposed
- [x] L3.02 No scope creep
- [x] L3.03 No regression
