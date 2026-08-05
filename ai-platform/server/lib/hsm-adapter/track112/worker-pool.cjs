"use strict";

const EventEmitter = require('events');
const hsmMetrics = require('../hsm-metrics.cjs');

class WorkerPool extends EventEmitter {
  constructor({ concurrency = 4, queueSize = 256 } = {}) {
    super();
    if (concurrency <= 0) throw new Error('WorkerPool concurrency must be > 0');
    this.concurrency = concurrency;
    this.queueSize = queueSize;
    this.queue = [];
    this.active = 0;
    this.stopping = false;
    this.stopped = false;
    this._tasksDone = 0;
  }

  submit(task) {
    if (this.stopping || this.stopped) throw new Error('pool-stopping');
    if (this.queue.length >= this.queueSize) {
      const err = new Error('queue-full');
      hsmMetrics.incrementCounter('hsm_track112_worker_rejected_total');
      this.emit('rejected', task, err);
      throw err;
    }
    this.queue.push({ task, start: process.hrtime.bigint() });
    this._drain();
  }

  _drain() {
    while (this.active < this.concurrency && this.queue.length) {
      const { task, start } = this.queue.shift();
      this.active += 1;
      Promise.resolve()
        .then(() => task())
        .then((res) => { this._done(start); this.emit('taskDone', null, res); this._drain(); })
        .catch((err) => { this._done(start); this.emit('taskDone', err); this._drain(); });
    }
    if (this.active === 0 && this.queue.length === 0) this.emit('drained');
  }

  _done(start) {
    this.active -= 1;
    this._tasksDone += 1;
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    hsmMetrics.incrementCounter('hsm_track112_worker_task_done_total');
    hsmMetrics.observeHistogram('hsm_track112_worker_duration_ms', ms);
    this.emit('taskCompleted', { durationMs: ms });
  }

  async drain() {
    if (this.queue.length === 0 && this.active === 0) return;
    return new Promise((resolve) => this.once('drained', resolve));
  }

  stop() {
    this.stopping = true;
    if (this.active === 0 && this.queue.length === 0) {
      this.stopped = true;
      this.emit('drained');
    }
  }

  getState() {
    return {
      concurrency: this.concurrency,
      queued: this.queue.length,
      active: this.active,
      stopping: this.stopping,
      stopped: this.stopped,
      tasksDone: this._tasksDone,
    };
  }
}

module.exports = WorkerPool;
