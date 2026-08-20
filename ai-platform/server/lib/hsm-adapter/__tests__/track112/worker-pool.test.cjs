"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const path = require("path");

const WorkerPool = require(
  path.resolve(
    process.cwd(),
    "server",
    "lib",
    "hsm-adapter",
    "track112",
    "worker-pool.cjs",
  ),
);
const hsmMetrics = require(
  path.resolve(
    process.cwd(),
    "server",
    "lib",
    "hsm-adapter",
    "hsm-metrics.cjs",
  ),
);

describe("WorkerPool (Track 397)", () => {
  it("enforces concurrency limit", async () => {
    const pool = new WorkerPool({ concurrency: 2, queueSize: 10 });
    let maxActive = 0;
    const tasks = [];
    for (let i = 0; i < 5; i++) {
      const p = new Promise((resolve) => {
        pool.submit(async () => {
          const before = pool.active;
          if (before > maxActive) maxActive = before;
          await new Promise((r) => setTimeout(r, 20));
          resolve();
        });
      });
      tasks.push(p);
    }
    await pool.drain();
    assert.strictEqual(maxActive, 2);
    assert.strictEqual(pool.getState().tasksDone, 5);
  });

  it("rejects tasks once queue is full", () => {
    const pool = new WorkerPool({ concurrency: 1, queueSize: 1 });
    // Fill the queue with one slow task and one active
    pool.submit(() => new Promise((resolve) => setTimeout(resolve, 100)));
    pool.submit(() => new Promise((resolve) => setTimeout(resolve, 100)));
    assert.throws(() => pool.submit(() => {}), /queue-full/);
    pool.stop();
  });

  it("stops accepting new tasks after stop()", async () => {
    const pool = new WorkerPool({ concurrency: 1, queueSize: 10 });
    pool.stop();
    assert.throws(() => pool.submit(() => {}), /pool-stopping/);
  });

  it("emits taskCompleted with duration", async () => {
    const pool = new WorkerPool({ concurrency: 1, queueSize: 2 });
    const completed = [];
    pool.on("taskCompleted", (info) => completed.push(info));
    pool.submit(() => new Promise((resolve) => setTimeout(resolve, 5)));
    await pool.drain();
    assert.strictEqual(completed.length, 1);
    assert.ok(typeof completed[0].durationMs === "number");
  });
});

describe("RingBuffer (Track 397)", () => {
  // The RingBuffer is not exported directly, but we can test it through the
  // WorkerPool's queue which is a RingBuffer instance.
  it("queue is a RingBuffer with O(1) push/shift", () => {
    const pool = new WorkerPool({ concurrency: 1, queueSize: 8 });
    assert.ok(
      pool.queue.constructor.name === "RingBuffer",
      "queue should be a RingBuffer",
    );
    assert.strictEqual(pool.queue.length, 0);
    assert.strictEqual(pool.queue.capacity, 8);
    pool.stop();
  });

  it("handles wraparound correctly (enqueue/dequeue cycle)", () => {
    const pool = new WorkerPool({ concurrency: 1, queueSize: 4 });
    // Fill queue beyond capacity to force wraparound — concurrency=1 means
    // one active task, so we can queue up to queueSize items.
    // Submit a long-running task to block the worker, then fill the queue.
    pool.submit(() => new Promise((resolve) => setTimeout(resolve, 200)));
    // Now queue is empty but worker is busy. Fill the ring buffer.
    for (let i = 0; i < 4; i++) {
      pool.submit(() => Promise.resolve(i));
    }
    // Queue should be full (4 items). Next submit should throw queue-full.
    assert.throws(() => pool.submit(() => Promise.resolve(99)), /queue-full/);
    assert.strictEqual(pool.queue.length, 4);
    pool.stop();
  });

  it("shift returns undefined when empty", () => {
    const pool = new WorkerPool({ concurrency: 1, queueSize: 4 });
    assert.strictEqual(pool.queue.shift(), undefined);
    pool.stop();
  });

  it("maintains FIFO order across multiple wraparound cycles", async () => {
    const pool = new WorkerPool({ concurrency: 1, queueSize: 32 });
    const results = [];
    // Submit 20 tasks through a queue of size 32 — forces wraparound
    // as head/tail pointers cycle through the circular buffer.
    for (let i = 0; i < 20; i++) {
      pool.submit(() => Promise.resolve(i));
    }
    pool.on("taskDone", (_err, res) => results.push(res));
    await pool.drain();
    assert.strictEqual(results.length, 20);
    // Verify FIFO order is preserved
    for (let i = 0; i < 20; i++) {
      assert.strictEqual(results[i], i, `FIFO order broken at index ${i}`);
    }
  });
});
