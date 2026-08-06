# Runbook: Track115HighValidationFailureRate

**Alert**: `Track115HighValidationFailureRate`
**Severity**: `warning`
**Counter(s)**: `hsm_zk_vfhss_claim_verified_total, hsm_vfhssgate_pool_initialized_total`

## Summary

Track 115 lattice VFHSS validation failure rate is above 15%

## Description

More than 15% of initialized lattice VFHSS sessions are failing ZK proof evaluation, homomorphic depth bound rejection, or share threshold rejection.

## Triage Steps

1. Check VFHSS validation logs for failure reasons
2. Verify homomorphic depth parameters are correct
3. Inspect for rogue-share or malformed polynomial injection attempts
4. Review recent policy changes to VFHSS gating settings

## Mitigation Steps

1. Pause new operations until the alert clears
2. Run: `npx simplebeacon scan --full --gate --format json` to check cluster health
3. If a specific node is causing issues, isolate it and retry
4. Contact the HSM mesh vault on-call engineer if the alert persists beyond 10 minutes
