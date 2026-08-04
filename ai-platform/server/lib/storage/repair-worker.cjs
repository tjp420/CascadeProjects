const EventEmitter = require('events');

class RepairWorker extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.emitter = opts.emitter; // EventEmitter to subscribe to
    this.repairJitterMs = Number(opts.repairJitterMs || 1000);
    this.processingTimeMs = Number(opts.processingTimeMs || 50);
    // active repairs keyed by tenant:shard to ensure idempotency
    this.activeRepairs = new Map();

    // Testing hooks / observability
    this.scheduledDelays = [];
    this.processed = [];

    if (this.emitter) {
      // prefer reconciler-prefixed event but accept legacy event too
      this.emitter.on('shard:reconciler:reconcile_requested', (p) => this.handle(p));
      this.emitter.on('reconcile:requested', (p) => this.handle(p));
    }
  }

  keyFor(payload) {
    return `${payload.tenantId}:${payload.shardId}`;
  }

  handle(payload = {}) {
    const hsmMetrics = require('../hsm-adapter/hsm-metrics.cjs');
    const key = this.keyFor(payload);
    // record repair request
    try { hsmMetrics.incrementCounter('hsm_repair_requests_total', 1); } catch (e) {}
    if (this.activeRepairs.has(key)) {
      this.emit('repair:skipped', { key, payload });
      return;
    }

    this.activeRepairs.set(key, true);

    const jitterMax = Number(payload.repairJitterMs || this.repairJitterMs || 0);
    const delay = Math.random() * jitterMax;
    this.scheduledDelays.push(delay);

    setTimeout(async () => {
      try {
        this.emit('repair:started', { key, payload, delay });
        await this.executeRepair(payload);
        this.processed.push({ key, payload });
        this.emit('repair:done', { key, payload });
      } catch (err) {
        this.emit('error', err);
      } finally {
        this.activeRepairs.delete(key);
      }
    }, delay);
  }

  async executeRepair(payload) {
    const hsmMetrics = require('../hsm-adapter/hsm-metrics.cjs');
    const start = Date.now();
    // Placeholder: simulate repair work duration and return success
    await new Promise((res) => setTimeout(res, this.processingTimeMs));
    const dur = Date.now() - start;
    try { hsmMetrics.observeHistogram('hsm_repair_duration_ms', dur); } catch (e) {}
    if (payload && payload.retryCount) {
      try { hsmMetrics.incrementCounter('hsm_repair_retries_total', Number(payload.retryCount) || 0); } catch (e) {}
    }
    return { ok: true };
  }
}

module.exports = { RepairWorker };
