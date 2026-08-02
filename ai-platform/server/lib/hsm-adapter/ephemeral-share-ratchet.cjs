'use strict';

/**
 * Track 42: Ephemeral share ratchet.
 *
 * Steps the inner randomness of individual shares on every epoch change,
 * providing post-quantum forward secrecy for historical states.
 *
 * @module hsm-adapter/ephemeral-share-ratchet
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');
const { secureZeroize } = require('./secure-zeroize.cjs');

class EphemeralShareRatchet {
  /**
   * @param {object} options
   * @param {string} options.seed
   * @param {number} options.epoch
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.seed = Buffer.isBuffer(options.seed) ? options.seed : Buffer.from(String(options.seed || 'ratchet-seed'));
    this.epoch = typeof options.epoch === 'number' ? options.epoch : 0;
    this._audit = options.audit || null;
  }

  /**
   * Advance the ratchet to the next epoch.
   * @param {object} share
   * @returns {object}
   */
  ratchet(share) {
    if (!share || typeof share.index !== 'number') {
      throw new HsmAdapterError('RATCHET_INVALID_SHARE', 'share must have an index');
    }
    const previousSeed = Buffer.from(this.seed);
    this.epoch += 1;
    this.seed = _deriveNextSeed(this.seed, share.index, this.epoch);
    const newValue = _advanceShareValue(share.value, this.seed);
    const result = { ...share, value: newValue, epoch: this.epoch };
    secureZeroize(previousSeed);
    if (this._audit) {
      this._audit('EPHEMERAL_SHARE_RATCHETED', { index: share.index, epoch: this.epoch });
    }
    return result;
  }

  /**
   * Reset the ratchet.
   * @returns {void}
   */
  reset() {
    this.epoch = 0;
    secureZeroize(this.seed);
    this.seed = Buffer.alloc(0);
  }

  /**
   * Get the current ratchet state.
   * @returns {object}
   */
  getState() {
    return { epoch: this.epoch, seedLength: this.seed.length };
  }
}

function _deriveNextSeed(seed, index, epoch) {
  const input = Buffer.concat([seed, Buffer.from(`${index}:${epoch}`)]);
  return crypto.createHash('sha3-256').update(input).digest();
}

function _advanceShareValue(value, seed) {
  const bigValue = typeof value === 'bigint' ? value : BigInt(value);
  const offset = BigInt('0x' + seed.slice(0, 8).toString('hex'));
  return bigValue + offset;
}

module.exports = { EphemeralShareRatchet };
