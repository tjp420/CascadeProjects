'use strict';

/**
 * Track 19: Additive homomorphic masking using randomized BigInt blinding.
 *
 * Allows values to be masked such that addition can be performed on
 * ciphertexts without exposing plaintext. All arithmetic is performed
 * modulo a configurable prime p.
 *
 * @module hsm-adapter/homomorphic-masker
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

const DEFAULT_BITS = 2048;

function _randomBigInt(max) {
  const byteLength = Math.ceil(max.toString(2).length / 8);
  const bytes = crypto.randomBytes(byteLength + 8);
  let value = 0n;
  for (const b of bytes) {
    value = (value << 8n) | BigInt(b);
  }
  return value % max;
}

function _mod(a, p) {
  let r = a % p;
  if (r < 0n) r += p;
  return r;
}

class HomomorphicMasker {
  /**
   * @param {object} [options]
   * @param {number} [options.bits=2048] - modulus bit length
   * @param {bigint} [options.modulus] - explicit prime modulus
   * @param {object} [options.logger]
   */
  constructor(options = {}) {
    this._bits = options.bits || DEFAULT_BITS;
    this._logger = options.logger || null;

    if (options.modulus) {
      if (typeof options.modulus !== 'bigint' || options.modulus <= 0n) {
        throw new HsmAdapterError('INVALID_INPUT', 'modulus must be a positive bigint');
      }
      this._p = options.modulus;
      this._bits = Number(options.modulus.toString(2).length);
    } else {
      this._p = crypto.generatePrimeSync(this._bits, { safe: true, bigint: true });
    }
    this._overflow = this._p * 2n;
  }

  _audit(event, extra = {}) {
    if (!this._logger || !this._logger.info) return;
    this._logger.info(event, { sub: 'hsm-adapter', provider: 'homomorphic', bits: this._bits, ...extra });
  }

  _ensureInField(value) {
    if (typeof value !== 'bigint') {
      throw new HsmAdapterError('INVALID_INPUT', 'values must be BigInt');
    }
    if (value >= this._overflow) {
      throw new HsmAdapterError('HOMOMORPHIC_OVERFLOW', `value ${value} exceeds 2p`);
    }
  }

  get modulus() {
    return this._p;
  }

  /**
   * Mask a plaintext value.
   * @param {bigint} value
   * @returns {{ciphertext: bigint, blindingFactor: bigint}}
   */
  blind(value) {
    this._ensureInField(value);
    const x = _mod(value, this._p);
    const r = _randomBigInt(this._p);
    const c = _mod(x + r, this._p);
    this._audit('PAYLOAD_BLINDED', { ciphertext: c.toString(16).slice(0, 16) });
    return { ciphertext: c, blindingFactor: r };
  }

  /**
   * Unmask a ciphertext.
   * @param {bigint} ciphertext
   * @param {bigint} blindingFactor
   * @returns {bigint}
   */
  unmask(ciphertext, blindingFactor) {
    if (typeof ciphertext !== 'bigint' || typeof blindingFactor !== 'bigint') {
      throw new HsmAdapterError('INVALID_BLIND', 'ciphertext and blindingFactor must be BigInt');
    }
    if (ciphertext < 0n || ciphertext >= this._p || blindingFactor < 0n || blindingFactor >= this._p) {
      throw new HsmAdapterError('INVALID_BLIND', 'ciphertext and blindingFactor must be in [0, p)');
    }
    const x = _mod(ciphertext - blindingFactor, this._p);
    return x;
  }

  /**
   * Add two masked values without unmasking.
   * @param {bigint} c1
   * @param {bigint} c2
   * @returns {bigint}
   */
  add(c1, c2) {
    if (typeof c1 !== 'bigint' || typeof c2 !== 'bigint') {
      throw new HsmAdapterError('INVALID_INPUT', 'addends must be BigInt');
    }
    if (c1 < 0n || c1 >= this._p || c2 < 0n || c2 >= this._p) {
      throw new HsmAdapterError('INVALID_INPUT', 'addends must be in [0, p)');
    }
    const sum = c1 + c2;
    if (sum >= this._overflow) {
      throw new HsmAdapterError('HOMOMORPHIC_OVERFLOW', `sum ${sum} exceeds 2p`);
    }
    return _mod(sum, this._p);
  }

  /**
   * Unmask the result of a blinded addition.
   * @param {bigint} ciphertext
   * @param {bigint} totalBlinding
   * @returns {bigint}
   */
  unmaskSum(ciphertext, totalBlinding) {
    return this.unmask(ciphertext, _mod(totalBlinding, this._p));
  }

  /**
   * Combine blinding factors for a sum.
   * @param {bigint[]} blinds
   * @returns {bigint}
   */
  combineBlinds(blinds) {
    if (!Array.isArray(blinds) || blinds.some((b) => typeof b !== 'bigint')) {
      throw new HsmAdapterError('INVALID_BLIND', 'blinds must be an array of BigInt');
    }
    const total = blinds.reduce((acc, b) => acc + _mod(b, this._p), 0n);
    if (total >= this._overflow) {
      throw new HsmAdapterError('HOMOMORPHIC_OVERFLOW', `combined blinding ${total} exceeds 2p`);
    }
    return _mod(total, this._p);
  }
}

module.exports = {
  HomomorphicMasker,
  DEFAULT_BITS,
};
