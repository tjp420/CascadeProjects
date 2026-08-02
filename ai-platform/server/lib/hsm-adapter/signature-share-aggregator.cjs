'use strict';

/**
 * Track 27: Signature share aggregator.
 *
 * Collects PQC threshold partial signatures, verifies each share's
 * cryptographic integrity, and combines valid shares into a single group
 * signature bound to the group public key.
 *
 * @module hsm-adapter/signature-share-aggregator
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');
const { PqcThresholdSigner } = require('./pqc-threshold-signer.cjs');

function _hashHex(inputs) {
  const h = crypto.createHash('sha256');
  for (const item of inputs) {
    h.update(typeof item === 'string' ? item : item.toString());
  }
  return h.digest('hex');
}

class SignatureShareAggregator {
  /**
   * @param {object} options
   * @param {number} options.threshold
   * @param {string} [options.scheme]
   * @param {BigInt} [options.groupPublicKey]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.threshold = options.threshold;
    this.scheme = options.scheme || 'ml-dsa-65';
    this._groupPublicKey = options.groupPublicKey || null;
    this._audit = options.audit || null;
    this._partials = [];
  }

  /**
   * Submit a partial signature for aggregation.
   * @param {object} partial
   * @param {string|Buffer} message
   * @returns {boolean} true if accepted
   */
  submitPartial(partial, message) {
    if (!partial || typeof partial !== 'object') {
      throw new HsmAdapterError('INVALID_INPUT', 'partial signature is required');
    }
    if (partial.scheme !== this.scheme) {
      throw new HsmAdapterError('PQC_SCHEME_MISMATCH', `expected ${this.scheme}, got ${partial.scheme}`);
    }
    if (this._partials.some((p) => p.nodeId === partial.nodeId)) {
      throw new HsmAdapterError('PQC_DUPLICATE_SHARE', `node ${partial.nodeId} already submitted`);
    }
    if (!PqcThresholdSigner.verifyPartial(partial, message)) {
      throw new HsmAdapterError('PQC_INVALID_PARTIAL', `partial from node ${partial.nodeId} failed verification`);
    }

    this._partials.push(partial);
    this._emitAudit('PQC_SIGNATURE_SHARE_VERIFIED', {
      nodeId: partial.nodeId,
      scheme: partial.scheme,
      messageDigest: _hashHex([message]),
    });
    return true;
  }

  /**
   * Aggregate accepted partials into a group signature.
   * @param {string|Buffer} message
   * @returns {{scheme: string, threshold: number, messageDigest: string, groupPublicKey: string, signature: string, partialNodeIds: number[]}}
   */
  aggregate(message) {
    if (this._partials.length < this.threshold) {
      throw new HsmAdapterError('PQC_THRESHOLD_NOT_MET', `only ${this._partials.length} partials, need ${this.threshold}`);
    }
    const msg = typeof message === 'string' ? message : message.toString('hex');
    const partials = this._partials
      .slice()
      .sort((a, b) => a.nodeId - b.nodeId);
    const combined = partials.reduce((sum, p) => (sum + p.response) % (5n), 0n);
    const signature = _hashHex([
      msg,
      this.scheme,
      combined.toString(),
      this._groupPublicKey ? this._groupPublicKey.toString() : '',
      partials.map((p) => p.nodeId).join(','),
    ]);

    this._emitAudit('PQC_GROUP_SIGNATURE_FINALIZED', {
      scheme: this.scheme,
      threshold: this.threshold,
      messageDigest: _hashHex([msg]),
      groupPublicKey: this._groupPublicKey ? this._groupPublicKey.toString() : null,
      signature,
    });

    return {
      scheme: this.scheme,
      threshold: this.threshold,
      messageDigest: _hashHex([msg]),
      groupPublicKey: this._groupPublicKey ? this._groupPublicKey.toString() : null,
      signature,
      partialNodeIds: partials.map((p) => p.nodeId),
    };
  }

  _emitAudit(event, info) {
    if (this._audit) this._audit(event, { timestamp: Date.now(), ...info });
  }
}

module.exports = { SignatureShareAggregator };
