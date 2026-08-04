# Runbook: Track 118 Quorum Denial Spike

## Alert: Track118QuorumDenialSpike (Warning)

**PromQL**: `rate(hsm_consensus_coord_quorum_denied_total[5m]) > 10`

**Threshold**: More than 10 quorum denials per second over the last 5 minutes, sustained for 2 minutes.

## Impact

Elevated quorum denials indicate possible quorum configuration drift, node unavailability, or byzantine voting behavior. Proposals that cannot achieve quorum will not be committed, degrading consensus throughput.

## Immediate Actions

1. Check quorum denial patterns:

   ```bash
   kubectl logs -l app=ai-platform --since=10m | grep -E "quorum_denied|QUORUM_DENIED"
   ```

2. Verify consensus group membership and quorum thresholds:
   - Use `GET /api/vault/consensus/groups/:groupId` to inspect group configuration.
   - Ensure quorum values are not set higher than the number of active nodes.

3. Check for byzantine voting behavior via the fault detector counters.

## Escalation & Recovery

- If denials persist:
  1. Review the `requireQuorumForProposals` policy setting.
  2. Add or restore nodes to affected consensus groups.
  3. Temporarily lower quorum thresholds if operating in degraded mode (with security team approval).

## Notes

- Related counters: `hsm_consensus_coord_quorum_denied_total`, `hsm_consensus_coord_quorum_verified_total`.
