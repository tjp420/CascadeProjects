# Runbook: Track117ByzantineShardDivergenceDetected

**Alert**: `Track117ByzantineShardDivergenceDetected`
**Severity**: `critical`
**Counter(s)**: `hsm_shard_byzantine_detected_total`

## Summary

Byzantine shard divergence detected

## Description

Byzantine shard divergence has been detected, indicating possible byzantine fault or active attack on shard consensus.

## Triage Steps

1. Immediately check shard consensus logs for divergence details
2. Identify the byzantine node(s) if possible
3. Verify shard hashes across all participating nodes
4. Consider isolating suspected byzantine nodes
5. Contact the HSM mesh vault on-call engineer immediately

## Mitigation Steps

1. Pause new operations until the alert clears
2. Run: `npx simplebeacon scan --full --gate --format json` to check cluster health
3. If a specific node is causing issues, isolate it and retry
4. Contact the HSM mesh vault on-call engineer if the alert persists beyond 10 minutes
