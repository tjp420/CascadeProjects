# Runbook: ShardReassemblyHighFailureRate

**Alert**: `ShardReassemblyHighFailureRate`
**Severity**: `warning`
**Counter(s)**: `hsm_shard_reassembly_failed_total, hsm_shard_reassembly_completed_total`

## Summary

Shard reassembly failure rate is too high

## Description

A high percentage of shard reassembly attempts are failing, indicating possible shard corruption or network issues.

## Triage Steps

1. Check shard reassembly logs for failure reasons
2. Verify shard integrity hashes
3. Inspect network connectivity to shard storage
4. Check for concurrent reassembly conflicts

## Mitigation Steps

1. Pause new operations until the alert clears
2. Run: `npx simplebeacon scan --full --gate --format json` to check cluster health
3. If a specific node is causing issues, isolate it and retry
4. Contact the HSM mesh vault on-call engineer if the alert persists beyond 10 minutes
