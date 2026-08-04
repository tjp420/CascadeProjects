# Runbook: Track119RollbackStall

**Alert**: `Track119RollbackStall`
**Severity**: `critical`
**Counter(s)**: `hsm_migration_verification_failed_total + hsm_migration_rolled_back_total`

## Summary

Migrations are failing but rollbacks are not executing

## Description

Migration verification failures are occurring but no rollbacks are being executed. This indicates possible rollback engine failure, quorum commit deadlock, or cluster state divergence.

## Triage Steps

1. Check the rollback engine worker pool for stuck or dead workers\n2. Verify that the quorum commit protocol is not deadlocked\n3. Check if the destination cluster is reachable for rollback operations\n4. Inspect the hsm_migration_rolled_back_total counter — it should be increasing\n5. If rollbacks are truly stalled, cluster state may be diverging — escalate immediately

## Mitigation Steps

1. Manually trigger rollbacks for affected migration IDs via the REST API\n2. POST /api/vault/cross-cluster-migration/policy/validate with requireRollbackOnFailure: true\n3. If the rollback engine is crashed, restart the HSM mesh vault service\n4. Escalate to the post-quantum crypto team lead — cluster state divergence is a P0 incident

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
