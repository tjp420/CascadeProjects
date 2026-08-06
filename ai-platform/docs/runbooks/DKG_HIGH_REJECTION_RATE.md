# Runbook: DkgHighRejectionRate

**Alert**: `DkgHighRejectionRate`
**Severity**: `warning`
**Counter(s)**: `hsm_dkg_share_rejected_total, hsm_dkg_share_received_total`

## Summary

DKG share rejection rate is too high

## Description

A high percentage of DKG shares are being rejected, indicating possible malformed shares or byzantine participants.

## Triage Steps

1. Check DKG share verification logs
2. Identify which participants are submitting rejected shares
3. Verify share format compatibility across participants
4. Check for clock skew between participants

## Mitigation Steps

1. Pause new operations until the alert clears
2. Run: `npx simplebeacon scan --full --gate --format json` to check cluster health
3. If a specific node is causing issues, isolate it and retry
4. Contact the HSM mesh vault on-call engineer if the alert persists beyond 10 minutes
