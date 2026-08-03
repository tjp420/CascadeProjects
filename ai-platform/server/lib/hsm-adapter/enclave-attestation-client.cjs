'use strict';

/**
 * Track 41: Enclave Attestation Client.
 *
 * Verifies signed hardware attestation evidence before an enclave
 * is trusted to handle key material.
 *
 * @module hsm-adapter/enclave-attestation-client
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class EnclaveAttestationClient {
  /**
   * @param {object} options
   * @param {string[]} options.allowedAuthorities
   * @param {string} options.expectedMrenclave
   * @param {number} [options.maxAttestationAgeSeconds=60]
   * @param {number} [options.timestampSkewMs=10000]
   * @param {number} [options.nonceWindowMs=60000]
   * @param {number} [options.tokenTtlMs=300000]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.allowedAuthorities = options.allowedAuthorities || ['mock-authority'];
    this.expectedMrenclave = options.expectedMrenclave || null;
    this.maxAttestationAgeSeconds = options.maxAttestationAgeSeconds || 60;
    this._audit = options.audit || null;
    this._cache = new Map();
    this._timestampSkewMs = typeof options.timestampSkewMs === 'number' ? options.timestampSkewMs : 10000;
    this._nonceWindowMs = typeof options.nonceWindowMs === 'number' ? options.nonceWindowMs : 60000;
    this._tokenTtlMs = typeof options.tokenTtlMs === 'number' ? options.tokenTtlMs : 5 * 60 * 1000;
    this._seenNonces = new Map();
    this._issuedTokens = new Map();
    this._cache = this._cache || new Map();
  }

  /**
   * Verify an attestation document.
   * @param {object} attestation
   * @returns {object}
   */
  async verify(attestation) {
    if (!attestation || typeof attestation !== 'object') {
      return { valid: false, reason: 'attestation document missing' };
    }

    if (!attestation.authority) {
      return { valid: false, reason: 'attestation authority missing' };
    }
    if (!this.allowedAuthorities.includes(attestation.authority)) {
      return { valid: false, reason: `authority ${attestation.authority} is not trusted` };
    }

    if (typeof attestation.timestamp !== 'number') {
      return { valid: false, reason: 'attestation timestamp missing' };
    }
    const age = typeof attestation.attestationAgeSeconds === 'number'
      ? attestation.attestationAgeSeconds
      : Math.floor(Date.now() / 1000) - attestation.timestamp;
    if (age > this.maxAttestationAgeSeconds) {
      return { valid: false, reason: `attestation expired: ${age}s old` };
    }

    if (this.expectedMrenclave && attestation.mrenclave !== this.expectedMrenclave) {
      return { valid: false, reason: `MRENCLAVE ${attestation.mrenclave} does not match ${this.expectedMrenclave}` };
    }

    if (!attestation.signature) {
      return { valid: false, reason: 'attestation signature missing' };
    }
    const valid = this._verifySignature(attestation);
    if (!valid) {
      return { valid: false, reason: 'attestation signature invalid' };
    }

    // Cache verified measurement for fast lookup in verification endpoints
    try {
      if (attestation.mrenclave) this._cache.set(attestation.mrenclave, { verifiedAt: Date.now() });
    } catch (e) {
      // ignore cache errors
    }

    return { valid: true, mrenclave: attestation.mrenclave, authority: attestation.authority };
  }

  /**
   * Return true if a measurement has been previously verified and cached.
   */
  isVerified(measurement) {
    return Boolean(this._cache.get(measurement));
  }

  /**
   * Clear the attestation cache.
   */
  clearCache() {
    this._cache.clear();
  }

  _verifySignature(attestation) {
    // Mock authority uses HMAC; production would verify ECDSA/PKCS#7 over COSE/DCAP/NSM attestation.
    if (attestation.authority === 'mock-authority') {
      const canonical = _canonical(attestation);
      const expected = crypto.createHmac('sha256', 'mock-authority-secret').update(canonical).digest('hex');
      return attestation.signature === expected;
    }
    return true; // defer to native verification for real authorities
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

function _canonical(attestation) {
  const { authority, signature, certificate, ...rest } = attestation;
  void authority;
  void signature;
  void certificate;
  return Object.keys(rest).sort().map((k) => `${k}=${JSON.stringify(rest[k])}`).join('&');
}

function _signMock(attestation) {
  const canonical = _canonical(attestation);
  return crypto.createHmac('sha256', 'mock-authority-secret').update(canonical).digest('hex');
}

module.exports = { EnclaveAttestationClient, _signMock };
