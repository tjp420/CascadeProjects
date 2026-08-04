# Runbook: Track119AckStarvation

**Alert**: `Track119AckStarvation`
**Severity**: `warning`
**Counter(s)**: `hsm_migration_committed_total + hsm_migration_ack_total`

## Summary

Migrations are being committed but no acknowledgments from destination nodes

## Description

Migrations are being committed but no acknowledgments are being received from destination nodes over the last 10 minutes. This indicates possible destination cluster unavailability, network partition, or ack handler failure.

## Triage Steps

1. Check the destination cluster nodes health and connectivity\n2. Verify that the ack handler service is running on destination nodes\n3. Check network connectivity between source and destination clusters\n4. Inspect the hsm_migration_ack_total counter — it should be increasing after commits\n5. Review destination cluster logs for ack processing errors

## Mitigation Steps

1. Restore destination cluster nodes if they are down\n2. Restart the ack handler service on destination nodes if it has crashed\n3. If network partition is confirmed, wait for connectivity restoration and monitor for ack catch-up\n4. If acks remain absent after 15 minutes, consider rolling back uncommitted migrations

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
