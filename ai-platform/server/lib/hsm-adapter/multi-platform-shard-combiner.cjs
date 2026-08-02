'use strict';

/**
 * Track 53: Multi-platform shard combiner.
 *
 * Allows independent external environments to collectively aggregate
 * and evaluate operations directly on their pieces without ever
 * reconstructing the original key. Handles automatic isolation
 * boundaries if a target zone drops below the minTargetPlatformQuorum
 * constraint.
 *
 * @module hsm-adapter/multi-platform-shard-combiner
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class MultiPlatformShardCombiner {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {EnclaveAttestationClient} [options.attestationClient]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._pending = new Map();
    this._isolatedDestinations = new Set();
  }

  /**
   * Initiate a cross-platform combination session.
   * @param {object} request
   * @returns {object}
   */
  initiate(request) {
    if (!request.combinationId || !Array.isArray(request.shards)) {
      throw new HsmAdapterError('COMBINER_FIELDS_MISSING', 'combinationId and shards are required');
    }
    if (request.shards.length < (this.policy.minTargetPlatformQuorum || 3)) {
      if (this.policy.isolateLowQuorumDestinations) {
        for (const shard of request.shards) {
          this._isolatedDestinations.add(shard.destinationPlatformId);
        }
      }
      throw new HsmAdapterError('COMBINER_QUORUM_INSUFFICIENT', `shard count ${request.shards.length} below minimum ${this.policy.minTargetPlatformQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    const session = {
      combinationId: request.combinationId,
      shards: request.shards,
      evaluations: [],
      status: 'pending',
      initiatedAt: now,
    };
    this._pending.set(request.combinationId, session);
    return session;
  }

  /**
   * Submit a shard evaluation from a platform.
   * @param {string} combinationId
   * @param {string} platformId
   * @param {object} attestation
   * @param {string} evaluation
   * @param {number} signatureEpoch
   * @returns {object}
   */
  submit(combinationId, platformId, attestation, evaluation, signatureEpoch) {
    const session = this._pending.get(combinationId);
    if (!session) {
      throw new HsmAdapterError('COMBINER_SESSION_NOT_FOUND', `no pending combination ${combinationId}`);
    }
    if (this._isolatedDestinations.has(platformId)) {
      throw new HsmAdapterError('COMBINER_PLATFORM_ISOLATED', `platform ${platformId} is isolated`);
    }
    if (this.policy.requireDestinationAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(attestation);
        if (!result.verified) {
          throw new HsmAdapterError('COMBINER_PLATFORM_UNATTESTED', `platform ${platformId} attestation invalid`);
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('COMBINER_PLATFORM_UNATTESTED', `platform ${platformId} attestation invalid`);
      }
    }
    const now = Math.floor(Date.now() / 1000);
    const age = now - (signatureEpoch || now);
    if (age > (this.policy.signatureTimeoutSeconds || 300)) {
      throw new HsmAdapterError('COMBINER_SIGNATURE_EXPIRED', `signature age ${age}s exceeds timeout ${this.policy.signatureTimeoutSeconds}s`);
    }
    session.evaluations.push({ platformId, evaluation });
    if (session.evaluations.length >= session.shards.length) {
      session.status = 'verified';
      const combinedHash = crypto.createHash('sha256').update(session.evaluations.map((e) => e.evaluation).join(',')).digest('hex');
      if (this._audit) {
        this._audit('CROSS_PLATFORM_COMBINER_VERIFIED', {
          combinationId,
          evaluations: session.evaluations.length,
          combinedHash,
        });
      }
      this._pending.delete(combinationId);
    }
    return { submitted: true, status: session.status, evaluations: session.evaluations.length };
  }

  /**
   * Check if a platform is isolated.
   * @param {string} platformId
   * @returns {boolean}
   */
  isIsolated(platformId) {
    return this._isolatedDestinations.has(platformId);
  }

  /**
   * Get pending session status.
   * @param {string} combinationId
   * @returns {object|null}
   */
  getStatus(combinationId) {
    return this._pending.get(combinationId) || null;
  }
}

module.exports = { MultiPlatformShardCombiner };
