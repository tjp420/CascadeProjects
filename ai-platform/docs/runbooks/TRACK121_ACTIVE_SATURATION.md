# Runbook: Track121ActiveSaturation

**Alert**: `Track121ActiveSaturation`
**Severity**: `critical`
**Counter(s)**: `hsm_rekey_active`

## Summary

More than 28 concurrent re-keying rounds active for over 5 minutes

## Description

The number of active concurrent re-keying rounds is approaching the maxShareholders limit of 32. This indicates possible re-keying backlog, resource exhaustion, or unthrottled re-keying scheduling.

## Triage Steps

1. Check the hsm_rekey_active gauge trend to see if it is increasing or stable
2. Identify which key ranges are undergoing re-keying and whether they can be batched
3. Verify that the re-keying scheduler is properly throttling new proposals
4. Check if any re-keying rounds are stuck in a non-terminal state (not committed or aborted)
5. Review recent governance changes that may have triggered a mass re-keying event

## Mitigation Steps

1. Pause new re-keying proposals until the active count drops below 20
2. Run: npx simplebeacon scan --full --gate --format json to check cluster health
3. If rounds are stuck, force-abort stale rounds that have been active for more than 30 minutes
4. Contact the HSM mesh vault on-call engineer if saturation persists beyond 15 minutes
