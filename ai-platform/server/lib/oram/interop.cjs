/*
 * Interop layer between Mixnet batches and Path ORAM block fetches.
 * - Fixed batch size: 16
 * - Uses existing DRBG for deterministic dummy padding
 */

const drbg = require('../mixnet/drbg.cjs');

const DEFAULT_BATCH_SIZE = 16;

/**
 * Quantize a list of block IDs to a fixed batch size by padding with DRBG-derived dummy IDs.
 * @param {Array<string>} blockIds
 * @param {number} batchSize
 * @returns {Array<string>}
 */
function quantizeQueue(blockIds, batchSize = DEFAULT_BATCH_SIZE) {
  const out = Array.isArray(blockIds) ? blockIds.slice() : [];
  while (out.length < batchSize) {
    // deterministically generate a dummy id
    const r = Number(drbg.randomInt(0xffffffff));
    out.push(`dummy-${r.toString(16)}`);
  }
  // if too many, truncate to batchSize (shouldn't normally happen)
  return out.slice(0, batchSize);
}

/**
 * Execute coordinated fetches against the Path ORAM layer.
 * This is a stub: it simulates concurrent fetches and returns placeholder data.
 * @param {Array<string>} quantizedQueue
 * @returns {Promise<Array<{id:string,data:Buffer}>>}
 */
async function executeCoordinatedFetch(quantizedQueue) {
  // Simulate parallel path traversals; actual implementation will call PathORAM APIs.
  return quantizedQueue.map((id) => ({ id, data: Buffer.alloc(32, 0) }));
}

/**
 * Entry point: consume a shuffled mixnet packet batch and perform ORAM-aligned fetches.
 * @param {Array<Object>} packetBatch - array of packets; each should expose a `blockId` field
 * @param {Object} [opts]
 */
async function processMixnetBatch(packetBatch, opts = {}) {
  const batchSize = opts.batchSize || DEFAULT_BATCH_SIZE;
  const blockIds = (Array.isArray(packetBatch) ? packetBatch.map((p) => p && (p.blockId || p.id)).filter(Boolean) : []);
  const quantized = quantizeQueue(blockIds, batchSize);
  const results = await executeCoordinatedFetch(quantized);
  return { ok: true, results };
}

module.exports = {
  processMixnetBatch,
  quantizeQueue,
  executeCoordinatedFetch,
  DEFAULT_BATCH_SIZE,
};
