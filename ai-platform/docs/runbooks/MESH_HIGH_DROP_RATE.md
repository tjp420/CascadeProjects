# Runbook: MeshReconciliationHighDropRate

**Alert**: `MeshReconciliationHighDropRate`
**Severity**: `critical`
**Counter(s)**: `hsm_meshgate_challenge_issued_total`

## Summary

Mesh reconciliation drop rate is too high

## Description

Mesh challenges are being issued but dropped at a high rate, indicating possible enclave overload or network partition.

## Triage Steps

1. Check mesh gate logs for dropped challenge reasons
2. Verify enclave resource utilization
3. Inspect network connectivity between mesh nodes
4. Check if any nodes were recently removed from the mesh

## Mitigation Steps

1. Pause new operations until the alert clears
2. Run: `npx simplebeacon scan --full --gate --format json` to check cluster health
3. If a specific node is causing issues, isolate it and retry
4. Contact the HSM mesh vault on-call engineer if the alert persists beyond 10 minutes
