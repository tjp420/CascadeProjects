# Runbook: Track121CommitStall

**Alert**: `Track121CommitStall`
**Severity**: `critical`
**Counter(s)**: `hsm_rekey_verified_total, hsm_rekey_committed_total`

## Summary

Re-keying rounds are verified but none are being committed over 10 minutes

## Description

The re-keying pipeline is verifying rounds but the quorum commit phase is stalled. This indicates possible quorum commit deadlock, voter pool exhaustion, or commit phase engine failure.

## Triage Steps

1. Check the quorum commit logs to see if healthy nodes are casting commit votes
2. Verify that the minQuorumNodes threshold is still achievable with the current healthy node count
3. Inspect the hsm_rekey_committed_total counter for any recent commit activity
4. Check if the requireQuorumCommit policy is blocking commits due to insufficient quorum
5. Review the node health check system for false negatives on healthy nodes

## Mitigation Steps

1. If the voter pool is exhausted, add healthy nodes to the cluster to restore quorum
2. Run: npx simplebeacon scan --full --gate --format json to check cluster health
3. If the commit engine is deadlocked, restart the re-keying scheduler on the lead node
4. Contact the HSM mesh vault on-call engineer if the stall persists beyond 15 minutes
