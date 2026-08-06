# Runbook: Musig2VerificationFailureSpike

**Alert**: `Musig2VerificationFailureSpike`
**Severity**: `warning`
**Counter(s)**: `hsm_musig2_signature_verification_failed_total`

## Summary

MuSig2 signature verification failures are spiking

## Description

MuSig2 aggregate signature verification is failing at an elevated rate, indicating possible malformed signatures or byzantine participants.

## Triage Steps

1. Check MuSig2 verification logs for failure reasons
2. Verify all signing participants are using the same session parameters
3. Inspect for nonce reuse or nonce commitment violations
4. Check for participant key changes mid-session

## Mitigation Steps

1. Pause new operations until the alert clears
2. Run: `npx simplebeacon scan --full --gate --format json` to check cluster health
3. If a specific node is causing issues, isolate it and retry
4. Contact the HSM mesh vault on-call engineer if the alert persists beyond 10 minutes
