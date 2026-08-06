# Runbook: MeshReconciliationBoundaryDrift

**Alert**: `MeshReconciliationBoundaryDrift`
**Severity**: `warning`
**Counter(s)**: `hsm_meshgate_challenge_issued_total, hsm_zk_mesh_state_reconciled_total`

## Summary

Mesh reconciliation boundary drift detected

## Description

The rate of mesh state reconciliation challenges is drifting relative to reconciliations, indicating possible boundary mismatch between enclave partitions.

## Triage Steps

1. Check mesh reconciliation logs for boundary mismatch errors
2. Verify enclave partition state across all nodes
3. Inspect hsm_zk_mesh_state_reconciled_total counter for stalls
4. Check network latency between mesh participants

## Mitigation Steps

1. Pause new operations until the alert clears
2. Run: `npx simplebeacon scan --full --gate --format json` to check cluster health
3. If a specific node is causing issues, isolate it and retry
4. Contact the HSM mesh vault on-call engineer if the alert persists beyond 10 minutes
