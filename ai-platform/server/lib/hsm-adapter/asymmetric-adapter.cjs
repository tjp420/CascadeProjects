'use strict';

/**
 * Track 11: Asymmetric HSM adapter.
 *
 * Extends BaseHsmAdapter to support RSA-OAEP and ECDH (P-256/P-384) key
 * wrapping. Private keys are kept as Node crypto KeyObjects; public keys
 * are exported via SPKI. Wrap/unwrap use standard Node.js crypto.
 *
 * @module hsm-adapter/asymmetric-adapter
 */

const crypto = require('crypto');
const { BaseHsmAdapter, HsmAdapterError } = require('./base-adapter.cjs');

const SUPPORTED_ALGORITHMS = new Set(['rsa-oaep', 'ecdh']);
const RSA_KEY_SIZES = new Set([2048, 4096]);
const ECDH_KEY_SIZES = new Set([256, 384, 521]);

function _validateAlgorithmAndSize(algorithm, keySize) {
  if (!SUPPORTED_ALGORITHMS.has(algorithm)) {
    throw new HsmAdapterError('INVALID_ALGORITHM', `Unsupported asymmetric algorithm: ${algorithm}`);
  }
  if (algorithm === 'rsa-oaep' && !RSA_KEY_SIZES.has(keySize)) {
    throw new HsmAdapterError('INVALID_KEK_BITS', `RSA-OAEP keySize must be 2048 or 4096; got ${keySize}`);
  }
  if (algorithm === 'ecdh' && !ECDH_KEY_SIZES.has(keySize)) {
    throw new HsmAdapterError('INVALID_KEK_BITS', `ECDH keySize must be 256, 384, or 521; got ${keySize}`);
  }
}

function _namedCurveForEcdh(keySize) {
  return `P-${keySize}`;
}

function _generateKeyPair(algorithm, keySize) {
  return new Promise((resolve, reject) => {
    const options =
      algorithm === 'rsa-oaep'
        ? { modulusLength: keySize }
        : { namedCurve: _namedCurveForEcdh(keySize) };

    crypto.generateKeyPair(algorithm === 'rsa-oaep' ? 'rsa' : 'ec', options, (err, publicKey, privateKey) => {
      if (err) return reject(new HsmAdapterError('KEY_GENERATION_FAILED', err.message));
      resolve({ publicKey, privateKey });
    });
  });
}

function _deriveAesKey(sharedSecret, iv) {
  // Bind the KDF to the IV (nonce) so a re-used secret cannot be replayed.
  return crypto.hkdfSync('sha256', sharedSecret, iv, 'AsymmetricHsmAdapter:ecdh-wrap', 32);
}

class AsymmetricHsmAdapter extends BaseHsmAdapter {
  /**
   * @param {object} [options]
   * @param {string} [options.algorithm='rsa-oaep'] - 'rsa-oaep' or 'ecdh'
   * @param {number} [options.keySize=2048] - RSA modulus or ECDH curve size
   */
  constructor(options = {}) {
    super({ providerName: 'asymmetric', ...options });
    this.algorithm = options.algorithm || 'rsa-oaep';
    this.keySize = options.keySize || 2048;
    _validateAlgorithmAndSize(this.algorithm, this.keySize);
    this._keks = new Map();
  }

  async _initialize() {
    // No-op: in-process adapter
  }

  async _createKEK(meta = {}) {
    const { publicKey, privateKey } = await _generateKeyPair(this.algorithm, this.keySize);
    const kekId = crypto.randomBytes(16).toString('hex');
    this._keks.set(kekId, {
      publicKey,
      privateKey,
      algorithm: this.algorithm,
      keySize: this.keySize,
      meta,
      createdAt: Date.now(),
    });
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

    if (info.algorithm === 'rsa-oaep') {
      const maxPlaintextLength = info.keySize / 8 - 2 * 32 - 2; // SHA-256 OAEP
      if (plaintext.length > maxPlaintextLength) {
        throw new HsmAdapterError('INVALID_INPUT', `Plaintext too large for RSA-OAEP-${info.keySize}; max ${maxPlaintextLength} bytes`);
      }
      return crypto.publicEncrypt(
        {
          key: info.publicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        plaintext
      );
    }

    // ECDH ECIES-style wrap
    const ephemeral = await _generateKeyPair('ecdh', this.keySize);
    const sharedSecret = crypto.diffieHellman({
      privateKey: ephemeral.privateKey,
      publicKey: info.publicKey,
    });
    const iv = crypto.randomBytes(12);
    const key = _deriveAesKey(sharedSecret, iv);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    const ephemeralSpki = ephemeral.publicKey.export({ type: 'spki', format: 'der' });
    const header = Buffer.alloc(4);
    header.writeUInt32BE(ephemeralSpki.length, 0);

    return Buffer.concat([header, ephemeralSpki, iv, tag, ciphertext]);
  }

  async _unwrap(kekId, wrapped) {
    if (!Buffer.isBuffer(wrapped)) {
      throw new HsmAdapterError('INVALID_INPUT', 'wrapped must be a Buffer');
    }

    const info = this._keks.get(kekId);
    if (!info) {
      throw new HsmAdapterError('UNKNOWN_KEK', `KEK not found: ${kekId}`);
    }

    if (info.algorithm === 'rsa-oaep') {
      try {
        return crypto.privateDecrypt(
          {
            key: info.privateKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256',
          },
          wrapped
        );
      } catch (err) {
        throw new HsmAdapterError('UNWRAP_FAILED', err.message);
      }
    }

    // ECDH ECIES-style unwrap
    if (wrapped.length < 4) {
      throw new HsmAdapterError('UNWRAP_FAILED', 'Malformed ECDH wrapped payload');
    }
    const spkiLen = wrapped.readUInt32BE(0);
    const offsetAfterHeader = 4;
    if (wrapped.length < offsetAfterHeader + spkiLen + 12 + 16) {
      throw new HsmAdapterError('UNWRAP_FAILED', 'Malformed ECDH wrapped payload');
    }

    const ephemeralSpki = wrapped.subarray(offsetAfterHeader, offsetAfterHeader + spkiLen);
    const iv = wrapped.subarray(offsetAfterHeader + spkiLen, offsetAfterHeader + spkiLen + 12);
    const tag = wrapped.subarray(offsetAfterHeader + spkiLen + 12, offsetAfterHeader + spkiLen + 12 + 16);
    const ciphertext = wrapped.subarray(offsetAfterHeader + spkiLen + 12 + 16);

    let ephemeralPublic;
    try {
      ephemeralPublic = crypto.createPublicKey({
        key: ephemeralSpki,
        format: 'der',
        type: 'spki',
      });
    } catch (err) {
      throw new HsmAdapterError('UNWRAP_FAILED', `Invalid ephemeral public key: ${err.message}`);
    }

    const sharedSecret = crypto.diffieHellman({
      privateKey: info.privateKey,
      publicKey: ephemeralPublic,
    });
    const key = _deriveAesKey(sharedSecret, iv);
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch (err) {
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
      algorithm: info.algorithm,
      keySize: info.keySize,
      meta: info.meta,
      createdAt: info.createdAt,
    }));
  }

  /**
   * Export the public key for a given key pair as SPKI DER.
   * @param {string} kekId
   * @returns {Promise<Buffer>}
   */
  async exportPublicKey(kekId) {
    this._ensureInitialized();
    const info = this._keks.get(kekId);
    if (!info) {
      throw new HsmAdapterError('UNKNOWN_KEK', `KEK not found: ${kekId}`);
    }
    return info.publicKey.export({ type: 'spki', format: 'der' });
  }
}

module.exports = {
  AsymmetricHsmAdapter,
};
