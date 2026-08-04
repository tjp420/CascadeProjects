"use strict";

const EventEmitter = require('events');

class WorkerPool extends EventEmitter {
  constructor({ concurrency = 4, queueSize = 256 } = {}) {
    super();
    this.concurrency = concurrency;
    this.queueSize = queueSize;
    this.queue = [];
    this.active = 0;
    this.stopping = false;
    this.logger = require('../../app-logger.cjs').child('worker-pool');
  }

  submit(task) {
    if (this.stopping) throw new Error('pool-stopping');
    if (this.queue.length >= this.queueSize) {
      const err = new Error('queue-full');
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
          .then((res) => {
            this.active -= 1;
            try {
              const trace = res && res.meta && res.meta.traceId ? res.meta.traceId : (res && res.traceId) || null;
              const jobId = res && res.meta && res.meta.jobId ? res.meta.jobId : null;
              this.logger.info(`[Trace ID: ${trace || '—'}] [Job: ${jobId || '—'}] task completed`, { traceId: trace, jobId });
            } catch (e) {}
            this.emit('taskDone', null, res);
            this._drain();
          })
          .catch((err) => {
            this.active -= 1;
            try {
              this.logger.error('task error', err && err.stack ? err.stack : err);
            } catch (e) {}
            this.emit('taskDone', err);
            this._drain();
          });
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
