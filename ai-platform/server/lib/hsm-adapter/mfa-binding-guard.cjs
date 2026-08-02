'use strict';

/**
 * Track 30: Multi-factor cryptographic binding guard.
 *
 * Validates that a request supplies a sufficient number of unique
 * signatures, each from a distinct signer, within the configured MFA
 * token expiry window.
 *
 * @module hsm-adapter/mfa-binding-guard
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

function _hash(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

class MfaBindingGuard {
  /**
   * @param {object} options
   * @param {number} options.minMfaSignatures
   * @param {number} options.mfaTokenExpiryMs
   * @param {string[]} [options.allowedSigners]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.minMfaSignatures = options.minMfaSignatures || 2;
    this.mfaTokenExpiryMs = options.mfaTokenExpiryMs || 300000;
    this.allowedSigners = new Set(options.allowedSigners || []);
    this._audit = options.audit || null;
  }

  /**
   * Validate an MFA binding request.
   * @param {object} request
   * @param {number} request.timestamp
   * @param {Array<{signer: string, signature: string}>} request.signatures
   * @param {string} request.payloadHash
   * @returns {boolean}
   */
  validate(request) {
    if (!request || typeof request !== 'object') {
      throw new HsmAdapterError('INVALID_INPUT', 'MFA request is required');
    }
    if (!Array.isArray(request.signatures) || request.signatures.length === 0) {
      throw new HsmAdapterError('MFA_SIGNATURES_MISSING', 'no signatures provided');
    }
    if (request.signatures.length < this.minMfaSignatures) {
      throw new HsmAdapterError('MFA_SIGNATURES_INSUFFICIENT', `received ${request.signatures.length} signatures, require ${this.minMfaSignatures}`);
    }
    if (typeof request.timestamp !== 'number') {
      throw new HsmAdapterError('INVALID_INPUT', 'request timestamp is required');
    }
    if (Date.now() - request.timestamp > this.mfaTokenExpiryMs) {
      throw new HsmAdapterError('MFA_TOKEN_EXPIRED', `token older than ${this.mfaTokenExpiryMs}ms`);
    }

    const seenSigners = new Set();
    for (const sig of request.signatures) {
      if (!sig || typeof sig !== 'object' || typeof sig.signer !== 'string' || typeof sig.signature !== 'string') {
        throw new HsmAdapterError('INVALID_INPUT', 'each signature must have a signer and signature string');
      }
      if (seenSigners.has(sig.signer)) {
        throw new HsmAdapterError('MFA_DUPLICATE_SIGNER', `duplicate signature from ${sig.signer}`);
      }
      if (this.allowedSigners.size > 0 && !this.allowedSigners.has(sig.signer)) {
        throw new HsmAdapterError('MFA_SIGNER_REJECTED', `signer ${sig.signer} is not allowed`);
      }
      const expected = _hash(`${request.payloadHash}:${sig.signer}`);
      if (sig.signature !== expected) {
        throw new HsmAdapterError('MFA_SIGNATURE_INVALID', `signature from ${sig.signer} does not verify`);
      }
      seenSigners.add(sig.signer);
    }

    this._emitAudit('MFA_TOKEN_AUTHENTICATED', {
      payloadHash: request.payloadHash,
      signerCount: seenSigners.size,
      signers: Array.from(seenSigners),
    });

    return true;
  }

  _emitAudit(event, info) {
    if (this._audit) this._audit(event, { timestamp: Date.now(), ...info });
  }
}

module.exports = { MfaBindingGuard };
