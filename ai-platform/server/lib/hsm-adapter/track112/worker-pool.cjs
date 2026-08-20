"use strict";

const EventEmitter = require("events");
const hsmMetrics = require("../hsm-metrics.cjs");

/**
 * RingBuffer — O(1) push/shift circular buffer.
 *
 * Replaces the previous Array-based queue where shift() was O(n).
 * Exposes push(), shift(), and a length getter for drop-in compatibility
 * with the WorkerPool and IngestQueue call sites.
 */
class RingBuffer {
  constructor(capacity) {
    if (capacity <= 0) throw new Error("RingBuffer capacity must be > 0");
    this._capacity = capacity;
    this._buf = new Array(capacity);
    this._head = 0; // next dequeue index
    this._tail = 0; // next enqueue index
    this._count = 0;
  }

  push(item) {
    this._buf[this._tail] = item;
    this._tail = (this._tail + 1) % this._capacity;
    this._count += 1;
  }

  shift() {
    if (this._count === 0) return undefined;
    const item = this._buf[this._head];
    this._buf[this._head] = undefined; // release reference
    this._head = (this._head + 1) % this._capacity;
    this._count -= 1;
    return item;
  }

  get length() {
    return this._count;
  }

  get capacity() {
    return this._capacity;
  }
}

class WorkerPool extends EventEmitter {
  constructor({ concurrency = 4, queueSize = 256 } = {}) {
    super();
    if (concurrency <= 0) throw new Error("WorkerPool concurrency must be > 0");
    this.concurrency = concurrency;
    this.queueSize = queueSize;
    this.queue = new RingBuffer(queueSize);
    this.active = 0;
    this.stopping = false;
    this.stopped = false;
    this._tasksDone = 0;
  }

  submit(task) {
    if (this.stopping || this.stopped) throw new Error("pool-stopping");
    if (this.queue.length >= this.queueSize) {
      const err = new Error("queue-full");
      hsmMetrics.incrementCounter("hsm_track112_worker_rejected_total");
      this.emit("rejected", task, err);
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
        .then((res) => {
          this._done(start);
          this.emit("taskDone", null, res);
          this._drain();
        })
        .catch((err) => {
          this._done(start);
          this.emit("taskDone", err);
          this._drain();
        });
    }
    if (this.active === 0 && this.queue.length === 0) this.emit("drained");
  }

  _done(start) {
    this.active -= 1;
    this._tasksDone += 1;
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    hsmMetrics.incrementCounter("hsm_track112_worker_task_done_total");
    hsmMetrics.observeHistogram("hsm_track112_worker_duration_ms", ms);
    this.emit("taskCompleted", { durationMs: ms });
  }

  async drain() {
    if (this.queue.length === 0 && this.active === 0) return;
    return new Promise((resolve) => this.once("drained", resolve));
  }

  stop() {
    this.stopping = true;
    if (this.active === 0 && this.queue.length === 0) {
      this.stopped = true;
      this.emit("drained");
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
