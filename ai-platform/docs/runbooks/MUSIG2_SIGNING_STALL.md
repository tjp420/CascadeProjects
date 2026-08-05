# Runbook: Musig2SigningStall

**Alert**: `Musig2SigningStall`
**Severity**: `warning`
**Counter(s)**: `hsm_musig2_signature_assembled_total, hsm_musig2_challenge_computed_total`

## Summary

MuSig2 signing has stalled

## Description

MuSig2 challenges are being computed but signatures are not being assembled, indicating possible participant dropout or nonce issues.

## Triage Steps

1. Check MuSig2 session logs for assembly errors
2. Verify all participants submitted their nonce responses
3. Inspect hsm_musig2_signature_assembled_total counter
4. Check for stuck sessions in the assembly phase

## Mitigation Steps

1. Pause new operations until the alert clears
2. Run: `npx simplebeacon scan --full --gate --format json` to check cluster health
3. If a specific node is causing issues, isolate it and retry
4. Contact the HSM mesh vault on-call engineer if the alert persists beyond 10 minutes
