"use strict";

const IngestQueue = require('../../track112/ingest-queue.cjs');

describe('Track112 trace propagation', () => {
  test('traceId in meta is available to worker result meta', async () => {
    const q = new IngestQueue({ concurrency: 1, queueSize: 10, backpressureThreshold: 8 });
    const traceId = 'trace-12345';

    // Attach a one-time listener to capture the result
    const p = new Promise((resolve) => {
      q.pool.once('taskDone', (err, res) => resolve({ err, res }));
    });

    q.submit({ foo: 'bar' }, { traceId, jobId: 'job-1' });
    const { err, res } = await p;
    expect(err).toBeNull();
    expect(res).toBeDefined();
    expect(res.meta).toBeDefined();
    expect(res.meta.traceId).toBe(traceId);
    q.stop();
  });
});
