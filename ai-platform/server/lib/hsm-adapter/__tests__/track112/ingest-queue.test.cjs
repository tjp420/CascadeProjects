"use strict";

const IngestQueue = require('../../track112/ingest-queue.cjs');
const hsmMetrics = require('../../hsm-metrics.cjs');

describe('Track112 ingest queue prototype', () => {
  beforeEach(() => hsmMetrics.reset());

  test('processes submitted payloads and respects backpressure', async () => {
    const q = new IngestQueue({ concurrency: 2, queueSize: 10, backpressureThreshold: 8 });
    for (let i = 0; i < 6; i++) q.submit({ id: i, body: 'x'.repeat(100) }, { tenant: `t${i%2}` });
    await q.drain();
    expect(q.pool.active).toBe(0);
    expect(hsmMetrics.getMetrics().hsm_track112_worker_task_done_total).toBe(6);
    q.stop();
  });

  test('rejects when queue hits backpressure threshold', () => {
    const q = new IngestQueue({ concurrency: 1, queueSize: 10, backpressureThreshold: 2 });
    q.submit({ id: 1 });
    q.submit({ id: 2 });
    expect(() => q.submit({ id: 3 })).toThrow();
    expect(hsmMetrics.getMetrics().hsm_track112_ingest_backpressure_total).toBe(1);
    q.stop();
  });

  test('drops oldest item with overflow=drop', () => {
    const q = new IngestQueue({ concurrency: 1, queueSize: 10, backpressureThreshold: 2, overflow: 'drop' });
    const dropped = [];
    q.pool.on('dropped', (task, meta) => dropped.push({ task, meta }));
    q.submit({ id: 1 });
    q.submit({ id: 2 });
    q.submit({ id: 3 }, { traceId: 't3' });
    expect(dropped.length).toBe(1);
    expect(q.getState().dropped).toBe(1);
    q.stop();
  });

  test('propagates traceId through processing', async () => {
    const q = new IngestQueue({ concurrency: 1, queueSize: 4, backpressureThreshold: 4 });
    const processed = [];
    q.pool.on('processed', (result) => processed.push(result));
    q.submit({ id: 1 }, { traceId: 'trace-abc' });
    await q.drain();
    expect(processed.length).toBe(1);
    expect(processed[0].traceId).toBe('trace-abc');
    q.stop();
  });
});
