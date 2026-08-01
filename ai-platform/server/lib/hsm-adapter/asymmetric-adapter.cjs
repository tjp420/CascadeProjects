'use strict';

/**
 * Track 11: Asymmetric HSM adapter.
 *
 * Extends BaseHsmAdapter to support RSA-OAEP and ECDH (P-256/P-384) key
 * wrapping. Private keys are kept as Node crypto KeyObjects; public keys
 * are exported via SPKI. Wrap/unwrap use standard Node.js crypto.
 *
 * Track 12: ECDH ECIES now binds an application-specific context string
 * into the HKDF key derivation, and the adapter can issue/verify mock
 * HSM attestation certificates when an `Attestation` engine is supplied.
 *
 * @module hsm-adapter/asymmetric-adapter
 */

const crypto = require('crypto');
const { BaseHsmAdapter, HsmAdapterError } = require('./base-adapter.cjs');
const { Attestation } = require('./attestation.cjs');

const SUPPORTED_ALGORITHMS = new Set(['rsa-oaep', 'ecdh']);
const RSA_KEY_SIZES = new Set([2048, 4096]);
const ECDH_KEY_SIZES = new Set([256, 384, 521]);
const DEFAULT_HKDF_CONTEXT = 'AsymmetricHsmAdapter:default';

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

function _deriveAesKey(sharedSecret, iv, context) {
  // Bind the KDF to the IV (nonce) and the caller-supplied context so a
  // re-used secret cannot be replayed across different contexts.
  return crypto.hkdfSync('sha256', sharedSecret, iv, context, 32);
}

class AsymmetricHsmAdapter extends BaseHsmAdapter {
  /**
   * @param {object} [options]
   * @param {string} [options.algorithm='rsa-oaep'] - 'rsa-oaep' or 'ecdh'
   * @param {number} [options.keySize=2048] - RSA modulus or ECDH curve size
   * @param {Attestation} [options.attestation] - optional attestation engine
   */
  constructor(options = {}) {
    super({ providerName: 'asymmetric', ...options });
    this.algorithm = options.algorithm || 'rsa-oaep';
    this.keySize = options.keySize || 2048;
    _validateAlgorithmAndSize(this.algorithm, this.keySize);
    this._attestation = options.attestation || null;
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

  async _wrap(kekId, plaintext, context = DEFAULT_HKDF_CONTEXT) {
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
    const key = _deriveAesKey(sharedSecret, iv, context);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    const ephemeralSpki = ephemeral.publicKey.export({ type: 'spki', format: 'der' });
    const header = Buffer.alloc(4);
    header.writeUInt32BE(ephemeralSpki.length, 0);

    return Buffer.concat([header, ephemeralSpki, iv, tag, ciphertext]);
  }

  async _unwrap(kekId, wrapped, context = DEFAULT_HKDF_CONTEXT) {
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
    const key = _deriveAesKey(sharedSecret, iv, context);
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
   * Wrap a plaintext buffer using the named KEK. ECDH supports an optional
   * context string that is bound into the HKDF derivation.
   * @param {string} kekId
   * @param {Buffer} plaintext
   * @param {string} [context='AsymmetricHsmAdapter:default']
   * @returns {Promise<Buffer>}
   */
  async wrap(kekId, plaintext, context = DEFAULT_HKDF_CONTEXT) {
    this._ensureInitialized();
    return this._wrap(kekId, plaintext, context);
  }

  /**
   * Unwrap a wrapped buffer using the named KEK. For ECDH, the same context
   * supplied to `wrap` must be provided.
   * @param {string} kekId
   * @param {Buffer} wrapped
   * @param {string} [context='AsymmetricHsmAdapter:default']
   * @returns {Promise<Buffer>}
   */
  async unwrap(kekId, wrapped, context = DEFAULT_HKDF_CONTEXT) {
    this._ensureInitialized();
    return this._unwrap(kekId, wrapped, context);
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

  /**
   * Issue a mock HSM attestation certificate for a public key.
   * @param {string} kekId
   * @returns {Promise<object>}
   */
  async attestPublicKey(kekId) {
    this._ensureInitialized();
    if (!this._attestation) {
      throw new HsmAdapterError('ATTESTATION_NOT_CONFIGURED', 'No attestation engine configured');
    }
    const info = this._keks.get(kekId);
    if (!info) {
      throw new HsmAdapterError('UNKNOWN_KEK', `KEK not found: ${kekId}`);
    }
    const spki = info.publicKey.export({ type: 'spki', format: 'der' });
    return this._attestation.signPublicKey(spki, kekId, {
      algorithm: info.algorithm,
      keySize: info.keySize,
    });
  }

  /**
   * Verify that a certificate is a valid attestation for the named KEK.
   * @param {string} kekId
   * @param {object} certificate
   * @returns {Promise<boolean>}
   */
  async verifyAttestation(kekId, certificate) {
    this._ensureInitialized();
    if (!this._attestation) {
      throw new HsmAdapterError('ATTESTATION_NOT_CONFIGURED', 'No attestation engine configured');
    }
    const info = this._keks.get(kekId);
    if (!info) {
      throw new HsmAdapterError('UNKNOWN_KEK', `KEK not found: ${kekId}`);
    }

    const expectedSpki = info.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
    if (certificate.subjectPublicKeyInfo !== expectedSpki) {
      throw new HsmAdapterError('ATTESTATION_MISMATCH', 'Certificate public key does not match kekId');
    }

    const now = new Date();
    if (now < new Date(certificate.notBefore) || now > new Date(certificate.notAfter)) {
      throw new HsmAdapterError('ATTESTATION_INVALID', 'Certificate outside validity window');
    }

    if (!this._attestation.verifyCertificate(certificate)) {
      throw new HsmAdapterError('ATTESTATION_INVALID', 'Certificate signature verification failed');
    }

    return true;
  }
}

module.exports = {
  AsymmetricHsmAdapter,
};
