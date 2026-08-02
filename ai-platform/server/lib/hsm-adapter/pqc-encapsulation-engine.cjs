'use strict';

/**
 * Track 20: Simulated ML-KEM encapsulation engine.
 *
 * This is a reference / structural simulation of the ML-KEM encapsulation
 * flow for Kyber-512, Kyber-768, and Kyber-1024 parameter sets. It is not
 * a production lattice implementation; it provides deterministic key
 * generation, ciphertext structure, and shared-secret derivation.
 *
 * @module hsm-adapter/pqc-encapsulation-engine
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

const SUPPORTED_LEVELS = new Set([512, 768, 1024]);

function _kdf(ikm, info, length) {
  return Buffer.from(crypto.hkdfSync('sha256', ikm, Buffer.alloc(0), info, length));
}

function _secureZeroize(buf) {
  if (Buffer.isBuffer(buf)) buf.fill(0);
}

class PqcEncapsulationEngine {
  /**
   * @param {number} kemLevel - 512, 768, or 1024
   */
  constructor(kemLevel = 768) {
    if (!SUPPORTED_LEVELS.has(kemLevel)) {
      throw new HsmAdapterError('PQC_NOT_SUPPORTED', `kemLevel ${kemLevel} is not supported`);
    }
    this._kemLevel = kemLevel;
    this._k = kemLevel / 256;
  }

  get kemLevel() {
    return this._kemLevel;
  }

  /**
   * Generate a keypair for this KEM level.
   * @returns {{publicKey: {seed: Buffer, kemLevel: number}, secretKey: {seed: Buffer, kemLevel: number}}}
   */
  generateKeypair() {
    const seed = crypto.randomBytes(32);
    const publicKey = { seed: _kdf(seed, `SimpleBeacon:Track20:PQC:pk:${this._kemLevel}`, 32 * this._k), kemLevel: this._kemLevel };
    const secretKey = { seed, kemLevel: this._kemLevel };
    return { publicKey, secretKey };
  }

  /**
   * Encapsulate a shared secret against a public key.
   * @param {object} publicKey
   * @returns {{ciphertext: object, sharedSecret: Buffer}}
   */
  encapsulate(publicKey) {
    if (!publicKey || publicKey.kemLevel !== this._kemLevel) {
      throw new HsmAdapterError('PQC_KEY_INTEGRITY', 'public key mismatch');
    }
    const r = crypto.randomBytes(32);
    const ikm = Buffer.concat([publicKey.seed, r]);
    const sharedSecret = _kdf(ikm, `SimpleBeacon:Track20:PQC:ss:${this._kemLevel}`, 32);
    const c1 = _kdf(ikm, `SimpleBeacon:Track20:PQC:c1:${this._kemLevel}`, 32 * this._k);
    const c2 = _kdf(ikm, `SimpleBeacon:Track20:PQC:c2:${this._kemLevel}`, 32);
    const ciphertext = { c1, c2, r };
    _secureZeroize(ikm);
    return { ciphertext, sharedSecret };
  }

  /**
   * Decapsulate a ciphertext with the secret key.
   * @param {object} ciphertext
   * @param {object} secretKey
   * @returns {Buffer}
   */
  decapsulate(ciphertext, secretKey) {
    if (!ciphertext || !secretKey) {
      throw new HsmAdapterError('PQC_KEY_INTEGRITY', 'ciphertext and secret key are required');
    }
    if (secretKey.kemLevel !== this._kemLevel) {
      throw new HsmAdapterError('PQC_KEY_INTEGRITY', 'secret key KEM level mismatch');
    }
    if (!Buffer.isBuffer(ciphertext.c1) || !Buffer.isBuffer(ciphertext.c2) || !Buffer.isBuffer(ciphertext.r)) {
      throw new HsmAdapterError('PQC_KEY_INTEGRITY', 'ciphertext fields are not buffers');
    }

    const publicKeySeed = _kdf(secretKey.seed, `SimpleBeacon:Track20:PQC:pk:${this._kemLevel}`, 32 * this._k);
    const expectedC1 = _kdf(Buffer.concat([publicKeySeed, ciphertext.r]), `SimpleBeacon:Track20:PQC:c1:${this._kemLevel}`, 32 * this._k);
    const expectedC2 = _kdf(Buffer.concat([publicKeySeed, ciphertext.r]), `SimpleBeacon:Track20:PQC:c2:${this._kemLevel}`, 32);

    if (!ciphertext.c1.equals(expectedC1) || !ciphertext.c2.equals(expectedC2)) {
      _secureZeroize(publicKeySeed);
      _secureZeroize(expectedC1);
      _secureZeroize(expectedC2);
      throw new HsmAdapterError('PQC_KEY_INTEGRITY', 'ciphertext integrity check failed');
    }

    _secureZeroize(expectedC1);
    _secureZeroize(expectedC2);

    const ikm = Buffer.concat([publicKeySeed, ciphertext.r]);
    const sharedSecret = _kdf(ikm, `SimpleBeacon:Track20:PQC:ss:${this._kemLevel}`, 32);
    _secureZeroize(publicKeySeed);
    _secureZeroize(ikm);
    return sharedSecret;
  }
}

module.exports = {
  PqcEncapsulationEngine,
  SUPPORTED_LEVELS,
};
