'use strict';

/**
 * Track 17: Threshold key recoverer (Shamir's Secret Sharing reconstruction).
 *
 * Reconstructs a secret from M or more shards using Lagrange interpolation
 * over a 256-bit prime field.
 *
 * @module hsm-adapter/threshold-key-recoverer
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');
const { PRIME } = require('./threshold-secret-splitter.cjs');

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

function _modPow(base, exp, mod) {
  let result = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e = e >> 1n;
  }
  return result;
}

function _modInv(a, p) {
  // Fermat's little theorem: a^(p-2) mod p for prime p
  return _modPow(a, p - 2n, p);
}

class ThresholdKeyRecoverer {
  /**
   * @param {object} [options]
   * @param {bigint} [options.prime] - override field prime
   */
  constructor(options = {}) {
    this._prime = options.prime || PRIME;
  }

  /**
   * Reconstruct a secret from at least M shards.
   * @param {Array<{custodianId, x, ys, secretLength, chunkSize, prime}>} shards
   * @param {number} [threshold]
   * @returns {Buffer}
   */
  recover(shards, threshold) {
    if (!Array.isArray(shards) || shards.length === 0) {
      throw new HsmAdapterError('INSUFFICIENT_SHARDS', 'shards must be a non-empty array');
    }
    if (typeof threshold !== 'number' || threshold < 1) {
      throw new HsmAdapterError('INVALID_THRESHOLD', 'threshold must be a positive integer');
    }
    if (shards.length < threshold) {
      throw new HsmAdapterError('INSUFFICIENT_SHARDS', `received ${shards.length} shards, need at least ${threshold}`);
    }

    const seenCustodians = new Set();
    for (const shard of shards) {
      if (seenCustodians.has(shard.custodianId)) {
        throw new HsmAdapterError('SHARD_CUSTODIAN_MISMATCH', `duplicate custodian ${shard.custodianId}`);
      }
      seenCustodians.add(shard.custodianId);
    }

    const reference = shards[0];
    const chunkCount = reference.ys.length;
    const chunkSize = reference.chunkSize;
    const secretLength = reference.secretLength;
    const prime = BigInt('0x' + reference.prime);

    const selected = shards.slice(0, threshold);
    const points = selected.map((s) => ({ x: BigInt(s.x), ys: s.ys.map((y) => _bytesToBigInt(Buffer.from(y, 'base64'))) }));

    const recoveredChunks = [];
    for (let c = 0; c < chunkCount; c++) {
      let secretValue = 0n;
      for (let i = 0; i < threshold; i++) {
        const xi = points[i].x;
        const yi = points[i].ys[c];
        let numerator = 1n;
        let denominator = 1n;
        for (let j = 0; j < threshold; j++) {
          if (i === j) continue;
          const xj = points[j].x;
          numerator = (numerator * (0n - xj)) % prime;
          denominator = (denominator * (xi - xj)) % prime;
        }
        const lagrange = (numerator * _modInv(denominator, prime)) % prime;
        secretValue = (secretValue + yi * lagrange) % prime;
      }
      if (secretValue < 0n) secretValue += prime;

      const isLastChunk = c === chunkCount - 1;
      const lastChunkLength = secretLength % chunkSize || chunkSize;
      const length = isLastChunk ? lastChunkLength : chunkSize;
      recoveredChunks.push(_bigIntToBytes(secretValue, length));
    }

    return Buffer.concat(recoveredChunks);
  }
}

module.exports = {
  ThresholdKeyRecoverer,
};
