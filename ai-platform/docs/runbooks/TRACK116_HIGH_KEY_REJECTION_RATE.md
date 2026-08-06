# Runbook: Track116HighKeyRejectionRate

**Alert**: `Track116HighKeyRejectionRate`
**Severity**: `warning`
**Counter(s)**: `hsm_key_reject_total`

## Summary

Key rejection rate is too high

## Description

Keys are being rejected at an elevated rate, indicating possible key format issues or policy violations.

## Triage Steps

1. Check key rejection logs for reason codes
2. Verify key format compatibility
3. Inspect hsm_key_reject_total counter
4. Review recent key policy changes

## Mitigation Steps

1. Pause new operations until the alert clears
2. Run: `npx simplebeacon scan --full --gate --format json` to check cluster health
3. If a specific node is causing issues, isolate it and retry
4. Contact the HSM mesh vault on-call engineer if the alert persists beyond 10 minutes
