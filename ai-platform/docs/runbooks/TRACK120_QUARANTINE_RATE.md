# Runbook: Track120QuarantineRate

**Alert**: `Track120QuarantineRate`
**Severity**: `warning`
**Counter(s)**: `hsm_reconciliation_quarantined_total, hsm_reconciliation_divergence_detected_total`

## Summary

More than 50% of detected divergences result in quarantine over 5 minutes

## Description

The reconciliation engine is failing to recover divergent keys and is instead quarantining them at a high rate. This indicates systematic recovery failures, irreconcilable key states, or compromised node key material.

## Triage Steps

1. Check the reconciliation logs for the reason codes on recent quarantine decisions
2. Verify that the quarantineOnCriticalDivergence policy is not overly aggressive
3. Inspect the hsm_reconciliation_promoted_total counter to confirm promotions are not occurring
4. Check if the divergent keys share a common epoch or key range, which may indicate a systemic issue
5. Review recent key generation or rotation events that may have produced irreconcilable states

## Mitigation Steps

1. If a specific key range is affected, isolate and re-initialize those keys through a controlled recovery procedure
2. Run: npx simplebeacon scan --full --gate --format json to check cluster health
3. If the quarantine threshold is too aggressive, review the quarantineOnCriticalDivergence policy settings
4. Contact the HSM mesh vault on-call engineer if the quarantine rate does not improve within 15 minutes
