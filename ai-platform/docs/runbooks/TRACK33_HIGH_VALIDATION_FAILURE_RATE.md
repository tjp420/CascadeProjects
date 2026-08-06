# Runbook: Track33HighValidationFailureRate

**Alert**: `Track33HighValidationFailureRate`
**Severity**: `warning`
**Counter(s)**: `hsm_zk_accumulator_claim_verified_total, hsm_accumulatorgate_pool_initialized_total`

## Summary

Track 33 accumulator validation failure rate is above 15%

## Description

More than 15% of initialized accumulator membership sessions are failing ZK proof evaluation, tree size threshold rejection, or witness quorum rejection.

## Triage Steps

1. Check accumulator validation logs for failure reasons
2. Verify witness quorum parameters are correct
3. Inspect for rogue-witness or fake-membership injection attempts
4. Review recent policy changes to accumulator gating settings

## Mitigation Steps

1. Pause new operations until the alert clears
2. Run: `npx simplebeacon scan --full --gate --format json` to check cluster health
3. If a specific node is causing issues, isolate it and retry
4. Contact the HSM mesh vault on-call engineer if the alert persists beyond 10 minutes
