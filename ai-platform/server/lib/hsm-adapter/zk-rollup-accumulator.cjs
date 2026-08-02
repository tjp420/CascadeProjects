'use strict';

/**
 * Track 29: ZK-Rollup telemetry accumulator.
 *
 * Batches telemetry events into a Merkle tree and produces a compressed
 * root commitment. Recognizes resharing, recovery, consensus, enclave,
 * and ephemeral share-ratchet events.
 *
 * @module hsm-adapter/zk-rollup-accumulator
 */

const crypto = require('crypto');

const ALLOWED_EVENT_TYPES = new Set([
  'COMMITTEE_RESHARDING_INITIATED',
  'EPHEMERAL_SHARE_RATCHETED',
  'ENCLAVE_HARDWARE_BOOTSTRAPPED',
  'ATTESTATION_CHALLENGE_VERIFIED',
  'CONSENSUS_LEADER_ELECTED',
  'CONSENSUS_LOG_COMMITTED',
  'NODE_RECOVERY_STARTED',
]);

class ZkRollupAccumulator {
  /**
   * @param {object} options
   * @param {number} [options.maxBatchSize=32]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.maxBatchSize = options.maxBatchSize || 32;
    this._audit = options.audit || null;
    this._batch = [];
    this._sequence = 0;
    this._merkleRoot = null;
  }

  /**
   * Ingest a single telemetry event.
   * @param {string} type
   * @param {object} payload
   * @returns {object}
   */
  ingest(type, payload = {}) {
    if (!ALLOWED_EVENT_TYPES.has(type)) {
      throw new Error(`Event type ${type} is not recognized by the rollup accumulator`);
    }
    this._sequence += 1;
    const normalized = this._normalize(type, payload);
    this._batch.push({
      sequence: this._sequence,
      type,
      payload: normalized,
      leaf: this._hashLeaf(normalized),
    });
    if (this._batch.length >= this.maxBatchSize) {
      return this.finalizeBatch();
    }
    return { ingested: true, sequence: this._sequence };
  }

  /**
   * Finalize the current batch and compute the Merkle root.
   * @returns {object}
   */
  finalizeBatch() {
    if (this._batch.length === 0) {
      return { finalized: false, root: null };
    }
    const leaves = this._batch.map((e) => e.leaf);
    this._merkleRoot = _computeMerkleRoot(leaves);
    const result = { finalized: true, root: this._merkleRoot, count: this._batch.length, sequence: this._sequence };
    this._batch = [];
    if (this._audit) {
      this._audit('ZK_ROLLUP_BATCH_FINALIZED', result);
    }
    return result;
  }

  /**
   * Verify a local vector clock signature before compressing.
   * @param {object} payload
   * @param {string} signature
   * @returns {boolean}
   */
  verifyVectorClockSignature(payload, signature) {
    const canonical = JSON.stringify(this._normalize(null, payload));
    const expected = crypto.createHmac('sha256', 'zk-rollup-vector-clock-key').update(canonical).digest('hex');
    return signature === expected;
  }

  _normalize(type, payload) {
    const out = {};
    const keys = Object.keys(payload || {}).sort();
    for (const k of keys) {
      if (payload[k] !== undefined) out[k] = payload[k];
    }
    if (type) out._eventType = type;
    return out;
  }

  _hashLeaf(payload) {
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  /**
   * Get the latest Merkle root.
   * @returns {string|null}
   */
  getLatestRoot() {
    return this._merkleRoot;
  }
}

function _computeMerkleRoot(leaves) {
  if (leaves.length === 0) return null;
  let level = [...leaves];
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] || left;
      next.push(crypto.createHash('sha256').update(left + right).digest('hex'));
    }
    level = next;
  }
  return level[0];
}

module.exports = { ZkRollupAccumulator, ALLOWED_EVENT_TYPES };
