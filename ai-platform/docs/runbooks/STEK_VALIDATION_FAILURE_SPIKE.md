# Runbook: StekValidationFailureSpike

**Alert**: `StekValidationFailureSpike`
**Severity**: `warning`
**Counter(s)**: `hsm_stek_validation_failed_total`

## Summary

STEK validation failures are spiking

## Description

Symmetric key validation is failing at an elevated rate, indicating possible key corruption or tampering.

## Triage Steps

1. Check STEK validation logs for failure reasons
2. Verify key integrity hashes
3. Inspect storage backend for corruption signs
4. Check for concurrent rotation conflicts

## Mitigation Steps

1. Pause new operations until the alert clears
2. Run: `npx simplebeacon scan --full --gate --format json` to check cluster health
3. If a specific node is causing issues, isolate it and retry
4. Contact the HSM mesh vault on-call engineer if the alert persists beyond 10 minutes
