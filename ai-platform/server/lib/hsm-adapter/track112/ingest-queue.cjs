"use strict";

const WorkerPool = require('./worker-pool.cjs');

class IngestQueue {
  constructor({ concurrency = 4, queueSize = 1024, backpressureThreshold = 768 } = {}) {
    this.pool = new WorkerPool({ concurrency, queueSize });
    this.backpressureThreshold = backpressureThreshold;
  }

  submit(payload, meta = {}) {
    if (this.pool.queue.length >= this.backpressureThreshold) {
      const err = new Error('backpressure');
      this.pool.emit('backpressure', payload, meta);
      throw err;
    }
    // Ensure traceId propagation inside the job envelope
    const jobMeta = Object.assign({}, meta);
    if (meta && meta.traceId) jobMeta.traceId = meta.traceId;
    this.pool.submit(() => this._process(payload, jobMeta));
  }

  async _process(payload, meta) {
    await new Promise((r) => setTimeout(r, 10));
    return { ok: true, size: Buffer.byteLength(typeof payload === 'string' ? payload : JSON.stringify(payload)), meta };
  }

  async drain() {
    await this.pool.drain();
  }

  stop() { this.pool.stop(); }
}

module.exports = IngestQueue;
