# Runbook: Track120UnresolvedDivergence

**Alert**: `Track120UnresolvedDivergence`
**Severity**: `critical`
**Counter(s)**: `hsm_reconciliation_divergent_keys`

## Summary

More than 50 keys with unresolved divergence for over 10 minutes

## Description

The cluster is accumulating unresolved key divergences faster than the reconciliation engine can resolve them. This indicates the cluster is approaching split-brain conditions.

## Triage Steps

1. Check the hsm_reconciliation_divergent_keys gauge trend to see if it is increasing or stable
2. Identify which key ranges are most affected by divergence
3. Verify that the reconciliation scan interval is not stalled (check hsm_reconciliation_scans_total)
4. Check if the maxTrackedKeys limit is being reached, which would prevent new divergences from being tracked
5. Review recent cluster topology changes (node additions, removals, or network partitions)

## Mitigation Steps

1. If the cluster is partitioned, restore network connectivity between split-brain partitions
2. Run: npx simplebeacon scan --full --gate --format json to check cluster health
3. If a partition cannot be healed, manually promote the authoritative partition and quarantine the other
4. Contact the HSM mesh vault on-call engineer if divergence count exceeds 100 or persists beyond 30 minutes
