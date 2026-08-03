const fs = require('fs');
const path = require('path');

const AUDIT = require('../dkg/auditor.cjs');

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/**
 * Publish a proof to local proofs folder and append to DKG auditor with retries.
 * opts: { maxAttempts=5, baseDelay=200, maxDelay=10000 }
 */
async function publishProof({ taskId, params, proof, epochId } = {}, opts = {}) {
  const dir = path.join(__dirname, '.proofs');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${taskId || Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify({ params, proof, ts: new Date().toISOString() }, null, 2));

  const maxAttempts = opts.maxAttempts || 5;
  const baseDelay = opts.baseDelay || 200; // ms
  const maxDelay = opts.maxDelay || 10000; // ms

  let attempt = 0;
  let lastErr = null;
  while (attempt < maxAttempts) {
    try {
      await AUDIT.appendProof(epochId, taskId, { params, proof });
      return { file, appended: true };
    } catch (err) {
      lastErr = err;
      attempt++;
      const delay = Math.min(maxDelay, baseDelay * (2 ** attempt));
      const jitter = Math.floor(Math.random() * baseDelay);
      await sleep(delay + jitter);
    }
  }

  return { file, appended: false, error: String(lastErr) };
}

module.exports = { publishProof };