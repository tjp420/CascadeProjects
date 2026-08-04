'use strict';

/**
 * Track 30: MFA binding guard.
 *
 * Validates a multi-signature MFA token before a device key migration or
 * identity ratchet step is permitted.
 *
 * @module hsm-adapter/mfa-binding-guard
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

function _hashHex(inputs) {
  const h = crypto.createHash('sha256');
  for (const item of inputs) {
    h.update(typeof item === 'string' ? item : JSON.stringify(item));
  }
  return h.digest('hex');
}

class MfaBindingGuard {
  /**
   * @param {object} options
   * @param {number} [options.minSignatures=2]
   * @param {number} [options.tokenExpiryMs=300000]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this._minSignatures = options.minSignatures || 2;
    this._tokenExpiryMs = options.tokenExpiryMs || 300000;
    this._audit = options.audit || null;
  }

  /**
   * Validate an MFA binding token.
   * @param {{deviceId: string, signatures: string[], createdAt: number}} token
   * @param {string} expectedDeviceId
   * @returns {boolean}
   */
  validate(token, expectedDeviceId) {
    if (!token || typeof token !== 'object') {
      throw new HsmAdapterError('INVALID_INPUT', 'MFA token is required');
    }
    if (token.deviceId !== expectedDeviceId) {
      throw new HsmAdapterError('MFA_DEVICE_MISMATCH', `MFA token device ${token.deviceId} does not match ${expectedDeviceId}`);
    }
    if (!Array.isArray(token.signatures) || token.signatures.length < this._minSignatures) {
      throw new HsmAdapterError('MFA_SIGNATURES_MISSING', `MFA token has ${(token.signatures || []).length} signatures, require ${this._minSignatures}`);
    }
    if (typeof token.createdAt !== 'number' || Date.now() - token.createdAt > this._tokenExpiryMs) {
      throw new HsmAdapterError('MFA_TOKEN_EXPIRED', 'MFA token is expired');
    }

    // Simulated signature integrity: each signature must match the expected factor hash.
    for (let i = 0; i < token.signatures.length; i += 1) {
      const expected = _hashHex([token.deviceId, token.createdAt, `factor${i + 1}`]);
      if (token.signatures[i] !== expected) {
        throw new HsmAdapterError('MFA_SIGNATURE_INVALID', `MFA signature ${i} failed integrity check`);
      }
    }

    this._emitAudit('MFA_TOKEN_AUTHENTICATED', {
      deviceId: token.deviceId,
      signatureCount: token.signatures.length,
      createdAt: token.createdAt,
    });
    return true;
  }

  /**
   * Generate a sample valid MFA token for testing.
   * @param {string} deviceId
   * @param {number} [createdAt]
   * @returns {{deviceId: string, signatures: string[], createdAt: number}}
   */
  static generateToken(deviceId, createdAt = Date.now()) {
    const signatures = [
      _hashHex([deviceId, createdAt, 'factor1']),
      _hashHex([deviceId, createdAt, 'factor2']),
    ];
    return { deviceId, signatures, createdAt };
  }

  _emitAudit(event, info) {
    if (this._audit) this._audit(event, { timestamp: Date.now(), ...info });
  }
}

module.exports = { MfaBindingGuard };
