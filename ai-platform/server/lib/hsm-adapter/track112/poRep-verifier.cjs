"use strict";

const crypto = require('crypto');
const hsmMetrics = require('../hsm-metrics.cjs');
const jcs = require('../../canonical/jcs.cjs');

function toBufferFromEncoded(v) {
  if (Buffer.isBuffer(v)) return v;
  if (typeof v !== 'string') return Buffer.from(String(v));
  if (/^[0-9a-fA-F]+$/.test(v) && v.length % 2 === 0) return Buffer.from(v, 'hex');
  return Buffer.from(v, 'base64');
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest();
}

function computeRootFromPath(leafHashBuf, index, pathArray) {
  let cur = Buffer.from(leafHashBuf);
  let idx = index;
  for (let i = 0; i < pathArray.length; i++) {
    const sibling = toBufferFromEncoded(pathArray[i]);
    if (idx % 2 === 0) {
      cur = sha256(Buffer.concat([cur, sibling]));
    } else {
      cur = sha256(Buffer.concat([sibling, cur]));
    }
    idx = Math.floor(idx / 2);
  }
  return cur.toString('hex');
}

class PoRepVerifier {
  constructor(opts = {}) {
    this.leafSize = opts.leafSize || 4096; // 4 KiB default
    this.metrics = { verifications: 0, failures: 0 };
  }

  async verify(proof, options = {}) {
    this.metrics.verifications += 1;
    try {
      if (!hsmMetrics.counters.hsm_track112_proofs_verified_total) hsmMetrics.counters.hsm_track112_proofs_verified_total = 0;
      if (!hsmMetrics.counters.hsm_track112_proofs_failed_total) hsmMetrics.counters.hsm_track112_proofs_failed_total = 0;
    } catch (e) {}

    if (!proof || !proof.root || !Array.isArray(proof.challenges) || proof.challenges.length === 0) {
      try { hsmMetrics.incrementCounter('hsm_track112_proofs_failed_total'); } catch (e) {}
      this.metrics.failures += 1;
      return { valid: false, reason: 'malformed_proof' };
    }

    const rootHex = proof.root.replace(/^0x/, '').toLowerCase();
    for (const ch of proof.challenges) {
      const leafBuf = toBufferFromEncoded(ch.leaf);
      const leafHash = sha256(leafBuf);
      const computedRoot = computeRootFromPath(leafHash, ch.index, ch.path || []);
      // compute a canonical digest for the computed root for deterministic logging/telemetry
      try {
        const canonicalRootDigest = jcs.canonicalDigest({ root: computedRoot }, 'hex');
        // attach to metrics or logs if available
        // hsmMetrics.record('porep_computed_root_digest', canonicalRootDigest);
      } catch (e) {}
      if (computedRoot.toLowerCase() !== rootHex) {
        try { hsmMetrics.incrementCounter('hsm_track112_proofs_failed_total'); } catch (e) {}
        this.metrics.failures += 1;
        return { valid: false, reason: 'challenge_mismatch', index: ch.index };
      }
    }

    try { hsmMetrics.incrementCounter('hsm_track112_proofs_verified_total'); } catch (e) {}
    return { valid: true };
  }
}

module.exports = PoRepVerifier;
