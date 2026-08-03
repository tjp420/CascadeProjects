// Fine-grained in-memory bucket lock manager
// Provides FIFO acquisition per bucketId with a timeout to avoid deadlocks.

const { performance } = require('perf_hooks');
const queues = new Map();

// Telemetry counters
const metrics = {
  totalAcquisitions: 0,
  totalWaitMicroseconds: 0, // sum of wait durations
  maxWaitMicroseconds: 0,
  contentionCount: 0, // number of times acquire saw a non-empty queue
  timeoutCount: 0,
};

/**
 * Acquire a lock for a bucketId. Resolves to an object { release() } when acquired.
 * @param {string} bucketId
 * @param {number} timeoutMs
 * @returns {Promise<{release:Function}>}
 */
function acquire(bucketId, timeoutMs = 5000) {
  const callStart = performance.now();

  if (!queues.has(bucketId)) queues.set(bucketId, []);
  const q = queues.get(bucketId);

  let resolveAcquire;
  let rejectAcquire;
  const entry = new Promise((resolve, reject) => {
    resolveAcquire = resolve;
    rejectAcquire = reject;
  });

  const node = { resolveAcquire, rejectAcquire };

  // record contention if queue already has someone
  if (q.length > 0) metrics.contentionCount++;

  q.push(node);

  // If we're first in queue, resolve immediately
  if (q[0] === node) {
    resolveAcquire();
  }

  // Timeout handling
  const timer = setTimeout(() => {
    const curQ = queues.get(bucketId) || [];
    const idx = curQ.indexOf(node);
    if (idx >= 0) curQ.splice(idx, 1);
    if (curQ.length === 0) queues.delete(bucketId);
    metrics.timeoutCount++;
    node.rejectAcquire(new Error('lock timeout'));
  }, timeoutMs);

  return entry.then(() => {
    clearTimeout(timer);
    const acquiredAt = performance.now();
    const waitUs = Math.max(0, Math.round((acquiredAt - callStart) * 1000));
    metrics.totalAcquisitions++;
    metrics.totalWaitMicroseconds += waitUs;
    if (waitUs > metrics.maxWaitMicroseconds) metrics.maxWaitMicroseconds = waitUs;

    let released = false;
    return {
      release: () => {
        if (released) return;
        released = true;
        const cur = queues.get(bucketId) || [];
        // remove head
        if (cur.length > 0) cur.shift();
        if (cur.length === 0) {
          queues.delete(bucketId);
        } else {
          // wake next
          const next = cur[0];
          try {
            next.resolveAcquire();
          } catch (e) {
            // ignore
          }
        }
      }
    };
  });
}

function getMetrics() {
  // return an immutable snapshot
  return Object.assign({}, metrics, {
    avgWaitMicroseconds: metrics.totalAcquisitions === 0 ? 0 : Math.round(metrics.totalWaitMicroseconds / metrics.totalAcquisitions),
  });
}

function resetMetrics() {
  metrics.totalAcquisitions = 0;
  metrics.totalWaitMicroseconds = 0;
  metrics.maxWaitMicroseconds = 0;
  metrics.contentionCount = 0;
  metrics.timeoutCount = 0;
}

module.exports = { acquire, getMetrics, resetMetrics };
