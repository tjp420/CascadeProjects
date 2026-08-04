# Runbook: Track119ConcurrentMigrationSaturation

**Alert**: `Track119ConcurrentMigrationSaturation`
**Severity**: `warning`
**Counter(s)**: `hsm_migration_active`

## Summary

Active concurrent migrations above 14 for 3 minutes (approaching limit of 16)

## Description

Active concurrent migrations are approaching the policy limit of 16. This indicates possible migration backlog, resource exhaustion, or unthrottled migration scheduling.

## Triage Steps

1. Check the hsm_migration_active gauge trend — is it increasing or stable?\n2. Verify that the migration scheduler is respecting the maxConcurrentMigrations policy\n3. Check if there is a backlog of pending migration requests\n4. Inspect system resources (CPU, memory, network) on the HSM mesh vault nodes\n5. Review recent migration initiations for unexpected bulk operations

## Mitigation Steps

1. Throttle new migration initiations if the count continues to rise\n2. Scale horizontally by adding more HSM mesh vault nodes to distribute the load\n3. POST /api/vault/cross-cluster-migration/policy/validate to verify policy limits\n4. If saturation is caused by a bulk operation, consider batching migrations

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
