# Runbook: Track117ShardSyncLaggingNodesSpike

**Alert**: `Track117ShardSyncLaggingNodesSpike`
**Severity**: `warning`
**Counter(s)**: `hsm_shard_lagging_nodes`

## Summary

Shard sync lagging nodes are spiking

## Description

The number of nodes lagging behind in shard synchronization is spiking, indicating possible network issues or node overload.

## Triage Steps

1. Check shard sync logs for lagging node details
2. Verify network connectivity to lagging nodes
3. Inspect hsm_shard_lagging_nodes gauge
4. Check for recent cluster topology changes

## Mitigation Steps

1. Pause new operations until the alert clears
2. Run: `npx simplebeacon scan --full --gate --format json` to check cluster health
3. If a specific node is causing issues, isolate it and retry
4. Contact the HSM mesh vault on-call engineer if the alert persists beyond 10 minutes
