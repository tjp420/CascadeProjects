'use strict';

/**
 * Track 30: Post-Quantum identity ratchet.
 *
 * Simulates a forward-secure identity rotation using a hybrid ML-KEM
 * shared-secret ratchet. Each step derives a new chain key from the previous
 * chain key and a fresh KEM shared secret.
 *
 * @module hsm-adapter/pqc-identity-ratchet
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

const ALLOWED_KEM_LEVELS = new Set([512, 768, 1024]);
const ALLOWED_SCHEMES = new Set(['ml-kem-768', 'ml-kem-1024']);

function _hkdfSalted(secret, salt, info, length) {
  const prk = crypto.createHmac('sha256', salt).update(secret).digest();
  const okm = crypto.createHmac('sha256', prk).update(info).digest();
  return okm.slice(0, length);
}

class PqcIdentityRatchet {
  /**
   * @param {object} options
   * @param {string} options.deviceId
   * @param {number} options.kemLevel
   * @param {string} options.scheme
   * @param {Buffer} [options.rootKey]
   * @param {number} [options.maxSkipped]
   * @param {number} [options.sessionExpiryMs]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.deviceId = options.deviceId;
    this.kemLevel = options.kemLevel || 768;
    this.scheme = options.scheme || 'ml-kem-768';
    this._rootKey = options.rootKey || crypto.randomBytes(32);
    this._chainKey = this._rootKey;
    this._skipped = 0;
    this._maxSkipped = options.maxSkipped || 1000;
    this._sessionExpiryMs = options.sessionExpiryMs || 86400000;
    this._createdAt = Date.now();
    this._audit = options.audit || null;
  }

  /**
   * Step the ratchet with a new KEM shared secret.
   * @param {Buffer} kemSharedSecret
   * @returns {{chainKey: Buffer, skipped: number}}
   */
  step(kemSharedSecret) {
    if (!Buffer.isBuffer(kemSharedSecret)) {
      throw new HsmAdapterError('INVALID_INPUT', 'kemSharedSecret must be a Buffer');
    }
    if (!ALLOWED_KEM_LEVELS.has(this.kemLevel)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `kemLevel ${this.kemLevel} is not allowed`);
    }
    if (!ALLOWED_SCHEMES.has(this.scheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `scheme ${this.scheme} is not allowed`);
    }
    if (this._skipped >= this._maxSkipped) {
      throw new HsmAdapterError('IDENTITY_RATCHET_EXHAUSTED', `skipped count ${this._skipped} exceeds max ${this._maxSkipped}`);
    }
    if (Date.now() - this._createdAt > this._sessionExpiryMs) {
      throw new HsmAdapterError('IDENTITY_RATCHET_EXPIRED', 'ratchet session has expired');
    }

    const salt = Buffer.concat([this._chainKey, kemSharedSecret]);
    const info = `pqc-ratchet-step:${this.deviceId}:${this._skipped}`;
    this._chainKey = _hkdfSalted(salt, this._chainKey, info, 32);
    this._skipped += 1;

    this._emitAudit('IDENTITY_RATCHET_STEPPED', {
      deviceId: this.deviceId,
      kemLevel: this.kemLevel,
      scheme: this.scheme,
      skipped: this._skipped,
      chainKeyHash: _hashBuffer(this._chainKey),
    });

    return { chainKey: this._chainKey, skipped: this._skipped };
  }

  /**
   * Get the current chain key metadata.
   * @returns {{skipped: number, chainKeyHash: string}}
   */
  getState() {
    return { skipped: this._skipped, chainKeyHash: _hashBuffer(this._chainKey) };
  }

  _emitAudit(event, info) {
    if (this._audit) this._audit(event, { timestamp: Date.now(), ...info });
  }
}

function _hashBuffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

module.exports = { PqcIdentityRatchet };
