# Runbook: Track120QuarantineSpike

**Alert**: `Track120QuarantineSpike`
**Severity**: `critical`
**Counter(s)**: `hsm_reconciliation_quarantined_total, hsm_reconciliation_promoted_total`

## Summary

Keys are being quarantined but no promotions are occurring over 10 minutes

## Description

The reconciliation engine is quarantining divergent keys but the quorum promotion pipeline is stalled. This indicates possible quorum promotion engine failure, voter pool starvation, or critical cluster state divergence.

## Triage Steps

1. Check the promotion vote logs to see if healthy nodes are casting votes
2. Verify that the minQuorumNodes threshold is still achievable with the current healthy node count
3. Inspect the hsm_reconciliation_promotion_votes_total counter for vote activity
4. Check if the requireQuorumPromotion policy is blocking promotions due to insufficient quorum
5. Review the node health check system for false negatives on healthy nodes

## Mitigation Steps

1. If the voter pool is exhausted, add healthy nodes to the cluster to restore quorum
2. Run: npx simplebeacon scan --full --gate --format json to check cluster health
3. If the promotion engine is deadlocked, restart the reconciliation scheduler on the lead node
4. Contact the HSM mesh vault on-call engineer if the stall persists beyond 15 minutes
