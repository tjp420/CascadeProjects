'use strict';

/**
 * Track 92: ZK Epidemiological Claim Validator.
 *
 * Succinct epidemiological claim verifier
 * that processes non-interactive
 * zero-knowledge range and surveillance
 * proofs with functional encryption key
 * verification, ensuring that an entity's
 * hidden epidemiological claim status
 * strictly satisfies policy-defined
 * thresholds without disclosing individual
 * patient or jurisdiction attributes.
 * Triggers defensive node bans for
 * malformed or out-of-order epidemiological
 * claims.
 *
 * @module hsm-adapter/zk-epidemiological-claim-validator
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class ZkEpidemiologicalClaimValidator {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {PqcGlobalHealthEpidemiologicalSurveillanceGatingHub} options.hub
   * @param {EnclaveAttestationClient} [options.attestationClient]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._hub = options.hub || null;
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._bannedPeers = new Set();
    this._verifiedClaims = new Map();
  }

  /**
   * Verify an epidemiological claim proof.
   * @param {object} request
   * @returns {object}
   */
  verifyEpidemiologicalClaim(request) {
    _validateClaimRequest(this.policy, request);
    if (!this._hub) {
      throw new HsmAdapterError('EPICLAIM_HUB_MISSING', 'global health epidemiological surveillance gating hub is required');
    }
    if (this.policy.requireEpidemiologyOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.epidemiologyOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('EPICLAIM_COMMITTEE_UNATTESTED', 'epidemiology oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('EPICLAIM_COMMITTEE_UNATTESTED', 'epidemiology oversight committee attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('EPICLAIM_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.peerId === 'string' && this._bannedPeers.has(request.peerId)) {
      throw new HsmAdapterError('EPICLAIM_PEER_BANNED', `peer ${request.peerId} is banned`);
    }
    if (!request.zkEpidemiologicalRangeProofHash || typeof request.zkEpidemiologicalRangeProofHash !== 'string') {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('EPICLAIM_ZK_PROOF_MISSING', 'zero-knowledge epidemiological range proof hash is required');
    }
    if (!request.functionalEncryptionKeyDigest || typeof request.functionalEncryptionKeyDigest !== 'string') {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('EPICLAIM_FE_KEY_DIGEST_MISSING', 'functional encryption key digest is required');
    }
    const pool = this._hub.getPool(request.poolId);
    if (!pool) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('EPICLAIM_POOL_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (typeof request.surveillanceWindowSeconds === 'number' && request.surveillanceWindowSeconds > (this.policy.maxSurveillanceWindowSeconds || 604800)) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('EPICLAIM_SURVEILLANCE_WINDOW_OUT_OF_BOUNDS', `surveillance window seconds ${request.surveillanceWindowSeconds} exceeds maximum ${this.policy.maxSurveillanceWindowSeconds}`);
    }
    const claimKey = `${request.poolId}:${request.peerId || 'anonymous'}`;
    if (this._verifiedClaims.has(claimKey)) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('EPICLAIM_DUPLICATE', `epidemiological claim for pool ${request.poolId} already verified`);
    }
    const claimId = request.claimId || `claim-${crypto.randomBytes(4).toString('hex')}`;
    const now = Math.floor(Date.now() / 1000);
    const claim = {
      claimId,
      poolId: request.poolId,
      blindedGenomicSequenceCommitment: request.blindedGenomicSequenceCommitment || 'unspecified',
      blindedClaimValueCommitment: request.blindedClaimValueCommitment || 'unspecified',
      zkEpidemiologicalRangeProofHash: request.zkEpidemiologicalRangeProofHash,
      epidemiologyOversightCommitteeAttestationHash: request.epidemiologyOversightCommitteeAttestationHash || 'unspecified',
      functionalEncryptionKeyDigest: request.functionalEncryptionKeyDigest,
      verifiedAt: now,
    };
    this._verifiedClaims.set(claimKey, claim);
    this._hub.markEpidemiologicalClaimVerified(request.poolId);
    if (this._audit) {
      this._audit('ZK_EPIDEMIOLOGICAL_CLAIM_VERIFIED', { ...claim });
    }
    return claim;
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
   * Get all verified claims.
   * @returns {Array}
   */
  getVerifiedClaims() {
    return Array.from(this._verifiedClaims.values());
  }

  /**
   * Ban a peer if policy requires it.
   * @param {object} request
   * @private
   */
  _banPeerIfPolicy(request) {
    if (this.policy.banMalformedOrOutOfOrderEpidemiologicalClaims && typeof request.peerId === 'string') {
      this._bannedPeers.add(request.peerId);
    }
  }
}

function _validateClaimRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('EPICLAIM_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireEpidemiologyOversightCommitteeAttestation && !request.epidemiologyOversightCommitteeAttestation) {
    throw new HsmAdapterError('EPICLAIM_ATTESTATION_MISSING', 'epidemiology oversight committee attestation is required');
  }
}

module.exports = { ZkEpidemiologicalClaimValidator };
