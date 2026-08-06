# Runbook: Track114LatticeVssReconciliationStall

**Alert**: `Track114LatticeVssReconciliationStall`
**Severity**: `critical`
**Counter(s)**: `hsm_vssgate_pool_initialized_total, hsm_vss_accreditation_completed_total`

## Summary

Track 114 lattice VSS reconciliation has stalled

## Description

VSS gating pools are being initialized but accreditations are not completing, indicating possible ZK proof evaluation failure.

## Triage Steps

1. Check VSS gating logs for accreditation errors
2. Verify ZK proof evaluation engine is running
3. Inspect hsm_vss_accreditation_completed_total counter
4. Check for polynomial degree bound violations

## Mitigation Steps

1. Pause new operations until the alert clears
2. Run: `npx simplebeacon scan --full --gate --format json` to check cluster health
3. If a specific node is causing issues, isolate it and retry
4. Contact the HSM mesh vault on-call engineer if the alert persists beyond 10 minutes
