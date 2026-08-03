'use strict';

/**
 * Track 58: Vesting Temporal Guard.
 *
 * Time-lock verification engine tied to the Track 22 TimeAnchorEngine
 * to strictly prevent premature asset extraction and block adversarial
 * system clock acceleration strategies. Triggers defensive node bans
 * for expired or duplicate milestone claims.
 *
 * @module hsm-adapter/vesting-temporal-guard
 */

const { HsmAdapterError } = require('./base-adapter.cjs');

class VestingTemporalGuard {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {TimeAnchorEngine} [options.timeAnchor]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._timeAnchor = options.timeAnchor || null;
    this._audit = options.audit || null;
    this._bannedPeers = new Set();
    this._seenClaims = new Map();
  }

  /**
   * Verify that an epoch window has elapsed before allowing release.
   * @param {object} request
   * @returns {object}
   */
  verifyEpochWindow(request) {
    if (!request.lockId || typeof request.epochIndex !== 'number') {
      throw new HsmAdapterError('VESTING_TEMPORAL_FIELDS_MISSING', 'lockId and epochIndex are required');
    }
    const minEpochSeconds = this.policy.minVestingEpochSeconds || 3600;
    const initializedAt = request.initializedAt || 0;
    const epochSeconds = request.epochSeconds || minEpochSeconds;
    const claimTimestamp = request.claimTimestamp || Math.floor(Date.now() / 1000);
    const expectedMinimumTime = initializedAt + (request.epochIndex * epochSeconds);
    if (claimTimestamp < expectedMinimumTime) {
      return {
        allowed: false,
        reason: `claim timestamp ${claimTimestamp} before epoch window ${expectedMinimumTime}`,
      };
    }
    if (this._timeAnchor && typeof this._timeAnchor.getCurrentTime === 'function') {
      const anchoredTime = this._timeAnchor.getCurrentTime();
      if (anchoredTime < expectedMinimumTime) {
        return {
          allowed: false,
          reason: `time anchor ${anchoredTime} before epoch window ${expectedMinimumTime}`,
        };
      }
      if (claimTimestamp > anchoredTime + 300) {
        return {
          allowed: false,
          reason: `claim timestamp ${claimTimestamp} ahead of time anchor ${anchoredTime} (clock acceleration detected)`,
        };
      }
    }
    return { allowed: true, reason: null };
  }

  /**
   * Check if a claim is expired.
   * @param {object} request
   * @returns {boolean}
   */
  isClaimExpired(request) {
    const minEpochSeconds = this.policy.minVestingEpochSeconds || 3600;
    const claimTimestamp = request.claimTimestamp || Math.floor(Date.now() / 1000);
    const expiryTime = (request.initializedAt || 0) + (request.totalEpochs || 1) * (request.epochSeconds || minEpochSeconds) + minEpochSeconds;
    return claimTimestamp > expiryTime;
  }

  /**
   * Check if a claim is a duplicate.
   * @param {string} lockId
   * @param {number} epochIndex
   * @returns {boolean}
   */
  isClaimDuplicate(lockId, epochIndex) {
    const claimKey = `${lockId}:${epochIndex}`;
    return this._seenClaims.has(claimKey);
  }

  /**
   * Record a processed claim.
   * @param {string} lockId
   * @param {number} epochIndex
   */
  recordClaim(lockId, epochIndex) {
    const claimKey = `${lockId}:${epochIndex}`;
    this._seenClaims.set(claimKey, Math.floor(Date.now() / 1000));
  }

  /**
   * Ban a peer for broadcasting expired or duplicate claims.
   * @param {string} peerId
   */
  banPeer(peerId) {
    this._bannedPeers.add(peerId);
  }

  /**
   * Check if a peer is banned.
   * @param {string} peerId
   * @returns {boolean}
   */
  isPeerBanned(peerId) {
    return this._bannedPeers.has(peerId);
  }
}

module.exports = { VestingTemporalGuard };
