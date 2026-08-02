'use strict';

/**
 * Track 21: Ephemeral hardware token splitter.
 *
 * Issues 128-bit time-bounded cryptographic tokens bound to a tenant and
 * derived from a Track 12 hardware attestation root.
 *
 * @module hsm-adapter/ephemeral-hardware-token-splitter
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

const DEFAULT_TOKEN_LENGTH = 16;
const DEFAULT_TOKEN_EXPIRY_MS = 300000;
const DEFAULT_CLOCK_SKEW_MS = 5000;

function _bigIntToBytes(value, length) {
  const buf = Buffer.alloc(length);
  for (let i = length - 1; i >= 0; i--) {
    buf[i] = Number(value & 0xffn);
    value = value >> 8n;
  }
  return buf;
}

class EphemeralHardwareTokenSplitter {
  /**
   * @param {Buffer} attestationRoot - 32-byte Track 12 attestation root
   * @param {object} [options]
   * @param {number} [options.tokenExpiryMs=300000]
   * @param {number} [options.clockSkewMs=5000]
   * @param {number} [options.tokenLength=16]
   * @param {object} [options.logger]
   */
  constructor(attestationRoot, options = {}) {
    if (!Buffer.isBuffer(attestationRoot) || attestationRoot.length < 16) {
      throw new HsmAdapterError('INVALID_INPUT', 'attestationRoot must be a Buffer of at least 16 bytes');
    }
    this._attestationRoot = Buffer.from(attestationRoot);
    this._tokenExpiryMs = options.tokenExpiryMs || DEFAULT_TOKEN_EXPIRY_MS;
    this._clockSkewMs = typeof options.clockSkewMs === 'number' ? options.clockSkewMs : DEFAULT_CLOCK_SKEW_MS;
    this._tokenLength = options.tokenLength || DEFAULT_TOKEN_LENGTH;
    this._logger = options.logger || null;
    this._counter = 0;
    this._proofCount = new Map();
  }

  _audit(event, extra = {}) {
    if (!this._logger || !this._logger.info) return;
    this._logger.info(event, { sub: 'hsm-adapter', provider: 'ephemeral-token', ...extra });
  }

  _derive(tenantId, timestamp, counter) {
    const hmac = crypto.createHmac('sha256', this._attestationRoot);
    hmac.update(Buffer.isBuffer(tenantId) ? tenantId : Buffer.from(tenantId, 'utf8'));
    const ts = _bigIntToBytes(BigInt(timestamp), 8);
    hmac.update(ts);
    hmac.update(Buffer.from(counter.toString(10), 'utf8'));
    return hmac.digest().subarray(0, this._tokenLength);
  }

  /**
   * Issue a new ephemeral token for a tenant.
   * @param {string|Buffer} tenantId
   * @returns {{value: Buffer, issuedAt: number, expiresAt: number, tenantId: string}}
   */
  issue(tenantId) {
    if (typeof tenantId !== 'string' && !Buffer.isBuffer(tenantId)) {
      throw new HsmAdapterError('INVALID_INPUT', 'tenantId must be a string or Buffer');
    }
    const id = Buffer.isBuffer(tenantId) ? tenantId.toString('utf8') : tenantId;
    const issuedAt = Date.now();
    const expiresAt = issuedAt + this._tokenExpiryMs;
    this._counter++;
    const value = this._derive(tenantId, issuedAt, this._counter);
    this._audit('TOKEN_ISSUED', { tenantId: id, issuedAt, expiresAt });
    return { value, issuedAt, expiresAt, tenantId: id };
  }

  /**
   * Verify an ephemeral token for a tenant.
   * @param {{value: Buffer, issuedAt: number, expiresAt: number, tenantId: string}} token
   * @param {string|Buffer} tenantId
   * @returns {boolean}
   */
  verify(token, tenantId) {
    if (!token || !Buffer.isBuffer(token.value)) {
      throw new HsmAdapterError('INVALID_INPUT', 'token must contain a value Buffer');
    }
    if (token.value.length !== this._tokenLength) {
      throw new HsmAdapterError('INVALID_INPUT', `token value must be ${this._tokenLength} bytes`);
    }

    const id = Buffer.isBuffer(tenantId) ? tenantId.toString('utf8') : tenantId;
    if (token.tenantId !== id) {
      throw new HsmAdapterError('TOKEN_NOT_BOUND', `token is not bound to tenant ${id}`);
    }

    const now = Date.now();
    if (now > token.expiresAt + this._clockSkewMs) {
      throw new HsmAdapterError('IDENTITY_PROOF_EXPIRED', 'token has expired');
    }

    const expected = this._derive(tenantId, token.issuedAt, this._counter);
    const ok = expected.equals(token.value);
    this._audit('TOKEN_VERIFIED', { tenantId: id, ok });
    return ok;
  }

  /**
   * Record and enforce a proof limit.
   * @param {string} tenantId
   * @param {number} maxProofs
   */
  recordProof(tenantId, maxProofs) {
    const count = (this._proofCount.get(tenantId) || 0) + 1;
    if (count > maxProofs) {
      throw new HsmAdapterError('PROOF_LIMIT_EXCEEDED', `tenant ${tenantId} exceeded ${maxProofs} proofs`);
    }
    this._proofCount.set(tenantId, count);
  }
}

module.exports = {
  EphemeralHardwareTokenSplitter,
  DEFAULT_TOKEN_LENGTH,
  DEFAULT_TOKEN_EXPIRY_MS,
};
