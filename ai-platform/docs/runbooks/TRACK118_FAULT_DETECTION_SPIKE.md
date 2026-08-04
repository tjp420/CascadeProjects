# Runbook: Track 118 Fault Detection Spike

## Alert: Track118FaultDetectionSpike (Critical)

**PromQL**: `rate(hsm_consensus_coord_faults_detected_total[5m]) > 5`

**Threshold**: More than 5 node faults per second detected over the last 5 minutes, sustained for 1 minute.

## Impact

A high rate of node fault detections indicates possible cascading node failures, network instability, or byzantine behavior across consensus groups. Unaddressed, this may trigger excessive view changes and consensus group instability.

## Immediate Actions

1. Identify which nodes are being flagged as faulty:

   ```bash
   kubectl logs -l app=ai-platform --since=10m | grep -E "fault_detected|FAULT_DETECTED"
   ```

2. Check node health and connectivity:
   - `kubectl get nodes -o wide`
   - `kubectl describe node <node-name>` for nodes reporting NotReady status.

3. Review the fault detector configuration (`faultTimeoutMs`, `faultCheckIntervalMs`) — overly aggressive thresholds may cause false positives under load.

## Escalation & Recovery

- If faults are genuine (nodes are actually down):
  1. Drain and replace the failed nodes.
  2. Verify consensus group quorum is restored.
  3. Monitor view change activity to ensure leader election succeeds.

- If faults are false positives:
  1. Adjust `faultCheckIntervalMs` to a higher value.
  2. Investigate network latency between consensus nodes.

## Notes

- Related counters: `hsm_consensus_coord_faults_detected_total`, `hsm_consensus_coord_view_change_started_total`.
