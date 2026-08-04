# Runbook: Track 118 View Change Completion Stall

## Alert: Track118ViewChangeCompletionStall (Critical)

**PromQL**: `rate(hsm_consensus_coord_view_change_started_total[10m]) > 0 and rate(hsm_consensus_coord_view_change_completed_total[10m]) == 0`

**Threshold**: View changes are being initiated but none have completed over the last 10 minutes, sustained for 5 minutes.

## Impact

The consensus layer is unable to complete view change procedures, indicating possible deadlock, timeout misconfiguration, or worker pool starvation. Proposals cannot be routed until a new leader is elected.

## Immediate Actions

1. Check for deadlocked view-change procedures:

   ```bash
   kubectl logs -l app=ai-platform --since=20m | grep -E "view_change_started|view_change_completed|view_change_abort"
   ```

2. Verify worker pool health and event loop utilization:
   - `kubectl top pods -l app=ai-platform`
   - Check for event loop blocking via `clinic doctor` traces.

3. Review the consensus group membership — if too few nodes are available, quorum cannot be reached for view change completion.

## Escalation & Recovery

- If the stall persists for more than 15 minutes:
  1. Force-reset the affected consensus group via the REST API.
  2. Restart the DistributedConsensusCoordinator pod to clear stale state.
  3. Notify SRE and platform security teams.

## Notes

- Related counters: `hsm_consensus_coord_view_change_started_total`, `hsm_consensus_coord_view_change_completed_total`, `hsm_consensus_coord_view_change_aborted_total`.
