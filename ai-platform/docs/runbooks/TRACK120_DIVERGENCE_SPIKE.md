# Runbook: Track120DivergenceSpike

**Alert**: `Track120DivergenceSpike`
**Severity**: `critical`
**Counter(s)**: `hsm_reconciliation_divergence_detected_total`

## Summary

More than 2 key divergences per second over 5 minutes

## Description

Key divergences are being detected at an elevated rate across cluster nodes. This indicates active key drift, possible split-brain conditions, or compromised key material.

## Triage Steps

1. Check the reconciliation engine logs for the affected key IDs and node pairs
2. Verify network connectivity between cluster nodes is stable
3. Inspect the hsm_reconciliation_divergent_keys gauge for the current backlog
4. Check if any nodes were recently restarted or had their key stores restored from backup
5. Review recent policy changes to clusterKeyReconciliation settings

## Mitigation Steps

1. Pause non-essential key operations until divergence rate subsides
2. Run: npx simplebeacon scan --full --gate --format json to check cluster health
3. If a specific node is the source of divergence, quarantine it using the reconciliation API
4. Contact the HSM mesh vault on-call engineer if divergences persist beyond 10 minutes
