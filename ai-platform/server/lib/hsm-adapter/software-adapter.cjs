'use strict';

/**
 * Track 10: Software HSM adapter.
 *
 * A concrete adapter that uses the in-process `aes-kw.cjs` implementation
 * (RFC 3394 AES-KW) for wrap/unwrap operations. KEKs are stored in memory.
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
    this._keks = new Map(); // kekId -> { kek: Buffer, meta, createdAt }
  }

  async _initialize() {
    // No-op: software adapter needs no external connection
  }

  async _createKEK(meta = {}) {
    const kek = crypto.randomBytes(this.kekBits / 8);
    const kekId = crypto.randomBytes(8).toString('hex');
    this._keks.set(kekId, { kek, meta, createdAt: Date.now() });
    return kekId;
  }

  async _wrap(kekId, plaintext) {
    if (!Buffer.isBuffer(plaintext)) {
      throw new HsmAdapterError('INVALID_INPUT', 'plaintext must be a Buffer');
    }
    const info = this._keks.get(kekId);
    if (!info) {
      throw new HsmAdapterError('UNKNOWN_KEK', `KEK not found: ${kekId}`);
    }
    return aesKwWrap(info.kek, plaintext);
  }

  async _unwrap(kekId, wrapped) {
    if (!Buffer.isBuffer(wrapped)) {
      throw new HsmAdapterError('INVALID_INPUT', 'wrapped must be a Buffer');
    }
    const info = this._keks.get(kekId);
    if (!info) {
      throw new HsmAdapterError('UNKNOWN_KEK', `KEK not found: ${kekId}`);
    }
    try {
      return aesKwUnwrap(info.kek, wrapped);
    } catch (err) {
      // Map AES-KW integrity failures to HsmAdapterError
      throw new HsmAdapterError('UNWRAP_FAILED', err.message);
    }
  }

  async _rotateKEK(oldKekId) {
    if (!this._keks.has(oldKekId)) {
      throw new HsmAdapterError('UNKNOWN_KEK', `KEK not found: ${oldKekId}`);
    }
    const oldInfo = this._keks.get(oldKekId);
    const newKekId = await this._createKEK({ rotatedFrom: oldKekId, ...oldInfo.meta });
    return newKekId;
  }

  async _listKEKs() {
    return Array.from(this._keks.entries()).map(([kekId, info]) => ({
      kekId,
      meta: info.meta,
      createdAt: info.createdAt,
    }));
  }

  async _getKEK(kekId) {
    const info = this._keks.get(kekId);
    if (!info) {
      throw new HsmAdapterError('UNKNOWN_KEK', `KEK not found: ${kekId}`);
    }
    return info.kek;
  }

  /**
   * Generate a test KEK for CI/integration testing.
   * @param {object} [spec] - optional spec (currently ignored)
   * @returns {Promise<string>} kekId
   */
  async generateTestKEK(spec = {}) {
    return this._createKEK({ test: true, ...spec });
  }
}

module.exports = {
  SoftwareHsmAdapter,
  HsmAdapterError,
};
