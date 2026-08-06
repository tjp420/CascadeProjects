# Runbook: ShardRepairStallDetected

**Alert**: `ShardRepairStallDetected`
**Severity**: `critical`
**Counter(s)**: `hsm_shard_reconciler_repair_requested_total, hsm_repair_worker_completed_total`

## Summary

Shard repair requests are not being completed

## Description

Shard repair requests are being issued but repairs are not completing, indicating possible repair worker failure or shard corruption.

## Triage Steps

1. Check shard repair worker logs for errors
2. Verify repair worker process is running
3. Inspect hsm_repair_worker_completed_total counter
4. Check for shard storage backend issues

## Mitigation Steps

1. Pause new operations until the alert clears
2. Run: `npx simplebeacon scan --full --gate --format json` to check cluster health
3. If a specific node is causing issues, isolate it and retry
4. Contact the HSM mesh vault on-call engineer if the alert persists beyond 10 minutes
