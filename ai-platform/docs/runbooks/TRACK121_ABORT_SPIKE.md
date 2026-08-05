# Runbook: Track121AbortSpike

**Alert**: `Track121AbortSpike`
**Severity**: `critical`
**Counter(s)**: `hsm_rekey_aborted_total`

## Summary

More than 2 re-keying aborts per second over 5 minutes

## Description

Re-keying rounds are being aborted at an elevated rate. This indicates possible systematic verification failures, shareholder coordination breakdown, or VSS polynomial corruption.

## Triage Steps

1. Check the re-keying engine logs for abort reason codes on recent rounds
2. Verify that all shareholders are reachable and responding to resharing requests
3. Inspect the hsm_rekey_active gauge to see how many rounds are in-flight
4. Check if any shareholders were recently removed or added without proper threshold adjustment
5. Review recent policy changes to multipartyReKeying settings

## Mitigation Steps

1. Pause new re-keying proposals until abort rate subsides
2. Run: npx simplebeacon scan --full --gate --format json to check cluster health
3. If a specific shareholder is causing failures, isolate it and retry the re-keying round
4. Contact the HSM mesh vault on-call engineer if aborts persist beyond 10 minutes
