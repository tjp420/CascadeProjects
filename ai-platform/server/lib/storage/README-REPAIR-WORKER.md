## RepairWorker — Asynchronous Shard Repair Worker

This document describes how to deploy and operate the **RepairWorker** that consumes shard reconciliation events and performs idempotent repairs with coordinated jitter and observability.

**Location**: ai-platform/server/lib/storage/repair-worker.cjs

Key concepts
- **Event-Driven**: The worker subscribes to `shard:reconciler:reconcile_requested` events emitted by the reconciler.
- **Coordinated Jitter**: Use the `repairJitterMs` value included in the event payload to sample a uniform delay in `[0, repairJitterMs]` before attempting a repair. This prevents repair storms.
- **Idempotency**: The worker must use an idempotency key composed from `tenantId|shardId|rotatedAt` to avoid duplicate work.
- **Observability**: Expose counters for **repair_started**, **repair_succeeded**, **repair_failed**, and **repair_skipped_duplicate** with labels `{tenantId, shardId, worker}`.

Bootstrapping

1. Ensure the reconciler is running in discovery mode and emitting reconcile requests (see `shard-reconciler.cjs`).
2. Start the RepairWorker process with the same Node runtime used by the platform (Node 18+ recommended).

Systemd example (optional)
```ini
[Unit]
Description=SimpleBeacon RepairWorker
After=network.target

[Service]
Type=simple
User=svc-sb
WorkingDirectory=/srv/cascade/CascadeProjects
ExecStart=/usr/bin/node ai-platform/server/lib/storage/repair-worker.cjs
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Configuration and Environment
- **TRACK113_KEK**: Key encryption key used by session persistence (if the worker needs to read encrypted session blobs). Provide via secure secret manager or environment.
- **REPAIR_WORKER_CONCURRENCY**: Maximum concurrent repairs in the process (default: 4).
- **REPAIR_METRICS_PREFIX**: Metric name prefix (default: `hsm_shard_reconciler`).

Subscription and processing pattern

1. Subscribe to `shard:reconciler:reconcile_requested`.
2. On event:
   - Read `tenantId`, `shardId`, `rotatedAt`, `repairJitterMs`.
   - Compute `idempotencyKey = `${tenantId}|${shardId}|${rotatedAt}``.
   - If `idempotencyKey` is in the in-memory or distributed lock store, increment **repair_skipped_duplicate** and return.
   - Sample `delayMs = Math.floor(Math.random() * (repairJitterMs + 1))` and `await sleep(delayMs)`.
   - Perform repair steps (see Implementation notes).
   - On success, emit `shard:reconciler:repair_completed` and increment **repair_succeeded**.
   - On failure, increment **repair_failed** and record a retry / backoff per your job policy.

Implementation notes (concrete)
- The worker should implement these concrete operations as the repair core:
  1. Fetch remote/shard state for `shardId` from the canonical shard provider API.
  2. Compute missing sequence ranges or dangling events for the tenant.
  3. Apply missing entries with strict monotonic validation (seq must be last+1).
  4. Persist changes with **atomic writes** (use `writeAtomicSync` or equivalent) and encrypt sensitive fields using the AES-256-GCM envelope helpers if needed.

Testing and local run

Run the unit tests for the worker:
```bash
node ai-platform/server/lib/storage/__tests__/repair-worker.test.cjs
```

Manual quick-run (dev):
```bash
REPAIR_WORKER_CONCURRENCY=2 node ai-platform/server/lib/storage/repair-worker.cjs
```

Observability mapping
- **Counters**: `hsm_shard_reconciler_repair_started_total`, `hsm_shard_reconciler_repair_succeeded_total`, `hsm_shard_reconciler_repair_failed_total`, `hsm_shard_reconciler_repair_skipped_duplicate_total`.
- **Labels**: `tenantId`, `shardId`, `worker`.
- **Logs**: Include structured logs with fields `tenantId`, `shardId`, `rotatedAt`, `idempotencyKey`, `durationMs`, `outcome`.

Security and tenant isolation
- The worker must operate under least privilege. Any credentials used to fetch or apply shard data must be tenant-scoped or use an admin route guarded by tenant authorization.
- Avoid writing long-term secrets to disk. Use envelope encryption when persisting sensitive session material.

FAQ / Troubleshooting
- Q: Worker keeps skipping jobs as duplicates — A: Confirm `rotatedAt` timestamps are correct and monotonic; consider persistent idempotency store if multi-process.
- Q: Repair storms observed — A: Increase `repairJitterMs` and validate reconciler cooldown settings (`repairCooldownMs`).

Contact
- For design questions, open an issue or contact the storage team lead.
