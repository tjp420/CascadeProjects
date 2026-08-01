'use strict';

/**
 * Track 10 / 13: Software HSM adapter.
 *
 * A concrete adapter that uses the in-process `aes-kw.cjs` implementation
 * (RFC 3394 AES-KW) for wrap/unwrap operations. KEKs are stored in memory
 * and namespaced by `tenantId`.
 *
 * This adapter serves two purposes:
 *   1. Fallback when no PKCS#11/HSM hardware is available.
 *   2. Reference implementation for testing the adapter interface contract.
 *
 * WARNING: KEKs are stored in process memory. This is NOT suitable for
 * production — use a real HSM/KMS adapter for production key protection.
 *
 * @module hsm-adapter/software-adapter
 */

const crypto = require('crypto');
const { BaseHsmAdapter, HsmAdapterError } = require('./base-adapter.cjs');
const { wrap: aesKwWrap, unwrap: aesKwUnwrap } = require('../aes-kw.cjs');

const DEFAULT_KEK_BITS = 256; // 256-bit KEK for production-grade wrapping

class SoftwareHsmAdapter extends BaseHsmAdapter {
  /**
   * @param {object} [options]
   * @param {number} [options.kekBits=256] - KEK size in bits (128, 192, 256)
   * @param {object} [options.logger]
   */
  constructor(options = {}) {
    super({ providerName: 'software', ...options });
    this.kekBits = options.kekBits || DEFAULT_KEK_BITS;
    if (![128, 192, 256].includes(this.kekBits)) {
      throw new HsmAdapterError('INVALID_KEK_BITS', `kekBits must be 128, 192, or 256; got ${this.kekBits}`);
    }
    this._keks = new Map(); // kekId -> { kek, tenantId, meta, createdAt }
  }

  async _initialize() {
    // No-op: software adapter needs no external connection
  }

  _getKek(tenantId, kekId) {
    const info = this._keks.get(kekId);
    if (!info) {
      throw new HsmAdapterError('UNKNOWN_KEK', `KEK not found: ${kekId}`);
    }
    if (info.tenantId !== tenantId) {
      throw new HsmAdapterError('UNAUTHORIZED_KEY_ACCESS', `KEK ${kekId} does not belong to tenant ${tenantId}`);
    }
    return info;
  }

  _validatePolicy(tenantId, operation, info) {
    if (!this._policyEngine) return;
    this._policyEngine.validate(tenantId, operation, {
      algorithm: 'aes-kw',
      kekBits: info.kek.length * 8,
      createdAt: info.createdAt,
    });
  }

  async _createKEK(tenantId, meta = {}) {
    if (this._policyEngine) {
      this._policyEngine.validate(tenantId, 'createKEK', {
        algorithm: 'aes-kw',
        kekBits: this.kekBits,
      });
    }
    const kek = crypto.randomBytes(this.kekBits / 8);
    const kekId = crypto.randomBytes(8).toString('hex');
    this._keks.set(kekId, { kek, tenantId, meta, createdAt: Date.now() });
    return kekId;
  }

  async _wrap(tenantId, kekId, plaintext) {
    const info = this._getKek(tenantId, kekId);
    this._validatePolicy(tenantId, 'wrap', info);
    return aesKwWrap(info.kek, plaintext);
  }

  async _unwrap(tenantId, kekId, wrapped) {
    const info = this._getKek(tenantId, kekId);
    this._validatePolicy(tenantId, 'unwrap', info);
    try {
      return aesKwUnwrap(info.kek, wrapped);
    } catch (err) {
      // Map AES-KW integrity failures to HsmAdapterError
      throw new HsmAdapterError('UNWRAP_FAILED', err.message);
    }
  }

  async _rotateKEK(tenantId, oldKekId) {
    const info = this._getKek(tenantId, oldKekId);
    this._validatePolicy(tenantId, 'rotateKEK', info);
    const newKekId = await this._createKEK(tenantId, { rotatedFrom: oldKekId, ...info.meta });
    return newKekId;
  }

  async _listKEKs(tenantId) {
    return Array.from(this._keks.entries())
      .filter(([, info]) => info.tenantId === tenantId)
      .map(([kekId, info]) => ({
        kekId,
        meta: info.meta,
        createdAt: info.createdAt,
      }));
  }

  async _getKEK(tenantId, kekId) {
    const info = this._getKek(tenantId, kekId);
    return info.kek;
  }

  /**
   * Generate a test KEK for CI/integration testing.
   * @param {string} tenantId
   * @param {object} [spec] - optional spec (currently ignored)
   * @returns {Promise<string>} kekId
   */
  async generateTestKEK(tenantId, spec = {}) {
    return this._createKEK(tenantId, { test: true, ...spec });
  }
}

module.exports = {
  SoftwareHsmAdapter,
  HsmAdapterError,
};
