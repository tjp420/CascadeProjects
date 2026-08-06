# Runbook: DkgSessionTimeoutSpike

**Alert**: `DkgSessionTimeoutSpike`
**Severity**: `warning`
**Counter(s)**: `hsm_dkg_session_timeout_total`

## Summary

DKG session timeouts are spiking

## Description

DKG sessions are timing out at an elevated rate, indicating possible network latency or participant overload.

## Triage Steps

1. Check DKG session timeout logs
2. Verify network latency between participants
3. Check participant CPU and memory utilization
4. Review DKG session timeout configuration

## Mitigation Steps

1. Pause new operations until the alert clears
2. Run: `npx simplebeacon scan --full --gate --format json` to check cluster health
3. If a specific node is causing issues, isolate it and retry
4. Contact the HSM mesh vault on-call engineer if the alert persists beyond 10 minutes
