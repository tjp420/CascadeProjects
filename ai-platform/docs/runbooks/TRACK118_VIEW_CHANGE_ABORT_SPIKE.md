# Runbook: Track 118 View Change Abort Spike

## Alert: Track118ViewChangeAbortSpike (Critical)

**PromQL**: `rate(hsm_consensus_coord_view_change_aborted_total[5m]) > 1`

**Threshold**: More than 1 view change abort per second sustained for 2 minutes.

## Impact

View change procedures are aborting at an elevated rate, indicating possible network partition, byzantine node behavior, or view-change protocol gridlock. If unresolved, consensus groups may lose leader availability and proposal routing will stall.

## Immediate Actions

1. Inspect application logs for view-change abort reasons:

   ```bash
   kubectl logs -l app=ai-platform --since=15m | grep -E "view_change_abort|VIEW_CHANGE_ABORTED"
   ```

2. Check cluster network health for partitions or latency spikes:
   - `kubectl get nodes -o wide`
   - Verify inter-node connectivity with `ping` or `nc` between affected pods.

3. Review the DistributedConsensusCoordinator configuration for `viewChangeTimeoutMs` — if set too low, legitimate view changes may time out under load.

## Escalation & Recovery

- If aborts continue for more than 10 minutes:
  1. Check for byzantine node behavior via the fault detector counters (`hsm_consensus_coord_faults_detected_total`).
  2. Quarantine suspected byzantine nodes by removing them from the consensus group.
  3. Manually trigger a view change via the REST API: `POST /api/vault/consensus/view-change`.

## Notes

- Keep this runbook up to date with changes to the view-change protocol, timeout configuration, or consensus group lifecycle.
- Related counters: `hsm_consensus_coord_view_change_aborted_total`, `hsm_consensus_coord_view_change_started_total`, `hsm_consensus_coord_view_change_completed_total`.
