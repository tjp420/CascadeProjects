# Runbook: ShardOutOfSyncFlood

**Alert**: `ShardOutOfSyncFlood`
**Severity**: `warning`
**Counter(s)**: `hsm_shard_out_of_sync_total`

## Summary

Shard out-of-sync events are flooding

## Description

Shards are being marked out-of-sync at an elevated rate, indicating possible cluster divergence or network partition.

## Triage Steps

1. Check shard sync logs for out-of-sync reasons
2. Verify cluster nodes are in network contact
3. Inspect hsm_shard_out_of_sync_total counter
4. Check for recent cluster topology changes

## Mitigation Steps

1. Pause new operations until the alert clears
2. Run: `npx simplebeacon scan --full --gate --format json` to check cluster health
3. If a specific node is causing issues, isolate it and retry
4. Contact the HSM mesh vault on-call engineer if the alert persists beyond 10 minutes
