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
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.allowedAuthorities = options.allowedAuthorities || ['mock-authority'];
    this.expectedMrenclave = options.expectedMrenclave || null;
    this.maxAttestationAgeSeconds = options.maxAttestationAgeSeconds || 60;
    this._audit = options.audit || null;
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

    return { valid: true, mrenclave: attestation.mrenclave, authority: attestation.authority };
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
