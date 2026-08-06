# Runbook: DkgHighDisqualificationRate

**Alert**: `DkgHighDisqualificationRate`
**Severity**: `warning`
**Counter(s)**: `hsm_dkg_node_disqualified_total`

## Summary

DKG node disqualification rate is too high

## Description

Nodes are being disqualified from DKG sessions at an elevated rate, indicating possible byzantine behavior or network issues.

## Triage Steps

1. Check DKG disqualification logs for reason codes
2. Verify network connectivity to disqualified nodes
3. Check if disqualified nodes share common infrastructure
4. Review recent node configuration changes

## Mitigation Steps

1. Pause new operations until the alert clears
2. Run: `npx simplebeacon scan --full --gate --format json` to check cluster health
3. If a specific node is causing issues, isolate it and retry
4. Contact the HSM mesh vault on-call engineer if the alert persists beyond 10 minutes
