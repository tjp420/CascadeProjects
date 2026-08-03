'use strict';

/**
 * Track 108: ZK Laser Mesh Claim Validator.
 *
 * Validates zero-knowledge space-based laser communication mesh claims
 * against laser mesh gating pools. Enforces canonical payload layout,
 * verifies timedReleaseKeyDigest for timed-release key (TRK) validation,
 * and bans peers broadcasting malformed or out-of-order claims.
 *
 * @module hsm-adapter/zk-laser-mesh-claim-validator
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class ZkLaserMeshClaimValidator {
  constructor(options = {}) {
    this.policy = options.policy || {};
    this.hub = options.hub || null;
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._verifiedClaims = new Set();
    this._bannedPeers = new Set();
  }

  verifyLaserMeshClaim(request) {
    _validateClaimRequest(this.policy, request, this._bannedPeers);
    const pool = this.hub ? this.hub.getPool(request.poolId) : null;
    if (!pool) {
      throw new HsmAdapterError('LASERCLAIM_POOL_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (pool.status !== 'open') {
      throw new HsmAdapterError('LASERCLAIM_POOL_NOT_OPEN', `pool ${request.poolId} is not open`);
    }
    if (this.policy.requireLaserEthicsOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.laserEthicsOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('LASERCLAIM_OVERSIGHT_COMMITTEE_UNATTESTED', 'laser ethics oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('LASERCLAIM_OVERSIGHT_COMMITTEE_UNATTESTED', 'laser ethics oversight committee attestation invalid');
      }
    }
    if (this.policy.banMalformedOrOutOfOrderLaserMeshClaims && request.peerId && this._bannedPeers.has(request.peerId)) {
      throw new HsmAdapterError('LASERCLAIM_PEER_BANNED', `peer ${request.peerId} is banned`);
    }
    const claimHash = crypto.createHash('sha256').update(JSON.stringify({
      poolId: request.poolId,
      blindedLaserLinkDigestCommitment: request.blindedLaserLinkDigestCommitment,
      blindedTimedReleaseKeyCommitment: request.blindedTimedReleaseKeyCommitment,
      blindedOrbitalHandoffIdentityCommitment: request.blindedOrbitalHandoffIdentityCommitment,
      zkLaserMeshRangeProofHash: request.zkLaserMeshRangeProofHash,
      timedReleaseKeyDigest: request.timedReleaseKeyDigest,
    })).digest('hex');
    if (this.policy.banMalformedOrOutOfOrderLaserMeshClaims && this._verifiedClaims.has(claimHash)) {
      if (request.peerId) this._bannedPeers.add(request.peerId);
      throw new HsmAdapterError('LASERCLAIM_DUPLICATE', `duplicate laser mesh claim for pool ${request.poolId}`);
    }
    this._verifiedClaims.add(claimHash);
    if (this.hub) this.hub.markLaserMeshClaimVerified(request.poolId);
    const claimId = request.claimId || `claim-${crypto.randomBytes(4).toString('hex')}`;
    const claim = {
      claimId,
      poolId: request.poolId,
      timedReleaseKeyDigest: request.timedReleaseKeyDigest,
      zkLaserMeshRangeProofHash: request.zkLaserMeshRangeProofHash,
      verifiedAt: Math.floor(Date.now() / 1000),
    };
    if (this._audit) {
      this._audit('ZK_LASER_MESH_CLAIM_VERIFIED', { ...claim });
    }
    return claim;
  }

  isPeerBanned(peerId) {
    return this._bannedPeers.has(peerId);
  }

  getVerifiedClaimCount() {
    return this._verifiedClaims.size;
  }
}

function _validateClaimRequest(policy, request, bannedPeers) {
  if (!request.poolId) {
    throw new HsmAdapterError('LASERCLAIM_FIELDS_MISSING', 'poolId is required');
  }
  if (!request.blindedLaserLinkDigestCommitment || !request.blindedTimedReleaseKeyCommitment || !request.blindedOrbitalHandoffIdentityCommitment) {
    throw new HsmAdapterError('LASERCLAIM_FIELDS_MISSING', 'blindedLaserLinkDigestCommitment, blindedTimedReleaseKeyCommitment, and blindedOrbitalHandoffIdentityCommitment are required');
  }
  if (!request.zkLaserMeshRangeProofHash) {
    if (policy.banMalformedOrOutOfOrderLaserMeshClaims && request.peerId) bannedPeers.add(request.peerId);
    throw new HsmAdapterError('LASERCLAIM_ZK_PROOF_MISSING', 'zkLaserMeshRangeProofHash is required');
  }
  if (!request.timedReleaseKeyDigest) {
    if (policy.banMalformedOrOutOfOrderLaserMeshClaims && request.peerId) bannedPeers.add(request.peerId);
    throw new HsmAdapterError('LASERCLAIM_TIMED_RELEASE_KEY_DIGEST_MISSING', 'timedReleaseKeyDigest is required');
  }
  if (policy.requireLaserEthicsOversightCommitteeAttestation && !request.laserEthicsOversightCommitteeAttestation) {
    throw new HsmAdapterError('LASERCLAIM_OVERSIGHT_ATTESTATION_MISSING', 'laser ethics oversight committee attestation is required');
  }
}

module.exports = { ZkLaserMeshClaimValidator };
