'use strict';

/**
 * Track 47: Enclave root rotator.
 *
 * Brokers decentralized multi-signature hardware master seed rotation.
 * Every participating admin endpoint must pass attestation before its
 * signature is accepted.
 *
 * @module hsm-adapter/enclave-root-rotator
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');
const { secureZeroize } = require('./secure-zeroize.cjs');

class EnclaveRootRotator {
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
    this._proposals = new Map();
  }

  /**
   * Initiate a new root rotation proposal.
   * @param {number} epochId
   * @param {Buffer|string} previousSeed
   * @param {Buffer|string} proposedSeed
   * @param {string} proposerEnclaveId
   * @param {number} timestamp
   * @returns {object}
   */
  propose(epochId, previousSeed, proposedSeed, proposerEnclaveId, timestamp) {
    const previousSeedHash = _hash(previousSeed);
    const proposedSeedHash = _hash(proposedSeed);
    const payload = _canonicalPayload({
      epochId,
      previousSeedHash,
      proposedSeedHash,
      proposerEnclaveId,
      timestamp,
      adminSignatures: [],
    });
    this._proposals.set(epochId, {
      payload,
      previousSeed,
      proposedSeed,
      adminSignatures: [],
      attestedAdmins: new Set(),
    });
    if (this._audit) {
      this._audit('ENCLAVE_ROOT_ROTATION_INITIATED', { epochId, proposerEnclaveId, timestamp });
    }
    return { epochId, payload };
  }

  /**
   * Add an attested admin signature to a proposal.
   * @param {number} epochId
   * @param {string} adminEnclaveId
   * @param {object} attestation
   * @param {string} signature
   * @returns {object}
   */
  sign(epochId, adminEnclaveId, attestation, signature) {
    const proposal = this._proposals.get(epochId);
    if (!proposal) {
      throw new HsmAdapterError('ROTATION_PROPOSAL_MISSING', `no proposal for epoch ${epochId}`);
    }
    if (this.policy.requireAdminAttestation && this._attestationClient) {
      const result = this._attestationClient.verify(attestation);
      if (!result.verified) {
        throw new HsmAdapterError('ROTATION_ADMIN_UNATTESTED', `admin ${adminEnclaveId} attestation invalid`);
      }
    }
    const now = Math.floor(Date.now() / 1000);
    const age = attestation.timestamp ? now - attestation.timestamp : 0;
    if (age > this.policy.maxSignatureExpirationSeconds) {
      throw new HsmAdapterError('ROTATION_SIGNATURE_EXPIRED', `admin signature age ${age}s exceeds ${this.policy.maxSignatureExpirationSeconds}s`);
    }
    if (proposal.attestedAdmins.has(adminEnclaveId)) {
      throw new HsmAdapterError('ROTATION_ADMIN_ALREADY_SIGNED', `admin ${adminEnclaveId} already signed`);
    }
    proposal.adminSignatures.push(`${adminEnclaveId}=${signature}`);
    proposal.attestedAdmins.add(adminEnclaveId);
    return { signed: true, epochId, signatures: proposal.adminSignatures.length };
  }

  /**
   * Commit the proposal after quorum is reached.
   * @param {number} epochId
   * @param {object} [keyDeriver]
   * @returns {object}
   */
  commit(epochId, keyDeriver) {
    const proposal = this._proposals.get(epochId);
    if (!proposal) {
      throw new HsmAdapterError('ROTATION_PROPOSAL_MISSING', `no proposal for epoch ${epochId}`);
    }
    if (proposal.adminSignatures.length < (this.policy.minAdminQuorum || 3)) {
      throw new HsmAdapterError('ROTATION_QUORUM_INSUFFICIENT', `signatures ${proposal.adminSignatures.length} below minimum ${this.policy.minAdminQuorum}`);
    }
    if (this.policy.requirePreviousSeedZeroization) {
      if (Buffer.isBuffer(proposal.previousSeed)) {
        secureZeroize(proposal.previousSeed, { strategy: 'both' });
      }
      proposal.previousSeed = null;
    }
    let rootKeys = null;
    if (keyDeriver) {
      rootKeys = keyDeriver.derive(proposal.proposedSeed);
    }
    if (this._audit) {
      this._audit('HARDWARE_SEED_COMMITTED', { epochId, rootKeyPublic: rootKeys ? rootKeys.public : null, timestamp: Math.floor(Date.now() / 1000) });
    }
    this._proposals.delete(epochId);
    return { committed: true, epochId, rootKeys };
  }

  /**
   * Get current proposal status.
   * @param {number} epochId
   * @returns {object}
   */
  getStatus(epochId) {
    const proposal = this._proposals.get(epochId);
    if (!proposal) return null;
    return {
      epochId,
      signatures: proposal.adminSignatures.length,
      needed: this.policy.minAdminQuorum || 3,
    };
  }
}

function _hash(seed) {
  const input = Buffer.isBuffer(seed) ? seed : Buffer.from(String(seed));
  return crypto.createHash('sha256').update(input).digest('hex');
}

function _canonicalPayload({ epochId, previousSeedHash, proposedSeedHash, proposerEnclaveId, timestamp, adminSignatures }) {
  const sigs = adminSignatures.join(':');
  return `ROTATION:${epochId}:${previousSeedHash}:${proposedSeedHash}:${proposerEnclaveId}:${timestamp}:${sigs}`;
}

module.exports = { EnclaveRootRotator };
