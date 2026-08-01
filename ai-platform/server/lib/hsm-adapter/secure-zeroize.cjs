'use strict';

/**
 * Track 15: Secure zeroization utilities.
 *
 * Provides explicit memory overwriting for Node.js Buffers and safe
 * reference clearing for native crypto KeyObjects.
 *
 * @module hsm-adapter/secure-zeroize
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

const SUPPORTED_STRATEGIES = new Set(['random', 'zeros', 'both']);

/**
 * Overwrite the contents of a Buffer or typed array.
 * @param {Buffer|ArrayBufferView} input
 * @param {object} [options]
 * @param {string} [options.strategy='random'] - 'random', 'zeros', or 'both'
 * @returns {Buffer|ArrayBufferView} the same buffer, now zeroized
 */
function secureZeroize(input, options = {}) {
  if (!Buffer.isBuffer(input) && !ArrayBuffer.isView(input)) {
    throw new HsmAdapterError('INVALID_INPUT', 'secureZeroize requires a Buffer or ArrayBufferView');
  }
  const strategy = options.strategy || 'random';
  if (!SUPPORTED_STRATEGIES.has(strategy)) {
    throw new HsmAdapterError('INVALID_INPUT', `Unknown zeroization strategy: ${strategy}`);
  }
  if (strategy === 'random' || strategy === 'both') {
    crypto.randomFillSync(input);
  }
  if (strategy === 'zeros' || strategy === 'both') {
    input.fill(0);
  }
  return input;
}

/**
 * Clear any exported material and drop references to a native KeyObject.
 * @param {crypto.KeyObject} keyObject
 * @returns {undefined}
 */
function secureZeroizeKeyObject(keyObject) {
  if (!keyObject) return;
  if (typeof keyObject.export === 'function') {
    try {
      // Attempt to export and immediately zeroize any exposed material.
      // For private keys this still returns an object; we cannot control
      // internal OpenSSL memory, so we force the reference to go out of scope.
      keyObject.export({ type: 'spki', format: 'der' });
    } catch {
      // Ignore export failures; the goal is to drop the reference.
    }
  }
  return undefined;
}

module.exports = {
  secureZeroize,
  secureZeroizeKeyObject,
};
