"use strict";

const IngestQueue = require('../../track112/ingest-queue.cjs');

describe('Track112 ingest queue prototype', () => {
  test('processes submitted payloads and respects backpressure', async () => {
    const q = new IngestQueue({ concurrency: 2, queueSize: 10, backpressureThreshold: 8 });
    for (let i = 0; i < 6; i++) q.submit({ id: i, body: 'x'.repeat(100) }, { tenant: `t${i%2}` });
    await q.drain();
    expect(q.pool.active).toBe(0);
    q.stop();
  });

  test('rejects when queue hits backpressure threshold', () => {
    const q = new IngestQueue({ concurrency: 1, queueSize: 10, backpressureThreshold: 2 });
    q.submit({ id: 1 });
    q.submit({ id: 2 });
    expect(() => q.submit({ id: 3 })).toThrow();
    q.stop();
  });
});
