# v3.2.0 Shard Reconciler — Operational Blueprint

Purpose

- Document the operational behavior, metrics, and MTTR targets for the new event-driven shard self-healing system.

Core Concepts

- **Discovery Loop**: `ShardReconciler.verifyShardContinuity()` performs strict, monotonic sequence validation per tenant/shard and emits `shard:reconciler:out_of_sync` and `shard:out_of_sync` on detection.
- **Event-Driven Repair**: Repairs are emitted as `reconcile:requested` (legacy) and `shard:reconciler:reconcile_requested` (preferred) and handled by external repair workers.
- **Cooldown & Rate-Limit**: `ShardReconciler` uses an in-memory cooldown `activeSyncs` map with default `repairCooldownMs = 60000` to avoid repair storms.

Key Telemetry (low-cardinality prefixes)

- `hsm_shard_out_of_sync_total` — total continuity detections
- `hsm_shard_reconciler_repair_requested_total` — repair jobs scheduled
- `hsm_shard_reconciler_repair_skipped_total` — repairs skipped due to cooldown

Events (recommended audit prefixes)

- `shard:reconciler:out_of_sync` — detection payload { tenantId, shardId, reason, expected, found }
- `shard:reconciler:reconcile_requested` — repair payload { tenantId, shardId, fromSeq, toSeq }
- `shard:reconciler:repair_skipped` — cooldown payload { tenantId, shardId, cooldownRemainingMs }

Configuration & Tunables

- `repairCooldownMs` (default: 60000) — per-tenant:shard cooldown window
- `repairJitterMs` (optional) — recommended small random delay added by repair worker to prevent herd effects
- External repair worker should implement exponential backoff and idempotency checks for overlapping ranges.

MTTR Targets & Operational Guidance

- Objective: reduce detected-gap MTTR to < 2 minutes for single-shard outages (configurable via cooldown and worker concurrency).
- For multi-tenant cascading failures, prefer increasing `repairJitterMs` and scaling repair worker pools rather than lowering `repairCooldownMs`.

Runbook (operator steps)

1. If `hsm_shard_reconciler_repair_skipped_total` rises rapidly, inspect `repairCooldownMs` and worker queue depth.
2. If `hsm_shard_out_of_sync_total` spikes, verify network partitions and node health; avoid immediate mass-disable of cooldowns.
3. Use `reconcile:requested` audit events to feed the repair worker backlog and correlate with storage-layer snapshots.

Notes

- The reconciler intentionally keeps discovery and repair decoupled; repair logic belongs in a dedicated worker to preserve the discovery loop's responsiveness.
