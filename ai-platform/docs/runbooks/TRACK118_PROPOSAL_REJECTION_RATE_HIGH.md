# Runbook: Track 118 Proposal Rejection Rate High

## Alert: Track118ProposalRejectionRateHigh (Warning)

**PromQL**: `rate(hsm_consensus_coord_proposals_rejected_total[5m]) / (rate(hsm_consensus_coord_proposals_routed_total[5m]) + rate(hsm_consensus_coord_proposals_rejected_total[5m]) + 1) > 0.3`

**Threshold**: More than 30% of consensus proposals are being rejected over the last 5 minutes, sustained for 2 minutes. The `+ 1` denominator offset prevents division-by-zero when both counters are at rate 0.

## Impact

Elevated proposal rejection rates indicate possible group routing misconfiguration, stale group references, or unauthorized proposal submission. Clients relying on consensus finality may experience degraded throughput.

## Immediate Actions

1. Inspect rejection reasons in the application logs:

   ```bash
   kubectl logs -l app=ai-platform --since=10m | grep -E "proposal_rejected|PROPOSAL_REJECTED"
   ```

2. Verify that clients are referencing active consensus groups:
   - Check for stale group IDs in client configurations.
   - Use `GET /api/vault/consensus/groups` to list active groups.

3. Review the `allowDynamicGroupCreation` and `allowCrossGroupRouting` policy settings — restrictive settings may cause legitimate proposals to be rejected.

## Escalation & Recovery

- If rejection rate exceeds 50%:
  1. Pause non-critical proposal submission to reduce noise.
  2. Audit recent policy changes via the `POST /api/vault/distributed-consensus-coordinator/policy/validate` endpoint.
  3. Notify the platform security team if unauthorized proposal patterns are detected.

## Notes

- The `+ 1` denominator offset is a division-safety measure — do not remove it or the alert will fire on zero-traffic periods.
- Related counters: `hsm_consensus_coord_proposals_rejected_total`, `hsm_consensus_coord_proposals_routed_total`.
