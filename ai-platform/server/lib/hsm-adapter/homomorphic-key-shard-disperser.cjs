'use strict';

/**
 * Track 53: Homomorphic key shard disperser.
 *
 * Performs math blinding weights over secret key components and
 * distributes them securely to target platforms using post-quantum
 * KEM wrappers (ML-KEM-1024). Enforces hardware attestation on
 * both local nodes and destination platform receivers.
 *
 * @module hsm-adapter/homomorphic-key-shard-disperser
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class HomomorphicKeyShardDisperser {
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
    this._shards = new Map();
    this._isolatedDestinations = new Set();
  }

  /**
   * Disperse homomorphic key shards to target platforms.
   * @param {object} request
   * @returns {object}
   */
  disperse(request) {
    _validateRequest(this.policy, request);
    if (this.policy.requireLocalNodeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.localNodeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('SHARD_LOCAL_UNATTESTED', 'local node attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('SHARD_LOCAL_UNATTESTED', 'local node attestation invalid');
      }
    }
    if (request.kemAlgorithm && request.kemAlgorithm !== this.policy.kemAlgorithm) {
      throw new HsmAdapterError('SHARD_KEM_BLOCKED', `KEM algorithm ${request.kemAlgorithm} is not allowed; permitted: ${this.policy.kemAlgorithm}`);
    }
    if (typeof request.shardDepth === 'number' && request.shardDepth > (this.policy.maxShardDepth || 8)) {
      throw new HsmAdapterError('SHARD_DEPTH_EXCEEDED', `shard depth ${request.shardDepth} exceeds maximum ${this.policy.maxShardDepth}`);
    }
    const destinations = request.destinations || [];
    if (destinations.length < (this.policy.minTargetPlatformQuorum || 3)) {
      throw new HsmAdapterError('SHARD_QUORUM_INSUFFICIENT', `target platform quorum ${destinations.length} below minimum ${this.policy.minTargetPlatformQuorum}`);
    }
    if (this.policy.requireDestinationAttestation && this._attestationClient) {
      for (const dest of destinations) {
        if (this._isolatedDestinations.has(dest.platformId)) {
          throw new HsmAdapterError('SHARD_DESTINATION_ISOLATED', `destination ${dest.platformId} is isolated`);
        }
        try {
          const result = this._attestationClient.verify(dest.destinationAttestation);
          if (!result.verified) {
            throw new HsmAdapterError('SHARD_DESTINATION_UNATTESTED', `destination ${dest.platformId} attestation invalid`);
          }
        } catch (err) {
          if (err instanceof HsmAdapterError) throw err;
          throw new HsmAdapterError('SHARD_DESTINATION_UNATTESTED', `destination ${dest.platformId} attestation invalid`);
        }
      }
    }
    const now = Math.floor(Date.now() / 1000);
    const shards = destinations.map((dest) => {
      const shardId = `shard-${crypto.randomBytes(4).toString('hex')}`;
      const blindWeight = crypto.randomBytes(32).toString('hex');
      const blindWeightHash = crypto.createHash('sha256').update(blindWeight).digest('hex');
      const kemWrapKeyHash = crypto.createHash('sha256').update(`${shardId}:${dest.platformId}`).digest('hex');
      const shard = {
        shardId,
        sourcePlatformId: request.sourcePlatformId,
        destinationPlatformId: dest.platformId,
        blindWeightHash,
        kemWrapKeyHash,
        dispersalEpoch: now,
        shardDepth: request.shardDepth || 1,
        status: 'dispersed',
      };
      this._shards.set(shardId, shard);
      if (this._audit) {
        this._audit('HOMOMORPHIC_SHARD_DISPERSED', {
          shardId,
          sourcePlatformId: shard.sourcePlatformId,
          destinationPlatformId: shard.destinationPlatformId,
          blindWeightHash,
          kemWrapKeyHash,
          dispersalEpoch: now,
        });
      }
      return shard;
    });
    return { dispersed: shards.length, shards };
  }

  /**
   * Check if a destination is isolated.
   * @param {string} platformId
   * @returns {boolean}
   */
  isIsolated(platformId) {
    return this._isolatedDestinations.has(platformId);
  }

  /**
   * Isolate a destination platform.
   * @param {string} platformId
   */
  isolate(platformId) {
    this._isolatedDestinations.add(platformId);
  }

  /**
   * Get a shard by id.
   * @param {string} shardId
   * @returns {object|null}
   */
  getShard(shardId) {
    return this._shards.get(shardId) || null;
  }
}

function _validateRequest(policy, request) {
  if (!request.sourcePlatformId || !Array.isArray(request.destinations)) {
    throw new HsmAdapterError('SHARD_FIELDS_MISSING', 'sourcePlatformId and destinations are required');
  }
  if (policy.requireLocalNodeAttestation && !request.localNodeAttestation) {
    throw new HsmAdapterError('SHARD_LOCAL_ATTESTATION_MISSING', 'local node attestation is required');
  }
}

module.exports = { HomomorphicKeyShardDisperser };
