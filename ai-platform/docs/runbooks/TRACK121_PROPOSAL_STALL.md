# Runbook: Track121ProposalStall

**Alert**: `Track121ProposalStall`
**Severity**: `warning`
**Counter(s)**: `hsm_rekey_proposed_total`

## Summary

No re-keying proposals have been initiated over the last 10 minutes

## Description

The re-keying proposal engine has stopped running. This indicates possible re-keying scheduler failure, process termination on the lead node, or governance policy blocking new proposals.

## Triage Steps

1. Check if the re-keying scheduler process is still running on the lead node
2. Verify that the re-keying proposal interval configuration has not been changed or corrupted
3. Inspect the system logs for any process crashes or out-of-memory events on the lead node
4. Check if the governance policy is blocking new proposals due to a recent abort spike
5. Review recent deployments or configuration changes that may have affected the scheduler

## Mitigation Steps

1. If the scheduler process has crashed, restart it on the lead node
2. Run: npx simplebeacon scan --full --gate --format json to check cluster health
3. If the scheduler is blocked by governance policy, review and adjust the policy thresholds
4. Contact the HSM mesh vault on-call engineer if proposals do not resume within 5 minutes of restart
