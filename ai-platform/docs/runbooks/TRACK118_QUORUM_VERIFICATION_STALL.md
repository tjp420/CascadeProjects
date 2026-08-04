# Runbook: Track 118 Quorum Verification Stall

## Alert: Track118QuorumVerificationStall (Critical)

**PromQL**: `rate(hsm_consensus_coord_proposals_routed_total[10m]) > 0 and rate(hsm_consensus_coord_quorum_verified_total[10m]) == 0`

**Threshold**: Proposals are being routed but no quorum verifications are completing over the last 10 minutes, sustained for 5 minutes.

## Impact

The quorum verification engine has stalled while proposals continue to flow. This indicates possible quorum engine failure, voter pool starvation, or cross-group routing breakdown. Proposals will not be committed, effectively halting consensus finality.

## Immediate Actions

1. Check quorum verification engine status:

   ```bash
   kubectl logs -l app=ai-platform --since=20m | grep -E "quorum_verified|quorum_denied|QUORUM_STALL"
   ```

2. Verify voter pool health:
   - Ensure sufficient nodes are available in each consensus group to form quorum.
   - Check for byzantine nodes that may be refusing to vote.

3. Review cross-group routing configuration (`allowCrossGroupRouting`) — if disabled, proposals requiring cross-group quorum will stall.

## Escalation & Recovery

- If the stall persists for more than 15 minutes:
  1. Restart the DistributedConsensusCoordinator pod to reset the quorum engine.
  2. Force-complete pending proposals via the REST API.
  3. Notify SRE and platform security teams immediately — consensus finality is blocked.

## Notes

- Related counters: `hsm_consensus_coord_proposals_routed_total`, `hsm_consensus_coord_quorum_verified_total`, `hsm_consensus_coord_quorum_denied_total`.
