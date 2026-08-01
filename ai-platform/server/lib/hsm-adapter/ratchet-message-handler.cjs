'use strict';

/**
 * Track 18: Out-of-order ratchet message handler.
 *
 * Temporarily caches skipped message keys so packets that arrive out of
 * sequence can be decrypted without stalling the ratchet state engine.
 *
 * @module hsm-adapter/ratchet-message-handler
 */

const { HsmAdapterError } = require('./base-adapter.cjs');

function _cacheKey(chainIndex, messageIndex) {
  return `${chainIndex}:${messageIndex}`;
}

class RatchetMessageHandler {
  /**
   * @param {object} [options]
   * @param {number} [options.maxSkipped=1000]
   * @param {number} [options.maxCacheMs=300000]
   */
  constructor(options = {}) {
    this._maxSkipped = typeof options.maxSkipped === 'number' ? options.maxSkipped : 1000;
    this._maxCacheMs = typeof options.maxCacheMs === 'number' ? options.maxCacheMs : 300000;
    this._skipped = new Map();
    this._timestamps = new Map();
    this._createdAt = Date.now();
  }

  _pruneExpired() {
    const now = Date.now();
    for (const [key, ts] of this._timestamps.entries()) {
      if (now - ts > this._maxCacheMs) {
        this._skipped.delete(key);
        this._timestamps.delete(key);
      }
    }
  }

  /**
   * Decrypt a ratchet envelope, handling out-of-order delivery.
   * @param {CryptographicRatchet} ratchet
   * @param {object} envelope
   * @param {string|Buffer} [aad='']
   * @returns {Buffer}
   */
  decrypt(ratchet, envelope, aad = '') {
    this._pruneExpired();
    if (envelope.chainIndex !== ratchet.chainIndex) {
      throw new HsmAdapterError('RATCHET_DESYNCHRONIZED', `chainIndex ${envelope.chainIndex} != current ${ratchet.chainIndex}`);
    }

    const target = envelope.messageIndex;
    const expected = ratchet.receivingMessageIndex;

    if (target < expected) {
      const key = _cacheKey(ratchet.chainIndex, target);
      const messageKey = this._skipped.get(key);
      if (!messageKey) {
        throw new HsmAdapterError('RATCHET_DESYNCHRONIZED', `no cached key for message ${target}`);
      }
      const plaintext = ratchet.decryptWithKey(envelope, aad, messageKey);
      this._skipped.delete(key);
      this._timestamps.delete(key);
      _secureZeroize(messageKey);
      return plaintext;
    }

    const gap = target - expected;
    if (gap > this._maxSkipped) {
      throw new HsmAdapterError('MAX_SKIPPED_EXCEEDED', `gap ${gap} exceeds maxSkipped ${this._maxSkipped}`);
    }

    // Derive and cache skipped keys
    for (let i = expected; i < target; i++) {
      const key = _cacheKey(ratchet.chainIndex, i);
      const messageKey = ratchet.deriveMessageKey(i);
      this._skipped.set(key, messageKey);
      this._timestamps.set(key, Date.now());
    }

    const targetKey = ratchet.deriveMessageKey(target);
    ratchet.advanceReceivingTo(target + 1);
    const plaintext = ratchet.decryptWithKey(envelope, aad, targetKey);
    _secureZeroize(targetKey);
    return plaintext;
  }

  /**
   * Expose current cache size for diagnostics.
   * @returns {number}
   */
  get cacheSize() {
    return this._skipped.size;
  }
}

function _secureZeroize(buf) {
  if (Buffer.isBuffer(buf)) buf.fill(0);
}

module.exports = {
  RatchetMessageHandler,
};
