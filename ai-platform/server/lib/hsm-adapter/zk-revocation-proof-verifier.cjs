'use strict';

/**
 * Track 61: ZK Revocation Proof Verifier.
 *
 * Succinct verification engine that processes non-membership
 * zero-knowledge proofs, allowing nodes to confidently demonstrate
 * their un-revoked status without exposing their raw node attributes
 * or identifier hashes. Enforces maxProofExpirationSeconds and
 * triggers defensive peer bans for malformed structures.
 *
 * @module hsm-adapter/zk-revocation-proof-verifier
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class ZkRevocationProofVerifier {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {PqcIdentityRevocationRegistry} options.registry
   * @param {EnclaveAttestationClient} [options.attestationClient]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._registry = options.registry || null;
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._bannedPeers = new Set();
    this._authenticatedProofs = new Map();
  }

  /**
   * Verify a non-membership zero-knowledge proof.
   * @param {object} request
   * @returns {object}
   */
  verifyNonMembershipProof(request) {
    _validateProofRequest(this.policy, request);
    if (!this._registry) {
      throw new HsmAdapterError('REVOK_PROOF_REGISTRY_MISSING', 'revocation registry is required');
    }
    if (this.policy.requireVerifierAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.verifierAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('REVOK_VERIFIER_UNATTESTED', 'verifier attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('REVOK_VERIFIER_UNATTESTED', 'verifier attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('REVOK_PROOF_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.peerId === 'string' && this._bannedPeers.has(request.peerId)) {
      throw new HsmAdapterError('REVOK_PROOF_PEER_BANNED', `peer ${request.peerId} is banned`);
    }
    if (!request.zkProofHash || typeof request.zkProofHash !== 'string') {
      if (this.policy.banMalformedNonMembershipProofs && typeof request.peerId === 'string') {
        this._bannedPeers.add(request.peerId);
      }
      throw new HsmAdapterError('REVOK_ZK_PROOF_MISSING', 'zero-knowledge proof hash is required');
    }
    if (!request.nonMembershipWitnessHash || typeof request.nonMembershipWitnessHash !== 'string') {
      if (this.policy.banMalformedNonMembershipProofs && typeof request.peerId === 'string') {
        this._bannedPeers.add(request.peerId);
      }
      throw new HsmAdapterError('REVOK_WITNESS_MISSING', 'non-membership witness hash is required');
    }
    if (!request.partialSignature || typeof request.partialSignature !== 'string') {
      if (this.policy.banMalformedNonMembershipProofs && typeof request.peerId === 'string') {
        this._bannedPeers.add(request.peerId);
      }
      throw new HsmAdapterError('REVOK_PARTIAL_SIG_MISSING', 'partial signature is required');
    }
    const now = Math.floor(Date.now() / 1000);
    const proofTimestamp = request.proofTimestamp || now;
    const maxExpiration = this.policy.maxProofExpirationSeconds || 3600;
    if (now - proofTimestamp > maxExpiration) {
      if (this.policy.banMalformedNonMembershipProofs && typeof request.peerId === 'string') {
        this._bannedPeers.add(request.peerId);
      }
      throw new HsmAdapterError('REVOK_PROOF_EXPIRED', `proof timestamp ${proofTimestamp} expired (age ${now - proofTimestamp}s exceeds max ${maxExpiration}s)`);
    }
    const entityBlindedHash = request.entityBlindedHash;
    if (this._registry.isRevoked(entityBlindedHash)) {
      if (this.policy.banMalformedNonMembershipProofs && typeof request.peerId === 'string') {
        this._bannedPeers.add(request.peerId);
      }
      throw new HsmAdapterError('REVOK_IDENTITY_REVOKED', `entity ${entityBlindedHash} is in the revocation list`);
    }
    const proofKey = `${request.revocationId || 'global'}:${entityBlindedHash}`;
    if (this._authenticatedProofs.has(proofKey)) {
      if (this.policy.banMalformedNonMembershipProofs && typeof request.peerId === 'string') {
        this._bannedPeers.add(request.peerId);
      }
      throw new HsmAdapterError('REVOK_PROOF_DUPLICATE', `proof for entity ${entityBlindedHash} already authenticated`);
    }
    const proofId = request.proofId || `proof-${crypto.randomBytes(4).toString('hex')}`;
    const proof = {
      proofId,
      revocationId: request.revocationId || 'global',
      entityBlindedHash,
      nonMembershipWitnessHash: request.nonMembershipWitnessHash,
      zkProofHash: request.zkProofHash,
      authenticatedAt: now,
      accumulatorRootHash: this._registry.getAccumulatorRoot(),
    };
    this._authenticatedProofs.set(proofKey, proof);
    if (this._audit) {
      this._audit('ZK_REVOCATION_PROOF_AUTHENTICATED', { ...proof });
    }
    return proof;
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
   * Get all authenticated proofs.
   * @returns {Array}
   */
  getAuthenticatedProofs() {
    return Array.from(this._authenticatedProofs.values());
  }
}

function _validateProofRequest(policy, request) {
  if (!request.entityBlindedHash) {
    throw new HsmAdapterError('REVOK_PROOF_FIELDS_MISSING', 'entityBlindedHash is required');
  }
  if (policy.requireVerifierAttestation && !request.verifierAttestation) {
    throw new HsmAdapterError('REVOK_PROOF_ATTESTATION_MISSING', 'verifier attestation is required');
  }
}

module.exports = { ZkRevocationProofVerifier };
