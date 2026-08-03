'use strict';

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class ZkIdentityClaimValidator {
  constructor(options = {}) {
    this.policy = options.policy || {};
    this.hub = options.hub || null;
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._verifiedClaims = new Set();
    this._bannedPeers = new Set();
  }

  verifyIdentityClaim(request) {
    _validateClaimRequest(this.policy, request, this._bannedPeers);
    const pool = this.hub ? this.hub.getPool(request.poolId) : null;
    if (!pool) {
      throw new HsmAdapterError('DIDCLAIM_POOL_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (pool.status !== 'open') {
      throw new HsmAdapterError('DIDCLAIM_POOL_NOT_OPEN', `pool ${request.poolId} is not open`);
    }
    if (this.policy.requireIdentityEthicsOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.identityEthicsOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('DIDCLAIM_OVERSIGHT_COMMITTEE_UNATTESTED', 'identity ethics oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('DIDCLAIM_OVERSIGHT_COMMITTEE_UNATTESTED', 'identity ethics oversight committee attestation invalid');
      }
    }
    if (this.policy.banMalformedOrOutOfOrderIdentityClaims && request.peerId && this._bannedPeers.has(request.peerId)) {
      throw new HsmAdapterError('DIDCLAIM_PEER_BANNED', `peer ${request.peerId} is banned`);
    }
    const claimHash = crypto.createHash('sha256').update(JSON.stringify({
      poolId: request.poolId,
      blindedIdentityAccumulatorDigestCommitment: request.blindedIdentityAccumulatorDigestCommitment,
      blindedMembershipWitnessCommitment: request.blindedMembershipWitnessCommitment,
      blindedIdentityAuthorityIdentityCommitment: request.blindedIdentityAuthorityIdentityCommitment,
      zkIdentityRangeProofHash: request.zkIdentityRangeProofHash,
      zeroKnowledgeAccumulatorDigest: request.zeroKnowledgeAccumulatorDigest,
    })).digest('hex');
    if (this.policy.banMalformedOrOutOfOrderIdentityClaims && this._verifiedClaims.has(claimHash)) {
      if (request.peerId) this._bannedPeers.add(request.peerId);
      throw new HsmAdapterError('DIDCLAIM_DUPLICATE', `duplicate identity claim for pool ${request.poolId}`);
    }
    this._verifiedClaims.add(claimHash);
    if (this.hub) this.hub.markIdentityClaimVerified(request.poolId);
    const claimId = request.claimId || `claim-${crypto.randomBytes(4).toString('hex')}`;
    const claim = {
      claimId,
      poolId: request.poolId,
      zeroKnowledgeAccumulatorDigest: request.zeroKnowledgeAccumulatorDigest,
      zkIdentityRangeProofHash: request.zkIdentityRangeProofHash,
      verifiedAt: Math.floor(Date.now() / 1000),
    };
    if (this._audit) {
      this._audit('ZK_IDENTITY_CLAIM_VERIFIED', { ...claim });
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
    throw new HsmAdapterError('DIDCLAIM_FIELDS_MISSING', 'poolId is required');
  }
  if (!request.blindedIdentityAccumulatorDigestCommitment || !request.blindedMembershipWitnessCommitment || !request.blindedIdentityAuthorityIdentityCommitment) {
    throw new HsmAdapterError('DIDCLAIM_FIELDS_MISSING', 'blindedIdentityAccumulatorDigestCommitment, blindedMembershipWitnessCommitment, and blindedIdentityAuthorityIdentityCommitment are required');
  }
  if (!request.zkIdentityRangeProofHash) {
    if (policy.banMalformedOrOutOfOrderIdentityClaims && request.peerId) bannedPeers.add(request.peerId);
    throw new HsmAdapterError('DIDCLAIM_ZK_PROOF_MISSING', 'zkIdentityRangeProofHash is required');
  }
  if (!request.zeroKnowledgeAccumulatorDigest) {
    if (policy.banMalformedOrOutOfOrderIdentityClaims && request.peerId) bannedPeers.add(request.peerId);
    throw new HsmAdapterError('DIDCLAIM_ACCUMULATOR_DIGEST_MISSING', 'zeroKnowledgeAccumulatorDigest is required');
  }
  if (policy.requireIdentityEthicsOversightCommitteeAttestation && !request.identityEthicsOversightCommitteeAttestation) {
    throw new HsmAdapterError('DIDCLAIM_OVERSIGHT_ATTESTATION_MISSING', 'identity ethics oversight committee attestation is required');
  }
}

module.exports = { ZkIdentityClaimValidator };
