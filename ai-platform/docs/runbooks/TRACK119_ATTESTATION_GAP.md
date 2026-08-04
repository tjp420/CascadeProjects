# Runbook: Track119AttestationGap

**Alert**: `Track119AttestationGap`
**Severity**: `warning`
**Counter(s)**: `hsm_migration_initiated_total + hsm_migration_attested_total`

## Summary

Migrations are being initiated but none are being attested

## Description

Migrations are being initiated but none are being attested over the last 5 minutes. This indicates possible attestation authority unavailability, credential expiry, or network partition between source and attestation service.

## Triage Steps

1. Check the attestation authority service health endpoint\n2. Verify that attestation credentials have not expired\n3. Check network connectivity between the source cluster and the attestation service\n4. Inspect the allowedAttestationAuthorities policy — is the authority still in the allowed list?\n5. Review attestation service logs for errors or rate limiting

## Mitigation Steps

1. Restore the attestation authority service if it is down\n2. Rotate attestation credentials if they have expired\n3. If the authority is rate limiting, reduce migration initiation rate\n4. POST /api/vault/cross-cluster-migration/policy/validate to verify authority configuration

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
