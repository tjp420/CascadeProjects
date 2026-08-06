# Runbook: DkgSessionStall

**Alert**: `DkgSessionStall`
**Severity**: `critical`
**Counter(s)**: `hsm_dkg_session_initiated_total, hsm_dkg_session_completed_total`

## Summary

DKG sessions are being initiated but not completing

## Description

New DKG sessions are starting but none are completing, indicating possible share verification failure or participant timeout.

## Triage Steps

1. Check DKG session logs for completion errors
2. Verify all participants are reachable
3. Inspect hsm_dkg_session_completed_total counter
4. Check for share verification failures

## Mitigation Steps

1. Pause new operations until the alert clears
2. Run: `npx simplebeacon scan --full --gate --format json` to check cluster health
3. If a specific node is causing issues, isolate it and retry
4. Contact the HSM mesh vault on-call engineer if the alert persists beyond 10 minutes
