# Runbook: Track31HighValidationFailureRate

**Alert**: `Track31HighValidationFailureRate`
**Severity**: `warning`
**Counter(s)**: `hsm_lookup_accreditation_completed_total, hsm_lookupgate_pool_initialized_total`

## Summary

Track 31 lookup validation failure rate is above 15%

## Description

More than 15% of initialized homomorphic lookup sessions are failing ZK proof evaluation or recursive depth rejection.

## Triage Steps

1. Check lookup validation logs for failure reasons
2. Verify ZK proof parameters are correct
3. Inspect for brute-force or stale claim injection attempts
4. Review recent policy changes to lookup gating settings

## Mitigation Steps

1. Pause new operations until the alert clears
2. Run: `npx simplebeacon scan --full --gate --format json` to check cluster health
3. If a specific node is causing issues, isolate it and retry
4. Contact the HSM mesh vault on-call engineer if the alert persists beyond 10 minutes
