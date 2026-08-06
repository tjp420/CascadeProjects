# Runbook: Track114HighValidationFailureRate

**Alert**: `Track114HighValidationFailureRate`
**Severity**: `warning`
**Counter(s)**: `hsm_zk_vss_claim_verified_total, hsm_vssgate_pool_initialized_total`

## Summary

Track 114 lattice VSS validation failure rate is above 15%

## Description

More than 15% of initialized lattice VSS sessions are failing ZK proof evaluation, polynomial degree bound rejection, or share threshold rejection.

## Triage Steps

1. Check VSS validation logs for failure reasons
2. Verify polynomial degree parameters are correct
3. Inspect for rogue-share or malformed polynomial injection attempts
4. Review recent policy changes to VSS gating settings

## Mitigation Steps

1. Pause new operations until the alert clears
2. Run: `npx simplebeacon scan --full --gate --format json` to check cluster health
3. If a specific node is causing issues, isolate it and retry
4. Contact the HSM mesh vault on-call engineer if the alert persists beyond 10 minutes
