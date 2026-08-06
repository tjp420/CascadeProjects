# Runbook: MeshEpochFinalityStall

**Alert**: `MeshEpochFinalityStall`
**Severity**: `warning`
**Counter(s)**: `hsm_epoch_finality_completed_total, hsm_zk_mesh_state_reconciled_total`

## Summary

Mesh epoch finality has stalled

## Description

Mesh state reconciliations are completing but epoch finality is not progressing, indicating possible finality engine failure.

## Triage Steps

1. Check epoch finality engine logs
2. Verify that epoch finality workers are running
3. Inspect hsm_epoch_finality_completed_total counter
4. Check for stuck finality votes

## Mitigation Steps

1. Pause new operations until the alert clears
2. Run: `npx simplebeacon scan --full --gate --format json` to check cluster health
3. If a specific node is causing issues, isolate it and retry
4. Contact the HSM mesh vault on-call engineer if the alert persists beyond 10 minutes
