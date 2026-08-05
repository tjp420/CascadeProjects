# Runbook: Track120PromotionVoteStall

**Alert**: `Track120PromotionVoteStall`
**Severity**: `warning`
**Counter(s)**: `hsm_reconciliation_scans_total, hsm_reconciliation_promotion_votes_total`

## Summary

Reconciliation scans are running but no promotion votes are being cast over 10 minutes

## Description

The reconciliation scanner is operational but the quorum promotion voting pipeline is stalled. This indicates possible voter pool exhaustion, node health check failure, or quorum promotion engine deadlock.

## Triage Steps

1. Check the node health registry to see how many nodes are marked as healthy voters
2. Verify that the promotion vote dispatcher is not deadlocked
3. Inspect the hsm_reconciliation_promotion_votes_total counter for any recent activity
4. Check if the requireQuorumPromotion policy threshold is higher than the current healthy node count
5. Review the voter registration logs for nodes that recently lost voter status

## Mitigation Steps

1. If voter pool is exhausted, restore health to offline nodes or add new healthy nodes
2. Run: npx simplebeacon scan --full --gate --format json to check cluster health
3. If the vote dispatcher is deadlocked, restart the promotion engine on the lead node
4. Contact the HSM mesh vault on-call engineer if the stall persists beyond 15 minutes
