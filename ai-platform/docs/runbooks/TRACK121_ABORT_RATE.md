# Runbook: Track121AbortRate

**Alert**: `Track121AbortRate`
**Severity**: `warning`
**Counter(s)**: `hsm_rekey_aborted_total, hsm_rekey_proposed_total`

## Summary

More than 50% of proposed re-keying rounds are being aborted over 5 minutes

## Description

The re-keying pipeline is failing to complete more than half of its proposed rounds. This indicates systematic re-keying failures, irreconcilable shareholder states, or compromised key material.

## Triage Steps

1. Check the re-keying logs for abort reason codes on recent failed rounds
2. Verify that the VSS polynomial generation is not producing invalid shares
3. Inspect the hsm_rekey_committed_total counter to confirm successful commits are not occurring
4. Check if the aborted rounds share a common shareholder or key range, indicating a systemic issue
5. Review recent key generation or rotation events that may have produced irreconcilable states

## Mitigation Steps

1. If a specific shareholder is causing aborts, isolate it and retry with a reduced threshold
2. Run: npx simplebeacon scan --full --gate --format json to check cluster health
3. If the abort rate is due to VSS corruption, re-initialize the affected key ranges through a controlled recovery procedure
4. Contact the HSM mesh vault on-call engineer if the abort rate does not improve within 15 minutes
