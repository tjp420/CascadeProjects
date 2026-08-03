/* Interop between Mixnet and Path ORAM - coordinated fetch implementation
 * Fixed batch size default: 16
 */

let drbg = null;
try {
  drbg = require('../mixnet/drbg.cjs');
} catch (e) {
  // fallback to a minimal local DRBG-like shim
  drbg = {
    randomInt: (max) => Math.floor(Math.random() * (max || 0xffffffff)),
  };
}

const DEFAULT_BATCH_SIZE = 16;

function quantizeQueue(blockIds, batchSize = DEFAULT_BATCH_SIZE) {
  const out = Array.isArray(blockIds) ? blockIds.slice() : [];
  while (out.length < batchSize) {
    const r = Number(drbg && typeof drbg.randomInt === 'function' ? drbg.randomInt(0xffffffff) : Math.floor(Math.random() * 0xffffffff));
    out.push(`dummy-${r.toString(16)}`);
  }
  return out.slice(0, batchSize);
}

async function executeCoordinatedFetch(quantizedQueue, opts = {}) {
  // opts: { oram, parallelLimit }
  const oram = opts.oram;
  const parallelLimit = typeof opts.parallelLimit === 'number' ? Math.max(1, opts.parallelLimit) : Infinity;

  // If no ORAM provided, return zeroed buffers (legacy behavior)
  if (!oram) {
    return quantizedQueue.map((id) => ({ id, data: Buffer.alloc(32, 0) }));
  }

  // task for each id
  const tasks = quantizedQueue.map((id) => async () => {
    if (String(id).startsWith('dummy-')) return { id, data: null };
    try {
      // PathORAM access: op, id, data
      const val = await oram.access('read', id);
      return { id, data: val };
    } catch (e) {
      return { id, error: String(e) };
    }
  });

  // simple concurrency limiter
  if (parallelLimit === Infinity) {
    const res = await Promise.all(tasks.map((t) => t()));
    return res;
  }

  const results = new Array(tasks.length);
  let idx = 0;
  const inFlight = [];

  async function runNext() {
    if (idx >= tasks.length) return;
    const cur = idx++;
    const p = tasks[cur]().then((r) => { results[cur] = r; });
    inFlight.push(p);
    p.finally(() => {
      const i = inFlight.indexOf(p);
      if (i >= 0) inFlight.splice(i, 1);
    });
    if (inFlight.length < parallelLimit) {
      return runNext();
    } else {
      await Promise.race(inFlight);
      return runNext();
    }
  }

  // kick off up to parallelLimit initial tasks
  const starters = [];
  for (let i = 0; i < Math.min(parallelLimit, tasks.length); i++) starters.push(runNext());
  await Promise.all(starters);
  // wait for any remaining
  await Promise.all(inFlight);
  return results;
}
/* Interop between Mixnet and Path ORAM - coordinated fetch implementation
 * Fixed batch size default: 16
 */

let drbg = null;
try {
  drbg = require('../mixnet/drbg.cjs');
} catch (e) {
  // fallback to a minimal local DRBG-like shim
  drbg = {
    randomInt: (max) => Math.floor(Math.random() * (max || 0xffffffff)),
  };
}

const DEFAULT_BATCH_SIZE = 16;

function quantizeQueue(blockIds, batchSize = DEFAULT_BATCH_SIZE) {
  const out = Array.isArray(blockIds) ? blockIds.slice() : [];
  while (out.length < batchSize) {
    const r = Number(drbg && typeof drbg.randomInt === 'function' ? drbg.randomInt(0xffffffff) : Math.floor(Math.random() * 0xffffffff));
    out.push(`dummy-${r.toString(16)}`);
  }
  return out.slice(0, batchSize);
}

async function executeCoordinatedFetch(quantizedQueue, opts = {}) {
  // opts: { oram, parallelLimit }
  const oram = opts.oram;
  const parallelLimit = typeof opts.parallelLimit === 'number' ? Math.max(1, opts.parallelLimit) : Infinity;

  // If no ORAM provided, return zeroed buffers (legacy behavior)
  if (!oram) {
    return quantizedQueue.map((id) => ({ id, data: Buffer.alloc(32, 0) }));
  }

  // task for each id
  const tasks = quantizedQueue.map((id) => async () => {
    if (String(id).startsWith('dummy-')) return { id, data: null };
    try {
      // PathORAM access: op, id, data
      const val = await oram.access('read', id);
      return { id, data: val };
    } catch (e) {
      return { id, error: String(e) };
    }
  });

  // simple concurrency limiter
  if (parallelLimit === Infinity) {
    const res = await Promise.all(tasks.map((t) => t()));
    return res;
  }

  const results = new Array(tasks.length);
  let idx = 0;
  const inFlight = [];

  async function runNext() {
    if (idx >= tasks.length) return;
    const cur = idx++;
    const p = tasks[cur]().then((r) => { results[cur] = r; });
    inFlight.push(p);
    p.finally(() => {
      const i = inFlight.indexOf(p);
      if (i >= 0) inFlight.splice(i, 1);
    });
    if (inFlight.length < parallelLimit) {
      return runNext();
    } else {
      await Promise.race(inFlight);
      return runNext();
    }
  }

  // kick off up to parallelLimit initial tasks
  const starters = [];
  for (let i = 0; i < Math.min(parallelLimit, tasks.length); i++) starters.push(runNext());
  await Promise.all(starters);
  // wait for any remaining
  await Promise.all(inFlight);
  return results;
}

>>>>>>> a0fb94cf9 (feat(interop): coordinated fetch -> batch PathORAM reads with optional parallelLimit; test(smoke): verify batched read recovery; telemetry: lock manager)
async function processMixnetBatch(packetBatch, opts = {}) {
  const batchSize = opts.batchSize || DEFAULT_BATCH_SIZE;
  const blockIds = (Array.isArray(packetBatch) ? packetBatch.map((p) => p && (p.blockId || p.id)).filter(Boolean) : []);
  const quantized = quantizeQueue(blockIds, batchSize);
<<<<<<< HEAD
  const results = await executeCoordinatedFetch(quantized);
=======
  const results = await executeCoordinatedFetch(quantized, opts);
>>>>>>> a0fb94cf9 (feat(interop): coordinated fetch -> batch PathORAM reads with optional parallelLimit; test(smoke): verify batched read recovery; telemetry: lock manager)
  return { ok: true, results };
}

module.exports = {
  processMixnetBatch,
  quantizeQueue,
  executeCoordinatedFetch,
  DEFAULT_BATCH_SIZE,
};
