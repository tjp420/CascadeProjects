# Runbook: Track119CommitStall

**Alert**: `Track119CommitStall`
**Severity**: `critical`
**Counter(s)**: `hsm_migration_initiated_total + hsm_migration_committed_total`

## Summary

Migrations are being initiated but none are committing via quorum

## Description

Migrations are being initiated but none have been committed via quorum over the last 10 minutes. This indicates possible quorum commit failure, attestation backlog, or destination cluster unavailability.

## Triage Steps

1. Check the quorum commit logs for errors or timeouts\n2. Verify that the attestation authority is processing attestation requests\n3. Check if the destination cluster nodes are reachable and responding\n4. Inspect the hsm_migration_attested_total counter — are migrations being attested?\n5. Review the minQuorumNodes policy — is it set too high for the current cluster state?

## Mitigation Steps

1. If the attestation authority is down, restore it before attempting new migrations\n2. If destination cluster nodes are unreachable, pause migrations until connectivity is restored\n3. If quorum cannot be reached, consider temporarily lowering minQuorumNodes (with approval)\n4. Escalate to the HSM mesh vault on-call engineer if commits remain stalled

## Related Endpoints

- `GET /api/vault/cross-cluster-migration/telemetry` — view all 7 migration counters
- `GET /api/vault/cross-cluster-migration/policy` — view active policy defaults
- `POST /api/vault/cross-cluster-migration/policy/validate` — validate proposed configuration

## Related Alerts

- Track119VerificationFailureSpike
- Track119RollbackStall
- Track119ConcurrentMigrationSaturation
- Track119CommitStall
- Track119AttestationGap
- Track119AckStarvation
- Track119RollbackRateHigh
