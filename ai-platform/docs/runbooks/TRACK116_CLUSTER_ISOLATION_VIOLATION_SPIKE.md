# Runbook: Track116ClusterIsolationViolationSpike

**Alert**: `Track116ClusterIsolationViolationSpike`
**Severity**: `critical`
**Counter(s)**: `hsm_isolation_violation_total`

## Summary

Cluster isolation violations are spiking

## Description

Cluster isolation boundaries are being violated at an elevated rate, indicating possible cross-tenant access attempts or misconfiguration.

## Triage Steps

1. Check cluster isolation logs for violation details
2. Verify tenant boundary configurations
3. Inspect hsm_isolation_violation_total counter
4. Check for recent tenant policy changes

## Mitigation Steps

1. Pause new operations until the alert clears
2. Run: `npx simplebeacon scan --full --gate --format json` to check cluster health
3. If a specific node is causing issues, isolate it and retry
4. Contact the HSM mesh vault on-call engineer if the alert persists beyond 10 minutes
