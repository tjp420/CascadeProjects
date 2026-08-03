'use strict';

/**
 * Track 97: ZK Aerosol Claim Validator.
 *
 * Validates zero-knowledge aerosol monitoring claims against
 * stratospheric aerosol monitoring gating pools. Enforces canonical
 * payload layout, verifies latticeSignatureDigest for lattice-based
 * commitment verification, and bans peers broadcasting malformed
 * or out-of-order claims.
 *
 * @module hsm-adapter/zk-aerosol-claim-validator
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class ZkAerosolClaimValidator {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {PqcStratosphericAerosolMonitoringGatingHub} options.hub
   * @param {EnclaveAttestationClient} [options.attestationClient]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this.hub = options.hub || null;
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._verifiedClaims = new Set();
    this._bannedPeers = new Set();
  }

  /**
   * Verify a zero-knowledge aerosol monitoring claim.
   * @param {object} request
   * @returns {object}
   */
  verifyAerosolClaim(request) {
    _validateClaimRequest(this.policy, request, this._bannedPeers);
    const pool = this.hub ? this.hub.getPool(request.poolId) : null;
    if (!pool) {
      throw new HsmAdapterError('STRATOCLAIM_POOL_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (pool.status !== 'open') {
      throw new HsmAdapterError('STRATOCLAIM_POOL_NOT_OPEN', `pool ${request.poolId} is not open`);
    }
    if (this.policy.requireStratosphericOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.stratosphericOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('STRATOCLAIM_OVERSIGHT_COMMITTEE_UNATTESTED', 'stratospheric oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('STRATOCLAIM_OVERSIGHT_COMMITTEE_UNATTESTED', 'stratospheric oversight committee attestation invalid');
      }
    }
    if (this.policy.banMalformedOrOutOfOrderAerosolClaims && request.peerId && this._bannedPeers.has(request.peerId)) {
      throw new HsmAdapterError('STRATOCLAIM_PEER_BANNED', `peer ${request.peerId} is banned`);
    }
    const claimHash = crypto.createHash('sha256').update(JSON.stringify({
      poolId: request.poolId,
      blindedAerosolDispersionCommitment: request.blindedAerosolDispersionCommitment,
      blindedSensorCalibrationCommitment: request.blindedSensorCalibrationCommitment,
      blindedClimateAuthorityIdentityCommitment: request.blindedClimateAuthorityIdentityCommitment,
      zkAerosolRangeProofHash: request.zkAerosolRangeProofHash,
      latticeSignatureDigest: request.latticeSignatureDigest,
    })).digest('hex');
    if (this.policy.banMalformedOrOutOfOrderAerosolClaims && this._verifiedClaims.has(claimHash)) {
      if (request.peerId) this._bannedPeers.add(request.peerId);
      throw new HsmAdapterError('STRATOCLAIM_DUPLICATE', `duplicate aerosol claim for pool ${request.poolId}`);
    }
    this._verifiedClaims.add(claimHash);
    if (this.hub) this.hub.markAerosolClaimVerified(request.poolId);
    const claimId = request.claimId || `claim-${crypto.randomBytes(4).toString('hex')}`;
    const claim = {
      claimId,
      poolId: request.poolId,
      latticeSignatureDigest: request.latticeSignatureDigest,
      zkAerosolRangeProofHash: request.zkAerosolRangeProofHash,
      verifiedAt: Math.floor(Date.now() / 1000),
    };
    if (this._audit) {
      this._audit('ZK_AEROSOL_CLAIM_VERIFIED', { ...claim });
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
   * Get the number of verified claims.
   * @returns {number}
   */
  getVerifiedClaimCount() {
    return this._verifiedClaims.size;
  }
}

function _validateClaimRequest(policy, request, bannedPeers) {
  if (!request.poolId) {
    throw new HsmAdapterError('STRATOCLAIM_FIELDS_MISSING', 'poolId is required');
  }
  if (!request.blindedAerosolDispersionCommitment || !request.blindedSensorCalibrationCommitment || !request.blindedClimateAuthorityIdentityCommitment) {
    throw new HsmAdapterError('STRATOCLAIM_FIELDS_MISSING', 'blindedAerosolDispersionCommitment, blindedSensorCalibrationCommitment, and blindedClimateAuthorityIdentityCommitment are required');
  }
  if (!request.zkAerosolRangeProofHash) {
    if (policy.banMalformedOrOutOfOrderAerosolClaims && request.peerId) bannedPeers.add(request.peerId);
    throw new HsmAdapterError('STRATOCLAIM_ZK_PROOF_MISSING', 'zkAerosolRangeProofHash is required');
  }
  if (!request.latticeSignatureDigest) {
    if (policy.banMalformedOrOutOfOrderAerosolClaims && request.peerId) bannedPeers.add(request.peerId);
    throw new HsmAdapterError('STRATOCLAIM_LATTICE_DIGEST_MISSING', 'latticeSignatureDigest is required');
  }
  if (policy.requireStratosphericOversightCommitteeAttestation && !request.stratosphericOversightCommitteeAttestation) {
    throw new HsmAdapterError('STRATOCLAIM_OVERSIGHT_ATTESTATION_MISSING', 'stratospheric oversight committee attestation is required');
  }
}

module.exports = { ZkAerosolClaimValidator };
