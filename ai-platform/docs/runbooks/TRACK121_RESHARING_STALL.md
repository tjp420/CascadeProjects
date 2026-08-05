# Runbook: Track121ResharingStall

**Alert**: `Track121ResharingStall`
**Severity**: `warning`
**Counter(s)**: `hsm_rekey_proposed_total, hsm_rekey_resharing_submitted_total`

## Summary

Re-keying proposals are running but no resharings are being submitted over 10 minutes

## Description

The re-keying proposal engine is operational but shareholders are not submitting their resharings. This indicates possible shareholder participation failure, network partition, or resharing engine deadlock.

## Triage Steps

1. Check the shareholder participation logs to see which nodes are not responding
2. Verify network connectivity between the lead node and all shareholders
3. Inspect the hsm_rekey_resharing_submitted_total counter for any recent activity
4. Check if the maxShareholders limit has been reached, blocking new resharings
5. Review the shareholder health registry for nodes that recently lost voting status

## Mitigation Steps

1. If shareholders are unreachable, restore network connectivity or replace them with healthy nodes
2. Run: npx simplebeacon scan --full --gate --format json to check cluster health
3. If the resharing engine is deadlocked, restart the re-keying scheduler on the lead node
4. Contact the HSM mesh vault on-call engineer if the stall persists beyond 15 minutes
