"use strict";

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const WorkerPool = require(path.resolve(process.cwd(), 'server', 'lib', 'hsm-adapter', 'track112', 'worker-pool.cjs'));
const hsmMetrics = require(path.resolve(process.cwd(), 'server', 'lib', 'hsm-adapter', 'hsm-metrics.cjs'));

describe('WorkerPool (Track 397)', () => {
  it('enforces concurrency limit', async () => {
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

  it('rejects tasks once queue is full', () => {
    const pool = new WorkerPool({ concurrency: 1, queueSize: 1 });
    // Fill the queue with one slow task and one active
    pool.submit(() => new Promise((resolve) => setTimeout(resolve, 100)));
    pool.submit(() => new Promise((resolve) => setTimeout(resolve, 100)));
    assert.throws(() => pool.submit(() => {}), /queue-full/);
    pool.stop();
  });

  it('stops accepting new tasks after stop()', async () => {
    const pool = new WorkerPool({ concurrency: 1, queueSize: 10 });
    pool.stop();
    assert.throws(() => pool.submit(() => {}), /pool-stopping/);
  });

  it('emits taskCompleted with duration', async () => {
    const pool = new WorkerPool({ concurrency: 1, queueSize: 2 });
    const completed = [];
    pool.on('taskCompleted', (info) => completed.push(info));
    pool.submit(() => new Promise((resolve) => setTimeout(resolve, 5)));
    await pool.drain();
    assert.strictEqual(completed.length, 1);
    assert.ok(typeof completed[0].durationMs === 'number');
  });
});
