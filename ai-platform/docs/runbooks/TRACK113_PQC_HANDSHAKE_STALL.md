# Runbook: Track113PqcHandshakeStall

**Alert**: `Track113PqcHandshakeStall`
**Severity**: `critical`
**Counter(s)**: `hsm_mpc_handshake_initiated_total, hsm_mpc_handshake_verified_total`

## Summary

Track 113 PQC handshake verifications have stalled

## Description

New post-quantum handshake sessions are being initialized but no verifications are completing, indicating possible token pool lock contention or asymmetric deadlock.

## Triage Steps

1. Check MPC handshake logs for verification errors
2. Verify token pool availability
3. Inspect hsm_mpc_handshake_verified_total counter
4. Check for lock contention in the handshake engine

## Mitigation Steps

1. Pause new operations until the alert clears
2. Run: `npx simplebeacon scan --full --gate --format json` to check cluster health
3. If a specific node is causing issues, isolate it and retry
4. Contact the HSM mesh vault on-call engineer if the alert persists beyond 10 minutes
