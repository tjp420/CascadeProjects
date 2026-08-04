const EventEmitter = require('events');
const { setTimeout } = require('timers');

// Simple worker skeleton for shard reconciliation
class ShardReconciler extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.running = false;
    this.pollIntervalMs = opts.pollIntervalMs || 10_000;
    // Low-cardinality telemetry counter (increment when out-of-sync detected)
    this.metrics = { hsm_shard_out_of_sync_total: 0 };
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._loop();
    this.emit('started');
  }

  stop() {
    this.running = false;
    this.emit('stopped');
  }

  _loop() {
    if (!this.running) return;
    // placeholder: discover shards that may be out-of-sync
    Promise.resolve()
      .then(() => this.verifyShardContinuity())
      .catch((err) => this.emit('error', err))
      .finally(() => {
        setTimeout(() => this._loop(), this.pollIntervalMs);
      });
  }

  // verify continuity; returns array of shard ids needing reconciliation
  async verifyShardContinuity() {
    // TODO: implement discovery across storage backends
    // For now return empty list
    return [];
  }

  // Trigger a reconciliation flow for provided shard ids
  async triggerSync(shardIds = [], opts = {}) {
    // Emit event so test harness / worker orchestration can handle it
    this.emit('reconcile:requested', { shardIds, opts });
    // increment out-of-sync metric as a hint (only when non-empty)
    if (shardIds && shardIds.length) this.metrics.hsm_shard_out_of_sync_total += shardIds.length;
    // placeholder: perform reconciliation and return result
    return { ok: true, reconciled: [] };
  }
}

module.exports = { ShardReconciler };
