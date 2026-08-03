'use strict';

/**
 * Track 48: Bridge time-lock escrow.
 *
 * Keeps cross-platform assets locked under strict epoch bounds until
 * a committee quorum validates the release.
 *
 * @module hsm-adapter/bridge-time-lock-escrow
 */

const { HsmAdapterError } = require('./base-adapter.cjs');

class BridgeTimeLockEscrow {
  constructor() {
    this._escrows = new Map();
    this._currentEpoch = 0;
  }

  /**
   * Set the current epoch for time-lock evaluation.
   * @param {number} epoch
   */
  setEpoch(epoch) {
    this._currentEpoch = epoch;
  }

  /**
   * Lock an asset in escrow.
   * @param {string} transferId
   * @param {number} amount
   * @param {number} lockEpoch
   * @param {number} releaseEpoch
   * @returns {object}
   */
  lock(transferId, amount, lockEpoch, releaseEpoch) {
    if (this._escrows.has(transferId)) {
      throw new HsmAdapterError('BRIDGE_ESCROW_EXISTS', `escrow ${transferId} already exists`);
    }
    this._escrows.set(transferId, {
      amount,
      lockEpoch,
      releaseEpoch,
      signatures: [],
    });
    return { locked: true, transferId };
  }

  /**
   * Validate that a claim is within the time-lock window.
   * @param {string} transferId
   * @returns {object}
   */
  validateClaim(transferId) {
    const escrow = this._escrows.get(transferId);
    if (!escrow) {
      return { valid: false, reason: `escrow ${transferId} not found` };
    }
    if (this._currentEpoch < escrow.releaseEpoch) {
      return { valid: false, reason: `time-lock not released until epoch ${escrow.releaseEpoch}` };
    }
    return { valid: true, transferId };
  }

  /**
   * Add a committee signature to an escrow.
   * @param {string} transferId
   * @param {string} signature
   * @returns {object}
   */
  addCommitteeSignature(transferId, signature) {
    const escrow = this._escrows.get(transferId);
    if (!escrow) {
      throw new HsmAdapterError('BRIDGE_ESCROW_MISSING', `escrow ${transferId} not found`);
    }
    escrow.signatures.push(signature);
    return { transferId, signatures: escrow.signatures.length };
  }

  /**
   * Attempt to release the escrow once quorum is reached.
   * @param {string} transferId
   * @param {number} minQuorum
   * @returns {object}
   */
  attemptRelease(transferId, minQuorum) {
    const escrow = this._escrows.get(transferId);
    if (!escrow) {
      throw new HsmAdapterError('BRIDGE_ESCROW_MISSING', `escrow ${transferId} not found`);
    }
    if (escrow.signatures.length < minQuorum) {
      return { released: false, transferId, signatures: escrow.signatures.length, needed: minQuorum };
    }
    this._escrows.delete(transferId);
    return { released: true, transferId, signatures: escrow.signatures.length };
  }

  /**
   * Get current escrow state.
   * @param {string} transferId
   * @returns {object}
   */
  getStatus(transferId) {
    const escrow = this._escrows.get(transferId);
    if (!escrow) return null;
    return { ...escrow, transferId };
  }
}

module.exports = { BridgeTimeLockEscrow };
