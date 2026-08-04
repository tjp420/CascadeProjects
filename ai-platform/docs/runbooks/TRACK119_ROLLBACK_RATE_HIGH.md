# Runbook: Track119RollbackRateHigh

**Alert**: `Track119RollbackRateHigh`
**Severity**: `warning`
**Counter(s)**: `hsm_migration_committed_total + hsm_migration_rolled_back_total`

## Summary

More than 30% of migration outcomes are rollbacks over 5 minutes

## Description

More than 30% of migration outcomes are rollbacks over the last 5 minutes. This indicates possible systematic verification failures, destination cluster instability, or misconfigured migration manifests.

## Triage Steps

1. Check the rollback reasons in the migration logs — are they all the same cause?\n2. Verify that migration manifests are correctly formatted and shard counts are within limits\n3. Check destination cluster stability — are nodes flapping or experiencing resource pressure?\n4. Inspect the hsm_migration_verification_failed_total counter for correlation with rollbacks\n5. Review recent configuration changes to the crossClusterMigration policy

## Mitigation Steps

1. If a systematic verification failure is identified, fix the root cause before resuming migrations\n2. If destination cluster instability is the cause, pause migrations until the cluster stabilizes\n3. POST /api/vault/cross-cluster-migration/policy/validate to verify manifest configuration\n4. If rollback rate remains above 30% after 15 minutes, escalate to the post-quantum crypto team

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
