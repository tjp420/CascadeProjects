'use strict';

/**
 * Track 48: Bridge time-lock escrow.
 *
 * Ensures assets transferred from a source platform remain safely
 * escrowed under strict expiration rules before unlocking on a
 * target runtime.
 *
 * @module hsm-adapter/bridge-time-lock-escrow
 */

const { HsmAdapterError } = require('./base-adapter.cjs');

class BridgeTimeLockEscrow {
  /**
   * @param {object} options
   * @param {object} options.policy
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._escrows = new Map();
  }

  /**
   * Lock an asset in escrow.
   * @param {object} transfer
   * @returns {object}
   */
  lock(transfer) {
    if (this._escrows.has(transfer.recipient + transfer.assetId)) {
      throw new HsmAdapterError('BRIDGE_ESCROW_DUPLICATE', 'escrow already exists for this recipient and asset');
    }
    const expiry = transfer.releaseEpoch + (this.policy.maxClaimExpirationEpochs || 10);
    this._escrows.set(transfer.recipient + transfer.assetId, {
      ...transfer,
      expiry,
      released: false,
    });
    return { locked: true, expiry };
  }

  /**
   * Release an escrowed asset.
   * @param {object} transfer
   * @param {number} currentEpoch
   * @returns {object}
   */
  release(transfer, currentEpoch) {
    const key = transfer.recipient + transfer.assetId;
    const escrow = this._escrows.get(key);
    if (!escrow) {
      throw new HsmAdapterError('BRIDGE_ESCROW_MISSING', 'no escrow found for this recipient and asset');
    }
    if (currentEpoch < escrow.releaseEpoch) {
      throw new HsmAdapterError('BRIDGE_ESCROW_LOCKED', `release not allowed before epoch ${escrow.releaseEpoch}`);
    }
    if (currentEpoch > escrow.expiry) {
      throw new HsmAdapterError('BRIDGE_ESCROW_EXPIRED', `claim expired at epoch ${escrow.expiry}`);
    }
    escrow.released = true;
    this._escrows.delete(key);
    return { released: true, recipient: escrow.recipient, amount: escrow.amount };
  }

  /**
   * Check escrow status.
   * @param {string} recipient
   * @param {string} assetId
   * @returns {object|null}
   */
  getStatus(recipient, assetId) {
    return this._escrows.get(recipient + assetId) || null;
  }
}

module.exports = { BridgeTimeLockEscrow };
