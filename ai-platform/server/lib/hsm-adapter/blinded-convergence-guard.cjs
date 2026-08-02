'use strict';

/**
 * Track 55: Blinded convergence guard.
 *
 * Prevents ciphertext tag-spoofing and brute-force dictionary attacks
 * by layering a threshold committee blinding factor over raw data
 * fingerprints before block deduplication. Tracks consecutive
 * protocol faults and executes defensive peer bans for malformed
 * chunk tokens.
 *
 * @module hsm-adapter/blinded-convergence-guard
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class BlindedConvergenceGuard {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {number} [options.maxConsecutiveFaults]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._maxConsecutiveFaults = options.maxConsecutiveFaults || 3;
    this._audit = options.audit || null;
    this._committeeBlindingFactor = crypto.randomBytes(32).toString('hex');
    this._peerFaults = new Map();
    this._bannedPeers = new Set();
  }

  /**
   * Apply the committee blinding factor to a raw ciphertext tag hash.
   * @param {string} rawTagHash
   * @param {string} blindingGroup
   * @returns {string}
   */
  blind(rawTagHash, blindingGroup) {
    if (typeof rawTagHash !== 'string' || !rawTagHash) {
      throw new HsmAdapterError('CONVERGENCE_TAG_INVALID', 'raw tag hash is required');
    }
    if (blindingGroup && !this.policy.permittedBlindingGroups.includes(blindingGroup)) {
      throw new HsmAdapterError('CONVERGENCE_BLINDING_GROUP_BLOCKED', `blinding group ${blindingGroup} is not permitted; allowed: ${this.policy.permittedBlindingGroups.join(', ')}`);
    }
    return crypto.createHash('sha256').update(`${rawTagHash}:${this._committeeBlindingFactor}:${blindingGroup}`).digest('hex');
  }

  /**
   * Validate a chunk token for structural well-formedness.
   * @param {string} peerId
   * @param {object} token
   * @returns {boolean}
   */
  validateToken(peerId, token) {
    if (!token || typeof token.chunkId !== 'string' || typeof token.ciphertextTagHash !== 'string') {
      this._recordFault(peerId, 'malformed token structure');
      return false;
    }
    if (token.ciphertextTagHash.length !== 64) {
      this._recordFault(peerId, 'ciphertext tag hash length invalid');
      return false;
    }
    return true;
  }

  /**
   * Record a protocol fault for a peer, banning if threshold exceeded.
   * @param {string} peerId
   * @param {string} reason
   */
  _recordFault(peerId, reason) {
    const count = (this._peerFaults.get(peerId) || 0) + 1;
    this._peerFaults.set(peerId, count);
    if (count >= this._maxConsecutiveFaults) {
      this._bannedPeers.add(peerId);
      if (this._audit) {
        this._audit('PEER_BANNED_MALFORMED_CHUNK', { peerId, faults: count, reason });
      }
    }
  }

  /**
   * Check if a peer is banned.
   * @param {string} peerId
   * @returns {boolean}
   */
  isPeerBanned(peerId) {
    return this._bannedPeers.has(peerId);
  }

  /**
   * Get fault count for a peer.
   * @param {string} peerId
   * @returns {number}
   */
  getFaultCount(peerId) {
    return this._peerFaults.get(peerId) || 0;
  }
}

module.exports = { BlindedConvergenceGuard };
