const { acquire, getMetrics, resetMetrics } = require('../../server/lib/oram/lock_manager.cjs');

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function testSerialization() {
  const bucket = 'bucket-1';
  const holders = [];

  for (let i = 0; i < 3; i++) {
    holders.push((async () => {
      const startWait = Date.now();
      const lock = await acquire(bucket, 2000);
      const start = Date.now();
      // hold for 100ms
      await sleep(100);
      const end = Date.now();
      lock.release();
      return { startWait, start, end };
    })());
  }

  const results = await Promise.all(holders);
  // Ensure no overlap: next.start >= prev.end for sorted by start
  const sorted = results.slice().sort((a,b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start < sorted[i-1].end) {
      throw new Error('Lock holders overlapped; serialization failed');
    }
  }
  console.log('Serialization test: PASS');
}

async function testConcurrencyDifferentBuckets() {
  const b1 = 'bucket-A';
  const b2 = 'bucket-B';
  const t = [];
  const startTimes = [];

  t.push((async () => {
    const lock = await acquire(b1, 2000);
    startTimes.push(Date.now());
    await sleep(200);
    lock.release();
  })());

  t.push((async () => {
    const lock = await acquire(b2, 2000);
    startTimes.push(Date.now());
    await sleep(200);
    lock.release();
  })());

  await Promise.all(t);
  // If they ran concurrently, start times should be within 200ms of each other
  const diff = Math.abs(startTimes[0] - startTimes[1]);
  if (diff > 200) throw new Error('Different-bucket concurrency failed');
  console.log('Different-bucket concurrency test: PASS');
}

(async () => {
  try {
    await testSerialization();
    await testConcurrencyDifferentBuckets();
    // Print telemetry snapshot after successful smoke tests
    try {
      const metrics = getMetrics();
      console.log('LOCK MANAGER METRICS:', JSON.stringify(metrics, null, 2));
    } catch (e) {
      console.warn('Failed to read lock manager metrics', e && e.stack ? e.stack : e);
    }
    console.log('LOCK MANAGER SMOKE: ALL PASS');
    process.exit(0);
  } catch (err) {
    console.error('LOCK MANAGER SMOKE: FAIL', err && err.stack ? err.stack : err);
    process.exit(2);
  }
})();
