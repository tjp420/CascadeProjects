'use strict';

/**
 * Track 17: Threshold secret splitter (Shamir's Secret Sharing).
 *
 * Splits a secret buffer into N shards such that any M shards can
 * reconstruct the secret, but M - 1 or fewer shards reveal no information.
 *
 * All arithmetic is performed over a 256-bit prime field.
 *
 * @module hsm-adapter/threshold-secret-splitter
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

// 256-bit safe prime used as the finite field modulus: 2^256 - 189.
const PRIME = (1n << 256n) - 189n;

function _bytesToBigInt(buf) {
  let value = 0n;
  for (const b of buf) {
    value = (value << 8n) | BigInt(b);
  }
  return value;
}

function _bigIntToBytes(value, length) {
  const buf = Buffer.alloc(length);
  for (let i = length - 1; i >= 0; i--) {
    buf[i] = Number(value & 0xffn);
    value = value >> 8n;
  }
  return buf;
}

function _randomFieldElement() {
  const bytes = crypto.randomBytes(32);
  let value = _bytesToBigInt(bytes) % PRIME;
  if (value < 0n) value += PRIME;
  return value;
}

function _evaluatePolynomial(coefficients, x) {
  let result = 0n;
  let power = 1n;
  for (const c of coefficients) {
    result = (result + c * power) % PRIME;
    power = (power * x) % PRIME;
  }
  return result;
}

class ThresholdSecretSplitter {
  /**
   * @param {object} [options]
   * @param {bigint} [options.prime] - override field prime
   * @param {number} [options.maxTotal=7] - hard upper bound for N
   */
  constructor(options = {}) {
    this._prime = options.prime || PRIME;
    this._maxTotal = options.maxTotal || 7;
    this._chunkSize = this._deriveChunkSize();
  }

  _deriveChunkSize() {
    let size = 0;
    let max = 1n;
    while (max * 256n < this._prime) {
      max *= 256n;
      size++;
    }
    return size || 1;
  }

  /**
   * Split a secret buffer into N threshold shards.
   * @param {Buffer} secret
   * @param {number} total - N (number of shards)
   * @param {number} threshold - M (minimum shards for recovery)
   * @param {string[]} custodianIds
   * @returns {Array<{custodianId, x, ys, prime}>}
   */
  split(secret, total, threshold, custodianIds) {
    if (!Buffer.isBuffer(secret)) {
      throw new HsmAdapterError('INVALID_INPUT', 'secret must be a Buffer');
    }
    if (!Number.isInteger(total) || !Number.isInteger(threshold)) {
      throw new HsmAdapterError('INVALID_THRESHOLD', 'total and threshold must be integers');
    }
    if (threshold < 1 || total < 1 || threshold > total) {
      throw new HsmAdapterError('INVALID_THRESHOLD', `threshold (${threshold}) must satisfy 1 ≤ threshold ≤ total (${total})`);
    }
    if (total > this._maxTotal) {
      throw new HsmAdapterError('INVALID_THRESHOLD', `total (${total}) exceeds maximum ${this._maxTotal}`);
    }
    if (!Array.isArray(custodianIds) || custodianIds.length !== total) {
      throw new HsmAdapterError('INVALID_INPUT', `custodianIds array must contain exactly ${total} entries`);
    }

    const chunks = [];
    for (let i = 0; i < secret.length; i += this._chunkSize) {
      chunks.push(secret.subarray(i, i + this._chunkSize));
    }

    const shardYs = [];
    for (const chunk of chunks) {
      const secretValue = _bytesToBigInt(chunk) % this._prime;
      const coefficients = [secretValue];
      for (let i = 1; i < threshold; i++) {
        coefficients.push(_randomFieldElement());
      }
      const ys = [];
      for (let i = 0; i < total; i++) {
        const x = BigInt(i + 1);
        const y = _evaluatePolynomial(coefficients, x);
        ys.push(_bigIntToBytes(y, 32).toString('base64'));
      }
      shardYs.push(ys);
    }

    const shards = [];
    for (let i = 0; i < total; i++) {
      const ys = shardYs.map((ysList) => ysList[i]);
      shards.push({
        custodianId: custodianIds[i],
        x: i + 1,
        ys,
        secretLength: secret.length,
        chunkSize: this._chunkSize,
        prime: this._prime.toString(16),
      });
    }
    return shards;
  }
}

module.exports = {
  ThresholdSecretSplitter,
  PRIME,
};
