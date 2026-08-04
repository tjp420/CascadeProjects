# Runbook: Track119VerificationFailureSpike

**Alert**: `Track119VerificationFailureSpike`
**Severity**: `critical`
**Counter(s)**: `hsm_migration_verification_failed_total`

## Summary

More than 2 migration verification failures per second over 5 minutes

## Description

Cross-cluster migration verification failures are cascading. This indicates possible manifest corruption, shard integrity breaches, or cross-cluster topology drift.

## Triage Steps

1. Check the migration verification logs for the failing migration IDs\n2. Verify that the source and destination cluster shard manifests match\n3. Check if the attestation authority is reachable and responding\n4. Inspect the hsm_migration_active gauge to see how many migrations are in-flight\n5. If manifest corruption is confirmed, initiate a rollback for affected migrations

## Mitigation Steps

1. Pause new migration initiations until verification failures subside\n2. Run: npx simplebeacon scan --full --gate --format json to check cluster health\n3. If a specific shard is corrupted, isolate it and trigger a targeted rollback\n4. Contact the HSM mesh vault on-call engineer if failures persist beyond 10 minutes

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
