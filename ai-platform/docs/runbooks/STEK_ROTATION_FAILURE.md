# Runbook: StekRotationFailure

**Alert**: `StekRotationFailure`
**Severity**: `critical`
**Counter(s)**: `hsm_stek_rotation_total, hsm_stek_active_count`

## Summary

STEK rotation has failed

## Description

Symmetric key rotation is failing, indicating possible key generation failure or storage backend issues.

## Triage Steps

1. Check STEK rotation logs for error messages
2. Verify key storage backend connectivity
3. Inspect hsm_stek_active_count gauge
4. Check for key generation entropy issues

## Mitigation Steps

1. Pause new operations until the alert clears
2. Run: `npx simplebeacon scan --full --gate --format json` to check cluster health
3. If a specific node is causing issues, isolate it and retry
4. Contact the HSM mesh vault on-call engineer if the alert persists beyond 10 minutes
