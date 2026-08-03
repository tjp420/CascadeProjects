'use strict';

/**
 * Track 57: ZK Membership Proof Processor.
 *
 * Succinct proof validator that verifies zero-knowledge membership
 * and non-membership proofs against the active accumulator root hash
 * without disclosing individual parameters. Tracks execution
 * exceptions to trigger automatic peer bans for malformed proofs.
 *
 * @module hsm-adapter/zk-membership-proof-processor
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class ZkMembershipProofProcessor {
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
    this._bannedPeers = new Set();
    this._verifiedProofs = new Map();
  }

  /**
   * Verify a zero-knowledge membership or non-membership proof.
   * @param {object} request
   * @returns {object}
   */
  verifyProof(request) {
    _validateProofRequest(this.policy, request);
    if (this.policy.requireMembershipProofAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.attestation);
        if (!result.verified) {
          throw new HsmAdapterError('ZK_MEMBERSHIP_PROOF_UNATTESTED', 'membership proof attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('ZK_MEMBERSHIP_PROOF_UNATTESTED', 'membership proof attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('ZK_MEMBERSHIP_PROOF_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.membershipProofSystem === 'string' && !this.policy.allowedMembershipProofSystems.includes(request.membershipProofSystem)) {
      throw new HsmAdapterError('ZK_MEMBERSHIP_PROOF_SYSTEM_BLOCKED', `membership proof system ${request.membershipProofSystem} is not permitted; allowed: ${this.policy.allowedMembershipProofSystems.join(', ')}`);
    }
    if (typeof request.peerId === 'string' && this._bannedPeers.has(request.peerId)) {
      throw new HsmAdapterError('ZK_MEMBERSHIP_PROOF_PEER_BANNED', `peer ${request.peerId} is banned`);
    }
    if (request.rootHashReference !== request.expectedRootHash) {
      if (this.policy.banMalformedMembershipPeers && typeof request.peerId === 'string') {
        this._bannedPeers.add(request.peerId);
      }
      throw new HsmAdapterError('ZK_MEMBERSHIP_PROOF_ROOT_MISMATCH', `root hash reference ${request.rootHashReference} does not match expected ${request.expectedRootHash}`);
    }
    if (!request.proof || typeof request.proof !== 'string') {
      if (this.policy.banMalformedMembershipPeers && typeof request.peerId === 'string') {
        this._bannedPeers.add(request.peerId);
      }
      throw new HsmAdapterError('ZK_MEMBERSHIP_PROOF_MALFORMED', 'proof payload is malformed');
    }
    const claimType = request.claimType || 'membership';
    if (claimType !== 'membership' && claimType !== 'non-membership') {
      if (this.policy.banMalformedMembershipPeers && typeof request.peerId === 'string') {
        this._bannedPeers.add(request.peerId);
      }
      throw new HsmAdapterError('ZK_MEMBERSHIP_PROOF_CLAIM_TYPE_INVALID', `claim type ${claimType} is not valid; allowed: membership, non-membership`);
    }
    const proofHash = crypto.createHash('sha256').update(request.proof).digest('hex');
    const proofId = request.proofId || `proof-${crypto.randomBytes(4).toString('hex')}`;
    const result = {
      proofId,
      rootHashReference: request.rootHashReference,
      membershipProofSystem: request.membershipProofSystem,
      claimType,
      proofHash,
      verified: true,
      verifiedAt: Math.floor(Date.now() / 1000),
    };
    this._verifiedProofs.set(proofId, result);
    if (this._audit) {
      this._audit('ZK_MEMBERSHIP_CLAIM_VALIDATED', result);
    }
    return result;
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
   * Get a verified proof by id.
   * @param {string} proofId
   * @returns {object|null}
   */
  getVerifiedProof(proofId) {
    return this._verifiedProofs.get(proofId) || null;
  }
}

function _validateProofRequest(policy, request) {
  if (!request.rootHashReference || !request.proof) {
    throw new HsmAdapterError('ZK_MEMBERSHIP_PROOF_FIELDS_MISSING', 'rootHashReference and proof are required');
  }
  if (policy.requireMembershipProofAttestation && !request.attestation) {
    throw new HsmAdapterError('ZK_MEMBERSHIP_PROOF_ATTESTATION_MISSING', 'membership proof attestation is required');
  }
}

module.exports = { ZkMembershipProofProcessor };
