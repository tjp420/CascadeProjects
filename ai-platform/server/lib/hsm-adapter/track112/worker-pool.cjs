"use strict";

const EventEmitter = require('events');
const hsmMetrics = require('../hsm-metrics.cjs');

class WorkerPool extends EventEmitter {
  constructor({ concurrency = 4, queueSize = 256 } = {}) {
    super();
    this.concurrency = concurrency;
    this.queueSize = queueSize;
    this.queue = [];
    this.active = 0;
    this.stopping = false;
  }

  submit(task) {
    if (this.stopping) throw new Error('pool-stopping');
    if (this.queue.length >= this.queueSize) {
      const err = new Error('queue-full');
      hsmMetrics.incrementCounter('hsm_track112_worker_rejected_total');
      this.emit('rejected', task, err);
      throw err;
    }
    this.queue.push(task);
    this._drain();
  }

  _drain() {
    setImmediate(() => {
      while (this.active < this.concurrency && this.queue.length) {
        const task = this.queue.shift();
        this.active += 1;
        Promise.resolve()
          .then(() => task())
          .then((res) => { this.active -= 1; hsmMetrics.incrementCounter('hsm_track112_worker_task_done_total'); this.emit('taskDone', null, res); this._drain(); })
          .catch((err) => { this.active -= 1; hsmMetrics.incrementCounter('hsm_track112_worker_task_done_total'); this.emit('taskDone', err); this._drain(); });
      }
      if (this.active === 0 && this.queue.length === 0) this.emit('drained');
    });
  }

  async drain() {
    if (this.queue.length === 0 && this.active === 0) return;
    return new Promise((resolve) => this.once('drained', resolve));
  }

  stop() {
    this.stopping = true;
    if (this.active === 0 && this.queue.length === 0) this.emit('drained');
  }
}

module.exports = WorkerPool;
