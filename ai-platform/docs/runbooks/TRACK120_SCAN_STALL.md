# Runbook: Track120ScanStall

**Alert**: `Track120ScanStall`
**Severity**: `warning`
**Counter(s)**: `hsm_reconciliation_scans_total`

## Summary

No reconciliation scans have been performed over the last 10 minutes

## Description

The reconciliation scan engine has stopped running. This indicates possible reconciliation engine failure, scheduler deadlock, or process termination on the responsible node.

## Triage Steps

1. Check if the reconciliation scheduler process is still running on the lead node
2. Verify that the scan interval configuration has not been changed or corrupted
3. Inspect the system logs for any process crashes or out-of-memory events on the lead node
4. Check if the reconciliation engine is blocked waiting on a resource lock
5. Review recent deployments or configuration changes that may have affected the scheduler

## Mitigation Steps

1. If the scheduler process has crashed, restart it on the lead node
2. Run: npx simplebeacon scan --full --gate --format json to check cluster health
3. If the scheduler is deadlocked, clear the resource lock and restart the engine
4. Contact the HSM mesh vault on-call engineer if scans do not resume within 5 minutes of restart
