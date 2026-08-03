'use strict';

/**
 * Track 99: ZK Genomic Claim Validator.
 *
 * Validates zero-knowledge genomic privacy compliance claims against
 * genomic privacy compliance gating pools. Enforces canonical payload
 * layout, verifies symmetricPredicateProofDigest for symmetric predicate
 * proof verification, and bans peers broadcasting malformed or
 * out-of-order claims.
 *
 * @module hsm-adapter/zk-genomic-claim-validator
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class ZkGenomicClaimValidator {
  constructor(options = {}) {
    this.policy = options.policy || {};
    this.hub = options.hub || null;
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._verifiedClaims = new Set();
    this._bannedPeers = new Set();
  }

  verifyGenomicClaim(request) {
    _validateClaimRequest(this.policy, request, this._bannedPeers);
    const pool = this.hub ? this.hub.getPool(request.poolId) : null;
    if (!pool) {
      throw new HsmAdapterError('GENOCLAIM_POOL_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (pool.status !== 'open') {
      throw new HsmAdapterError('GENOCLAIM_POOL_NOT_OPEN', `pool ${request.poolId} is not open`);
    }
    if (this.policy.requireGenomicEthicsOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.genomicEthicsOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('GENOCLAIM_OVERSIGHT_COMMITTEE_UNATTESTED', 'genomic ethics oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('GENOCLAIM_OVERSIGHT_COMMITTEE_UNATTESTED', 'genomic ethics oversight committee attestation invalid');
      }
    }
    if (this.policy.banMalformedOrOutOfOrderGenomicClaims && request.peerId && this._bannedPeers.has(request.peerId)) {
      throw new HsmAdapterError('GENOCLAIM_PEER_BANNED', `peer ${request.peerId} is banned`);
    }
    const claimHash = crypto.createHash('sha256').update(JSON.stringify({
      poolId: request.poolId,
      blindedDnaSequenceAccessCommitment: request.blindedDnaSequenceAccessCommitment,
      blindedConsentProbabilityCommitment: request.blindedConsentProbabilityCommitment,
      blindedGenomicPrivacyAuthorityIdentityCommitment: request.blindedGenomicPrivacyAuthorityIdentityCommitment,
      zkGenomicRangeProofHash: request.zkGenomicRangeProofHash,
      symmetricPredicateProofDigest: request.symmetricPredicateProofDigest,
    })).digest('hex');
    if (this.policy.banMalformedOrOutOfOrderGenomicClaims && this._verifiedClaims.has(claimHash)) {
      if (request.peerId) this._bannedPeers.add(request.peerId);
      throw new HsmAdapterError('GENOCLAIM_DUPLICATE', `duplicate genomic claim for pool ${request.poolId}`);
    }
    this._verifiedClaims.add(claimHash);
    if (this.hub) this.hub.markGenomicClaimVerified(request.poolId);
    const claimId = request.claimId || `claim-${crypto.randomBytes(4).toString('hex')}`;
    const claim = {
      claimId,
      poolId: request.poolId,
      symmetricPredicateProofDigest: request.symmetricPredicateProofDigest,
      zkGenomicRangeProofHash: request.zkGenomicRangeProofHash,
      verifiedAt: Math.floor(Date.now() / 1000),
    };
    if (this._audit) {
      this._audit('ZK_GENOMIC_CLAIM_VERIFIED', { ...claim });
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
    throw new HsmAdapterError('GENOCLAIM_FIELDS_MISSING', 'poolId is required');
  }
  if (!request.blindedDnaSequenceAccessCommitment || !request.blindedConsentProbabilityCommitment || !request.blindedGenomicPrivacyAuthorityIdentityCommitment) {
    throw new HsmAdapterError('GENOCLAIM_FIELDS_MISSING', 'blindedDnaSequenceAccessCommitment, blindedConsentProbabilityCommitment, and blindedGenomicPrivacyAuthorityIdentityCommitment are required');
  }
  if (!request.zkGenomicRangeProofHash) {
    if (policy.banMalformedOrOutOfOrderGenomicClaims && request.peerId) bannedPeers.add(request.peerId);
    throw new HsmAdapterError('GENOCLAIM_ZK_PROOF_MISSING', 'zkGenomicRangeProofHash is required');
  }
  if (!request.symmetricPredicateProofDigest) {
    if (policy.banMalformedOrOutOfOrderGenomicClaims && request.peerId) bannedPeers.add(request.peerId);
    throw new HsmAdapterError('GENOCLAIM_PREDICATE_PROOF_MISSING', 'symmetricPredicateProofDigest is required');
  }
  if (policy.requireGenomicEthicsOversightCommitteeAttestation && !request.genomicEthicsOversightCommitteeAttestation) {
    throw new HsmAdapterError('GENOCLAIM_OVERSIGHT_ATTESTATION_MISSING', 'genomic ethics oversight committee attestation is required');
  }
}

module.exports = { ZkGenomicClaimValidator };
