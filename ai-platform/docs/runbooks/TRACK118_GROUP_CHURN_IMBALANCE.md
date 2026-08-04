# Runbook: Track 118 Group Churn Imbalance

## Alert: Track118GroupChurnImbalance (Warning)

**PromQL**: `rate(hsm_consensus_coord_groups_destroyed_total[15m]) > rate(hsm_consensus_coord_groups_created_total[15m])`

**Threshold**: Consensus groups are being destroyed at a higher rate than they are being created over the last 15 minutes, sustained for 10 minutes.

## Impact

Group churn imbalance indicates possible group lifecycle instability, resource exhaustion, or misconfigured auto-scaling. If unchecked, the total number of active consensus groups may decline, reducing system capacity.

## Immediate Actions

1. Check group creation and destruction logs:

   ```bash
   kubectl logs -l app=ai-platform --since=30m | grep -E "group_created|group_destroyed"
   ```

2. Verify auto-scaling configuration (if applicable):
   - Check for aggressive group TTL or eviction policies.
   - Review the `allowDynamicGroupCreation` policy setting.

3. Monitor active group count:
   - Use `GET /api/vault/consensus/groups` to track the total active groups over time.

## Escalation & Recovery

- If active group count drops below operational minimum:
  1. Manually create consensus groups via `POST /api/vault/consensus/groups`.
  2. Investigate root cause of excessive group destruction.
  3. Notify SRE team if resource exhaustion is detected.

## Notes

- Related counters: `hsm_consensus_coord_groups_created_total`, `hsm_consensus_coord_groups_destroyed_total`.
