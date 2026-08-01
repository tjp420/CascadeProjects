'use strict';

/**
 * Track 16: Decentralized provenance proof.
 *
 * An exportable, self-contained proof that a key's provenance record is
 * signed by a specific root. A third-party node can verify the proof using
 * only the root public key and the record itself.
 *
 * @module hsm-adapter/provenance-proof
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

const DEFAULT_HASH = 'sha256';

function _canonicalJson(obj) {
  const sorted = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = obj[key];
  }
  return JSON.stringify(sorted);
}

class ProvenanceProof {
  /**
   * Create an exportable proof from a signed provenance record.
   * @param {object} record - output from ProvenanceTracker.register
   * @returns {object}
   */
  static create(record) {
    if (!record || typeof record !== 'object' || !record.kekId) {
      throw new HsmAdapterError('INVALID_INPUT', 'record must be a valid provenance record');
    }
    return {
      version: '1.0.0',
      record,
    };
  }

  /**
   * Verify a proof against a root public key.
   * @param {object} proof
   * @param {crypto.KeyObject} rootPublicKey
   * @returns {boolean}
   */
  static verify(proof, rootPublicKey) {
    if (!proof || typeof proof !== 'object' || !proof.record) {
      throw new HsmAdapterError('INVALID_INPUT', 'proof must contain a record');
    }
    const record = proof.record;
    const { signature, ...unsigned } = record;
    const payload = _canonicalJson(unsigned);
    const valid = crypto.verify(
      DEFAULT_HASH,
      Buffer.from(payload, 'utf8'),
      rootPublicKey,
      Buffer.from(signature, 'base64')
    );
    if (!valid) {
      throw new HsmAdapterError('KEY_PROVENANCE_CORRUPTED', 'Provenance proof signature verification failed');
    }
    return true;
  }
}

module.exports = {
  ProvenanceProof,
};
