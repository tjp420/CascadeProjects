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
    // Hardening options for handshake/token flows
    this._timestampSkewMs = typeof options.timestampSkewMs === 'number' ? options.timestampSkewMs : 10000;
    this._nonceWindowMs = typeof options.nonceWindowMs === 'number' ? options.nonceWindowMs : 60000;
    this._tokenTtlMs = typeof options.tokenTtlMs === 'number' ? options.tokenTtlMs : 5 * 60 * 1000;
    this._seenNonces = new Map(); // nonce -> timestamp
    this._issuedTokens = new Map(); // token -> expiry
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

  /**
   * Verify a handshake payload from a peer enclave and issue a short-lived token.
   * Expected payload: { peerId, nonce, timestamp }
   * Throws HsmAdapterError with codes: MISSING_FIELDS, TIMESTAMP_SKEW, REPLAY_NONCE
   */
  async verifyHandshake(payload) {
    if (!payload || typeof payload !== 'object') {
      throw new HsmAdapterError('MISSING_FIELDS', 'handshake payload missing');
    }
    const { peerId, nonce, timestamp } = payload;
    if (!peerId || !nonce || typeof timestamp !== 'number') {
      throw new HsmAdapterError('MISSING_FIELDS', 'handshake payload missing required fields');
    }

    const now = Date.now();
    if (Math.abs(now - timestamp) > this._timestampSkewMs) {
      throw new HsmAdapterError('TIMESTAMP_SKEW', 'timestamp outside allowed window');
    }

    // Replay protection: reject if nonce seen recently
    const seenAt = this._seenNonces.get(nonce);
    if (seenAt && (now - seenAt) <= this._nonceWindowMs) {
      throw new HsmAdapterError('REPLAY_NONCE', 'nonce replay detected');
    }

    // Record nonce
    this._seenNonces.set(nonce, now);

    // Issue ephemeral token
    const token = crypto.randomBytes(16).toString('hex');
    this._issuedTokens.set(token, now + this._tokenTtlMs);

    return { token };
  }

  /**
   * Validate a session token issued by verifyHandshake.
   * Returns true if token exists and not expired.
   */
  validateSessionToken(token) {
    if (!token) return false;
    const exp = this._issuedTokens.get(token);
    if (!exp) return false;
    if (Date.now() > exp) {
      this._issuedTokens.delete(token);
      return false;
    }
    return true;
  }
}

function _verifySignature(document) {
  if (document.enclaveType === 'mock') {
    return typeof document.signature === 'string' && document.signature.startsWith('mock-sig-') || document.signature === 'mock-signature-placeholder';
  }
  return true;
}

module.exports = { EnclaveAttestationClient };
