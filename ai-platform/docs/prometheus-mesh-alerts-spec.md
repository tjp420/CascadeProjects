# Prometheus Alerting Specification — Track 115 Mesh State-Reconciliation

## Purpose

This document defines the active monitoring and alerting surface for the Track 115 PQC Multi-Enclave Confidential Mesh State-Reconciliation Gating Hub. The alerts provide early warning for:

- Elevated claim rejection rates at the 10-second epoch finality boundary.
- Latency drift that pushes otherwise-valid claims over the boundary.
- Sudden drops in successful mesh state reconciliations or epoch finality completions.

## Metrics in scope

The `hsm-metrics.cjs` module exposes the following counters via the `/api/vault/multi-enclave-confidential-mesh-state-reconciliation/telemetry` endpoint:

- `hsm_meshgate_pool_initialized_total` — pools initialized.
- `hsm_zk_mesh_state_reconciled_total` — claims validated within the window.
- `hsm_epoch_finality_completed_total` — epoch finality completions.
- `hsm_meshgate_challenge_issued_total` — claims dropped/rejected (window exceeded, depth, quorum, scheme, etc.).

The Prometheus server is configured to scrape the HSM vault telemetry endpoint with an admin-scoped token.

## Alert groups

### 1. `MeshReconciliationBoundaryDrift`

Fires when the drop ratio over a 5-minute window exceeds 10% of all claims. This indicates clock drift, network delay, or a misconfigured `maxEpochFinalityWindowSeconds` boundary.

```promql
rate(hsm_meshgate_challenge_issued_total[5m])
/
(
  rate(hsm_zk_mesh_state_reconciled_total[5m])
  +
  rate(hsm_meshgate_challenge_issued_total[5m])
)
> 0.1
```

### 2. `MeshReconciliationHighDropRate`

Fires when the absolute challenge-issued rate exceeds 100/second for 2 minutes. This may be caused by a replay attack, a stale client fleet, or a downstream enclave outage.

```promql
rate(hsm_meshgate_challenge_issued_total[2m]) > 100
```

### 3. `MeshStateReconciliationStall`

Fires when successful mesh state reconciliations stop increasing for 10 minutes while new pools are still being initialized.

```promql
rate(hsm_zk_mesh_state_reconciled_total[10m]) == 0
and
rate(hsm_meshgate_pool_initialized_total[10m]) > 0
```

### 4. `MeshEpochFinalityStall`

Fires when no epoch finality completions are observed for 15 minutes despite ongoing reconciliations.

```promql
rate(hsm_epoch_finality_completed_total[15m]) == 0
and
rate(hsm_zk_mesh_state_reconciled_total[15m]) > 0
```

## Severity and routing

| Alert | Severity | Routing | Typical response |
|-------|----------|---------|------------------|
| `MeshReconciliationBoundaryDrift` | warning | `#sre-mesh` | Review `maxEpochFinalityWindowSeconds` policy and NTP sync. |
| `MeshReconciliationHighDropRate` | critical | `#sre-mesh` `#security` | Investigate replay or enclave attestation health. |
| `MeshStateReconciliationStall` | critical | `#sre-mesh` | Inspect validator and HSM adapter logs. |
| `MeshEpochFinalityStall` | warning | `#sre-mesh` | Check quorum availability and ethics attestation flow. |

## Runbook references

- `docs/runbooks/MESH_BOUNDARY_DRIFT.md` (to be authored)
- `docs/runbooks/MESH_HIGH_DROP_RATE.md` (to be authored)
- `docs/runbooks/MESH_RECONCILIATION_STALL.md` (to be authored)
- `docs/runbooks/MESH_EPOCH_FINALITY_STALL.md` (to be authored)

## Dashboard panels

A Grafana dashboard row for Track 115 should include:

1. Time series of `hsm_zk_mesh_state_reconciled_total` and `hsm_meshgate_challenge_issued_total` rates.
2. Gauge of the current drop ratio over the last 5 minutes.
3. Single-stat of `hsm_epoch_finality_completed_total` over the last hour.
4. Table of active alert states from the `MeshReconciliationBoundaryDrift` group.
