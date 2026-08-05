# Runbook: Track121RollbackBlockedSpike

**Alert**: `Track121RollbackBlockedSpike`
**Severity**: `warning`
**Counter(s)**: `hsm_rekey_rollback_blocked_total`

## Summary

More than 1 re-keying rollback attempt per second is being blocked over 5 minutes

## Description

The anti-rollback protection is actively rejecting epoch rollback attempts at an elevated rate. This indicates possible downgrade attacks, historic epoch reinjection attempts, or misconfigured recovery procedures.

## Triage Steps

1. Check the re-keying logs for the source of rollback attempts (node IDs and epochs)
2. Verify that no nodes are running outdated software versions that use deprecated rollback logic
3. Inspect the requireAntiRollback policy to confirm it is enforced
4. Check if any automated recovery scripts are misconfigured to attempt rollbacks
5. Review the audit trail for any unauthorized key store restoration attempts

## Mitigation Steps

1. If a specific node is generating rollback attempts, quarantine it immediately
2. Run: npx simplebeacon scan --full --gate --format json to check cluster health
3. If rollback attempts are from a legitimate recovery procedure, update the procedure to use forward-promotion instead
4. Contact the security team if rollback attempts appear to be malicious downgrade attacks
