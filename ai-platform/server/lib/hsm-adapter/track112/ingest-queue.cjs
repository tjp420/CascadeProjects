"use strict";

const WorkerPool = require('./worker-pool.cjs');
const hsmMetrics = require('../hsm-metrics.cjs');

class IngestQueue {
  constructor({ concurrency = 4, queueSize = 1024, backpressureThreshold = 768 } = {}) {
    this.pool = new WorkerPool({ concurrency, queueSize });
    this.backpressureThreshold = backpressureThreshold;
  }

  submit(payload, meta = {}) {
    if (this.pool.queue.length >= this.backpressureThreshold) {
      hsmMetrics.incrementCounter('hsm_track112_ingest_backpressure_total');
      const err = new Error('backpressure');
      this.pool.emit('backpressure', payload, meta);
      throw err;
    }
    this.pool.submit(() => this._process(payload, meta));
  }

  async _process(payload, meta) {
    const traceId = meta.traceId || 'unknown';
    const start = process.hrtime.bigint();
    await new Promise((r) => setTimeout(r, 10));
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    // Correlating worker processing with the ingress trace ID
    const result = { ok: true, size: Buffer.byteLength(typeof payload === 'string' ? payload : JSON.stringify(payload)), meta, traceId, durationMs };
    this.pool.emit('processed', result);
    return result;
  }

  async drain() {
    await this.pool.drain();
  }

  stop() { this.pool.stop(); }
}

module.exports = IngestQueue;
