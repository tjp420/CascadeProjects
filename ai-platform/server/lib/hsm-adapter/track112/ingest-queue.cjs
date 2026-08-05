"use strict";

const WorkerPool = require('./worker-pool.cjs');
const hsmMetrics = require('../hsm-metrics.cjs');

class IngestQueue {
  constructor({
    concurrency = 4,
    queueSize = 1024,
    backpressureThreshold = 768,
    overflow = 'backpressure',
  } = {}) {
    if (overflow !== 'backpressure' && overflow !== 'drop' && typeof overflow !== 'function') {
      throw new Error('IngestQueue overflow must be "backpressure", "drop", or a function');
    }
    this.pool = new WorkerPool({ concurrency, queueSize });
    this.backpressureThreshold = backpressureThreshold;
    this.overflow = overflow;
    this._dropped = 0;

    this.pool.on('rejected', (_task, err) => {
      if (err && err.message === 'queue-full') {
        hsmMetrics.incrementCounter('hsm_track112_ingest_backpressure_total');
      }
    });
  }

  _inFlight() {
    return this.pool.queue.length + this.pool.active;
  }

  submit(payload, meta = {}) {
    if (this._inFlight() >= this.backpressureThreshold) {
      if (this.overflow === 'backpressure') {
        hsmMetrics.incrementCounter('hsm_track112_ingest_backpressure_total');
        const err = new Error('backpressure');
        this.pool.emit('backpressure', payload, meta);
        throw err;
      }
      if (this.overflow === 'drop') {
        // Drop the oldest queued task to make room
        const dropped = this.pool.queue.shift();
        this._dropped += 1;
        this.pool.emit('dropped', dropped && dropped.task, meta);
      } else if (typeof this.overflow === 'function') {
        this.overflow(this, payload, meta);
      }
    }
    this.pool.submit(() => this._process(payload, meta));
  }

  async _process(payload, meta) {
    const traceId = meta.traceId || 'unknown';
    const start = process.hrtime.bigint();
    await new Promise((r) => setTimeout(r, 10));
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const result = { ok: true, size: Buffer.byteLength(typeof payload === 'string' ? payload : JSON.stringify(payload)), meta, traceId, durationMs };
    this.pool.emit('processed', result);
    return result;
  }

  getState() {
    const poolState = this.pool.getState();
    return {
      ...poolState,
      backpressureThreshold: this.backpressureThreshold,
      dropped: this._dropped,
    };
  }

  async drain() {
    await this.pool.drain();
  }

  stop() { this.pool.stop(); }
}

module.exports = IngestQueue;
