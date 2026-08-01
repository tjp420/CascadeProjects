'use strict';

/**
 * Track 12: Mock HSM attestation engine.
 *
 * Simulates a hardware-bound root of trust by signing public keys with an
 * in-memory RSA root key pair. The signed certificate carries X.509-style
 * fields (subject, issuer, validity window, public key info) and a SHA-256
 * RSA signature. It is not a full DER X.509 certificate — native Node.js
 * crypto does not include an X.509 builder — but the fields are arranged so
 * that a real X.509 replacement can slot in later without API changes.
 *
 * @module hsm-adapter/attestation
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

const DEFAULT_VALIDITY_DAYS = 30;
const DEFAULT_ISSUER_CN = 'MockHSM-Root';

function _canonicalPayload(certPayload) {
  // Deterministic serialization so signature verification is stable.
  const keys = Object.keys(certPayload).sort();
  return Buffer.from(JSON.stringify(certPayload, keys), 'utf8');
}

/**
 * Generate a mock hardware root key pair. In production this would be a
 * fused or TPM-backed key that never leaves the secure element.
 * @returns {crypto.KeyPairKeyObjectResult}
 */
function generateMockRootKey() {
  return crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
}

class Attestation {
  /**
   * @param {object} [options]
   * @param {crypto.KeyPairKeyObjectResult} [options.rootKeyPair] - mock root key pair
   */
  constructor(options = {}) {
    this._rootKeyPair = options.rootKeyPair || generateMockRootKey();
  }

  /**
   * Return the root public key for verification by external callers.
   * @returns {crypto.KeyObject}
   */
  get rootPublicKey() {
    return this._rootKeyPair.publicKey;
  }

  /**
   * Sign a public key (SPKI DER) to produce a mock attestation certificate.
   * @param {Buffer} publicKeyDer
   * @param {string} hardwareId
   * @param {object} [options]
   * @param {string} [options.algorithm]
   * @param {number} [options.keySize]
   * @param {Date} [options.notBefore]
   * @param {Date} [options.notAfter]
   * @returns {object} signed certificate
   */
  signPublicKey(publicKeyDer, hardwareId, options = {}) {
    if (!Buffer.isBuffer(publicKeyDer)) {
      throw new HsmAdapterError('INVALID_INPUT', 'publicKeyDer must be a Buffer');
    }

    const notBefore = options.notBefore || new Date();
    const notAfter =
      options.notAfter || new Date(Date.now() + DEFAULT_VALIDITY_DAYS * 24 * 60 * 60 * 1000);

    const certPayload = {
      subject: { CN: hardwareId },
      issuer: { CN: DEFAULT_ISSUER_CN },
      subjectPublicKeyInfo: publicKeyDer.toString('base64'),
      algorithm: options.algorithm || 'unknown',
      keySize: options.keySize || 0,
      notBefore: notBefore.toISOString(),
      notAfter: notAfter.toISOString(),
    };

    const canonical = _canonicalPayload(certPayload);
    const signature = crypto.sign('sha256', canonical, this._rootKeyPair.privateKey);

    return {
      ...certPayload,
      signature: signature.toString('base64'),
    };
  }

  /**
   * Verify the signature on a mock attestation certificate.
   * @param {object} certificate
   * @param {crypto.KeyObject} [rootPublicKey] - defaults to this engine's root
   * @returns {boolean}
   */
  verifyCertificate(certificate, rootPublicKey) {
    if (!certificate || typeof certificate !== 'object' || !certificate.signature) {
      return false;
    }

    const publicKey = rootPublicKey || this._rootKeyPair.publicKey;
    const { signature, ...certPayload } = certificate;
    const canonical = _canonicalPayload(certPayload);
    const sig = Buffer.from(signature, 'base64');

    try {
      return crypto.verify('sha256', canonical, publicKey, sig);
    } catch {
      return false;
    }
  }
}

module.exports = {
  Attestation,
};
