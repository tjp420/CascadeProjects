'use strict';

/**
 * Track 51: PQC identity hub router.
 *
 * Manages a decentralized peer identity registry using post-quantum
 * key encapsulation mechanisms (ML-KEM-1024). Enforces hardware
 * attestation on registering hosts and auto-bans peers broadcasting
 * un-attested identity packages.
 *
 * @module hsm-adapter/pqc-identity-hub-router
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcIdentityHubRouter {
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
    this._identities = new Map();
    this._bannedPeers = new Set();
  }

  /**
   * Register a new network identity.
   * @param {object} packet
   * @returns {object}
   */
  register(packet) {
    _validatePacket(this.policy, packet);
    if (this._bannedPeers.has(packet.entityId)) {
      throw new HsmAdapterError('IDENTITY_PEER_BANNED', `entity ${packet.entityId} is banned`);
    }
    if (this.policy.requireHostAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(packet.hostAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('IDENTITY_HOST_UNATTESTED', `host attestation invalid for entity ${packet.entityId}`);
        }
      } catch (err) {
        if (this.policy.banUnattestedPeers) {
          this._bannedPeers.add(packet.entityId);
        }
        if (err instanceof HsmAdapterError) {
          throw err;
        }
        throw new HsmAdapterError('IDENTITY_HOST_UNATTESTED', `host attestation invalid for entity ${packet.entityId}`);
      }
    }
    if (packet.kemAlgorithm && packet.kemAlgorithm !== this.policy.kemAlgorithm) {
      throw new HsmAdapterError('IDENTITY_KEM_BLOCKED', `KEM algorithm ${packet.kemAlgorithm} is not allowed; permitted: ${this.policy.kemAlgorithm}`);
    }
    const now = Math.floor(Date.now() / 1000);
    const age = now - (packet.registrationEpoch || now);
    if (age > (this.policy.maxIdentityAgeSeconds || 86400)) {
      throw new HsmAdapterError('IDENTITY_EXPIRED', `identity age ${age}s exceeds maximum ${this.policy.maxIdentityAgeSeconds}s`);
    }
    const kemPublicKeyHash = crypto.createHash('sha256').update(packet.kemPublicKey || '').digest('hex');
    const identity = {
      entityId: packet.entityId,
      kemPublicKeyHash,
      registrationEpoch: packet.registrationEpoch || now,
      status: 'registered',
    };
    this._identities.set(packet.entityId, identity);
    if (this._audit) {
      this._audit('PQC_IDENTITY_HUB_REGISTERED', {
        entityId: packet.entityId,
        kemPublicKeyHash,
        registrationEpoch: identity.registrationEpoch,
      });
    }
    return identity;
  }

  /**
   * Check if a peer is banned.
   * @param {string} entityId
   * @returns {boolean}
   */
  isBanned(entityId) {
    return this._bannedPeers.has(entityId);
  }

  /**
   * Get a registered identity.
   * @param {string} entityId
   * @returns {object|null}
   */
  getIdentity(entityId) {
    return this._identities.get(entityId) || null;
  }
}

function _validatePacket(policy, packet) {
  if (!packet.entityId || !packet.kemPublicKey) {
    throw new HsmAdapterError('IDENTITY_FIELDS_MISSING', 'entityId and kemPublicKey are required');
  }
  if (policy.requireHostAttestation && !packet.hostAttestation) {
    throw new HsmAdapterError('IDENTITY_HOST_ATTESTATION_MISSING', 'host attestation is required');
  }
}

module.exports = { PqcIdentityHubRouter };
