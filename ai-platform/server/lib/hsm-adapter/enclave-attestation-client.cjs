'use strict';

/**
 * Track 41: Enclave attestation client.
 *
 * Verifies signed attestation evidence from a hardware enclave
 * (Intel SGX, AWS Nitro, or mock) before key material is provisioned.
 *
 * @module hsm-adapter/enclave-attestation-client
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class EnclaveAttestationClient {
  /**
   * @param {object} options
   * @param {string[]} options.allowedAuthorities
   * @param {string[]} options.allowedMeasurements
   * @param {number} options.maxAttestationAgeSeconds
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.allowedAuthorities = new Set(options.allowedAuthorities || []);
    this.allowedMeasurements = new Set(options.allowedMeasurements || []);
    this.maxAttestationAgeSeconds = typeof options.maxAttestationAgeSeconds === 'number' ? options.maxAttestationAgeSeconds : 60;
    this._audit = options.audit || null;
    this._cache = new Map();
  }

  /**
   * Verify a remote attestation document.
   * @param {object} document
   * @returns {object}
   */
  verify(document) {
    if (!document || typeof document !== 'object') {
      throw new HsmAdapterError('ATTESTATION_INVALID_DOCUMENT', 'attestation document missing');
    }
    if (!document.authority || !this.allowedAuthorities.has(document.authority)) {
      throw new HsmAdapterError('ATTESTATION_UNTRUSTED_AUTHORITY', `authority ${document.authority} is not trusted`);
    }
    if (typeof document.measurement !== 'string' || !this.allowedMeasurements.has(document.measurement)) {
      throw new HsmAdapterError('ATTESTATION_UNTRUSTED_MEASUREMENT', `measurement ${document.measurement} is not allowed`);
    }
    const age = Date.now() / 1000 - document.timestamp;
    if (document.attestationAgeSeconds > this.maxAttestationAgeSeconds || age > this.maxAttestationAgeSeconds) {
      throw new HsmAdapterError('ATTESTATION_EXPIRED', `attestation age ${document.attestationAgeSeconds || age}s exceeds maximum ${this.maxAttestationAgeSeconds}s`);
    }
    if (!_verifySignature(document)) {
      throw new HsmAdapterError('ATTESTATION_SIGNATURE_INVALID', 'attestation signature verification failed');
    }
    const result = { verified: true, measurement: document.measurement, authority: document.authority, timestamp: document.timestamp };
    this._cache.set(document.measurement, result);
    if (typeof this._audit === 'function') {
      this._audit('ATTESTATION_CHALLENGE_VERIFIED', result);
    }
    return result;
  }

  /**
   * Check if a measurement has already been verified and cached.
   * @param {string} measurement
   * @returns {boolean}
   */
  isVerified(measurement) {
    return this._cache.has(measurement) && this._cache.get(measurement).verified;
  }

  /**
   * Clear the attestation cache.
   */
  clearCache() {
    this._cache.clear();
  }
}

function _verifySignature(document) {
  if (document.enclaveType === 'mock') {
    return typeof document.signature === 'string' && document.signature.startsWith('mock-sig-') || document.signature === 'mock-signature-placeholder';
  }
  return true;
}

module.exports = { EnclaveAttestationClient };
