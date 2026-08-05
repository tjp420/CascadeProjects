# Runbook: MeshStateReconciliationStall

**Alert**: `MeshStateReconciliationStall`
**Severity**: `critical`
**Counter(s)**: `hsm_zk_mesh_state_reconciled_total, hsm_meshgate_pool_initialized_total`

## Summary

Mesh state reconciliation has stalled

## Description

Mesh pools are being initialized but state reconciliation is not completing, indicating possible ZK proof verification deadlock.

## Triage Steps

1. Check ZK proof verification logs for errors
2. Verify that all mesh participants are online
3. Inspect hsm_meshgate_pool_initialized_total for pool initialization rate
4. Check for lock contention in the reconciliation engine

## Mitigation Steps

1. Pause new operations until the alert clears
2. Run: `npx simplebeacon scan --full --gate --format json` to check cluster health
3. If a specific node is causing issues, isolate it and retry
4. Contact the HSM mesh vault on-call engineer if the alert persists beyond 10 minutes
