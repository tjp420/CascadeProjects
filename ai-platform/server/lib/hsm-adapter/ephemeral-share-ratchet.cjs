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
    const seedSource = options.rootSeed || options.seed || options.seedBuffer;
    this.seed = Buffer.isBuffer(seedSource) ? seedSource : Buffer.from(String(seedSource || 'ratchet-seed'));
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

  /**
   * Evolves a share token using HKDF-SHA256 derived mask. Matches the earlier evolveShare API.
   * @param {{nodeIndex:number,value:BigInt|number,sequence:number}} shareToken
   * @param {string} destinationEpochId
   */
  evolveShare(shareToken, destinationEpochId) {
    if (!shareToken || typeof shareToken.nodeIndex !== 'number') throw new HsmAdapterError('ERR_INVALID_SHARE', 'share must have nodeIndex');
    if (typeof shareToken.sequence !== 'number') throw new HsmAdapterError('ERR_INVALID_SEQUENCE', 'sequence missing');
    if (!destinationEpochId) throw new HsmAdapterError('ERR_INVALID_DESTINATION', 'destinationEpochId required');

    const salt = Buffer.from(String(shareToken.nodeIndex));
    const info = Buffer.from(String(destinationEpochId) + '::' + String(shareToken.sequence));
    const maskRaw = require('crypto').hkdfSync('sha256', this.seed, salt, info, 32);
    const maskBuf = Buffer.isBuffer(maskRaw) ? maskRaw : Buffer.from(maskRaw);
    // convert buffer to BigInt without intermediate hex string to reduce transient string allocations
    const bufferToBigInt = (b) => {
      let v = 0n;
      for (let i = 0; i < b.length; i += 1) {
        v = (v << 8n) + BigInt(b[i]);
      }
      return v;
    };
    let maskBig = bufferToBigInt(maskBuf);

    const valueBig = typeof shareToken.value === 'bigint' ? shareToken.value : BigInt(shareToken.value || 0);
    const newValue = (valueBig + maskBig);

    // zeroize input best-effort
    try {
      if (typeof shareToken.value === 'bigint') shareToken.value = 0n;
      else if (Buffer.isBuffer(shareToken.value)) shareToken.value.fill(0);
      else if (typeof shareToken.value === 'number') shareToken.value = 0;
      else shareToken.value = null;
    } catch (e) {}

    // zeroize temporary buffers immediately
    try {
      if (Buffer.isBuffer(maskBuf)) maskBuf.fill(0);
      if (Buffer.isBuffer(salt)) salt.fill(0);
      if (Buffer.isBuffer(info)) info.fill(0);
      // overwrite maskBig local binding
      maskBig = 0n;
    } catch (e) {}

    return { nodeIndex: shareToken.nodeIndex, sequence: shareToken.sequence + 1, value: newValue, ratchet: { derivedAt: Date.now(), epoch: destinationEpochId } };
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
