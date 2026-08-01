'use strict';

/**
 * Track 11: Asymmetric HSM adapter skeleton.
 *
 * Extends BaseHsmAdapter to support RSA-OAEP and ECDH key wrapping.
 * This is a scaffolding commit; the concrete algorithms are stubbed.
 *
 * @module hsm-adapter/asymmetric-adapter
 */

const { BaseHsmAdapter, HsmAdapterError } = require('./base-adapter.cjs');

class AsymmetricHsmAdapter extends BaseHsmAdapter {
  /**
   * @param {object} [options]
   * @param {string} [options.algorithm='rsa-oaep'] - 'rsa-oaep' or 'ecdh'
   * @param {number} [options.keySize=2048] - RSA key size or ECDH curve size
   */
  constructor(options = {}) {
    super({ providerName: 'asymmetric', ...options });
    this.algorithm = options.algorithm || 'rsa-oaep';
    this.keySize = options.keySize || 2048;
    this._keks = new Map();
  }

  async _initialize() {
    // No-op: asymmetric adapter is in-process for this skeleton
  }

  async _createKEK(_meta) {
    throw new HsmAdapterError('NOT_IMPLEMENTED', 'Asymmetric key generation is not yet implemented');
  }

  async _wrap(_kekId, _plaintext) {
    throw new HsmAdapterError('NOT_IMPLEMENTED', 'Asymmetric wrap is not yet implemented');
  }

  async _unwrap(_kekId, _wrapped) {
    throw new HsmAdapterError('NOT_IMPLEMENTED', 'Asymmetric unwrap is not yet implemented');
  }

  async _rotateKEK(_oldKekId) {
    throw new HsmAdapterError('NOT_IMPLEMENTED', 'Asymmetric KEK rotation is not yet implemented');
  }

  async _listKEKs() {
    return Array.from(this._keks.entries()).map(([kekId, info]) => ({
      kekId,
      meta: info.meta,
      createdAt: info.createdAt,
    }));
  }

  /**
   * Export the public key for a given key pair.
   * @param {string} kekId
   * @returns {Promise<Buffer>} SPKI-encoded public key
   */
  async exportPublicKey(_kekId) {
    throw new HsmAdapterError('NOT_IMPLEMENTED', 'Public key export is not yet implemented');
  }
}

module.exports = {
  AsymmetricHsmAdapter,
};
