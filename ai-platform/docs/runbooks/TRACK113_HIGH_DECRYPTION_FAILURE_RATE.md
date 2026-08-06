# Runbook: Track113HighDecryptionFailureRate

**Alert**: `Track113HighDecryptionFailureRate`
**Severity**: `warning`
**Counter(s)**: `hsm_mpc_handshake_aborted_total`

## Summary

Track 113 handshake aborts are occurring

## Description

MPC handshakes are being aborted, indicating possible verification failures, key degradation, or active tampering attempts.

## Triage Steps

1. Check MPC handshake abort logs for reason codes
2. Verify key integrity and freshness
3. Inspect hsm_mpc_handshake_aborted_total counter
4. Check for concurrent session conflicts

## Mitigation Steps

1. Pause new operations until the alert clears
2. Run: `npx simplebeacon scan --full --gate --format json` to check cluster health
3. If a specific node is causing issues, isolate it and retry
4. Contact the HSM mesh vault on-call engineer if the alert persists beyond 10 minutes
