# Runbook: Track32HighValidationFailureRate

**Alert**: `Track32HighValidationFailureRate`
**Severity**: `warning`
**Counter(s)**: `hsm_ring_accreditation_completed_total, hsm_ringgate_pool_initialized_total`

## Summary

Track 32 ring validation failure rate is above 15%

## Description

More than 15% of initialized ring-signature sessions are failing ZK proof evaluation or anonymity set size rejection.

## Triage Steps

1. Check ring validation logs for failure reasons
2. Verify anonymity set parameters are correct
3. Inspect for linkability or double-spending attack patterns
4. Review recent policy changes to ring gating settings

## Mitigation Steps

1. Pause new operations until the alert clears
2. Run: `npx simplebeacon scan --full --gate --format json` to check cluster health
3. If a specific node is causing issues, isolate it and retry
4. Contact the HSM mesh vault on-call engineer if the alert persists beyond 10 minutes
