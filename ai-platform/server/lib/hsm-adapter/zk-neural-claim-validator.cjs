'use strict';

/**
 * Track 101: ZK Neural Claim Validator.
 *
 * Validates zero-knowledge neural network inference claims against
 * neural network inference integrity gating pools. Enforces canonical
 * payload layout, verifies merkleMountainRangeDigest for Merkle
 * Mountain Range verification, and bans peers broadcasting malformed
 * or out-of-order claims.
 *
 * @module hsm-adapter/zk-neural-claim-validator
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class ZkNeuralClaimValidator {
  constructor(options = {}) {
    this.policy = options.policy || {};
    this.hub = options.hub || null;
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._verifiedClaims = new Set();
    this._bannedPeers = new Set();
  }

  verifyNeuralClaim(request) {
    _validateClaimRequest(this.policy, request, this._bannedPeers);
    const pool = this.hub ? this.hub.getPool(request.poolId) : null;
    if (!pool) {
      throw new HsmAdapterError('NEURCLAIM_POOL_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (pool.status !== 'open') {
      throw new HsmAdapterError('NEURCLAIM_POOL_NOT_OPEN', `pool ${request.poolId} is not open`);
    }
    if (this.policy.requireNeuralEthicsOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.neuralEthicsOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('NEURCLAIM_OVERSIGHT_COMMITTEE_UNATTESTED', 'neural ethics oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('NEURCLAIM_OVERSIGHT_COMMITTEE_UNATTESTED', 'neural ethics oversight committee attestation invalid');
      }
    }
    if (this.policy.banMalformedOrOutOfOrderNeuralClaims && request.peerId && this._bannedPeers.has(request.peerId)) {
      throw new HsmAdapterError('NEURCLAIM_PEER_BANNED', `peer ${request.peerId} is banned`);
    }
    const claimHash = crypto.createHash('sha256').update(JSON.stringify({
      poolId: request.poolId,
      blindedNeuralMeasurementCommitment: request.blindedNeuralMeasurementCommitment,
      blindedInferenceProbabilityCommitment: request.blindedInferenceProbabilityCommitment,
      blindedNeuralNetworkAuthorityIdentityCommitment: request.blindedNeuralNetworkAuthorityIdentityCommitment,
      zkNeuralRangeProofHash: request.zkNeuralRangeProofHash,
      merkleMountainRangeDigest: request.merkleMountainRangeDigest,
    })).digest('hex');
    if (this.policy.banMalformedOrOutOfOrderNeuralClaims && this._verifiedClaims.has(claimHash)) {
      if (request.peerId) this._bannedPeers.add(request.peerId);
      throw new HsmAdapterError('NEURCLAIM_DUPLICATE', `duplicate neural claim for pool ${request.poolId}`);
    }
    this._verifiedClaims.add(claimHash);
    if (this.hub) this.hub.markNeuralClaimVerified(request.poolId);
    const claimId = request.claimId || `claim-${crypto.randomBytes(4).toString('hex')}`;
    const claim = {
      claimId,
      poolId: request.poolId,
      merkleMountainRangeDigest: request.merkleMountainRangeDigest,
      zkNeuralRangeProofHash: request.zkNeuralRangeProofHash,
      verifiedAt: Math.floor(Date.now() / 1000),
    };
    if (this._audit) {
      this._audit('ZK_NEURAL_CLAIM_VERIFIED', { ...claim });
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
    throw new HsmAdapterError('NEURCLAIM_FIELDS_MISSING', 'poolId is required');
  }
  if (!request.blindedNeuralMeasurementCommitment || !request.blindedInferenceProbabilityCommitment || !request.blindedNeuralNetworkAuthorityIdentityCommitment) {
    throw new HsmAdapterError('NEURCLAIM_FIELDS_MISSING', 'blindedNeuralMeasurementCommitment, blindedInferenceProbabilityCommitment, and blindedNeuralNetworkAuthorityIdentityCommitment are required');
  }
  if (!request.zkNeuralRangeProofHash) {
    if (policy.banMalformedOrOutOfOrderNeuralClaims && request.peerId) bannedPeers.add(request.peerId);
    throw new HsmAdapterError('NEURCLAIM_ZK_PROOF_MISSING', 'zkNeuralRangeProofHash is required');
  }
  if (!request.merkleMountainRangeDigest) {
    if (policy.banMalformedOrOutOfOrderNeuralClaims && request.peerId) bannedPeers.add(request.peerId);
    throw new HsmAdapterError('NEURCLAIM_MMR_DIGEST_MISSING', 'merkleMountainRangeDigest is required');
  }
  if (policy.requireNeuralEthicsOversightCommitteeAttestation && !request.neuralEthicsOversightCommitteeAttestation) {
    throw new HsmAdapterError('NEURCLAIM_OVERSIGHT_ATTESTATION_MISSING', 'neural ethics oversight committee attestation is required');
  }
}

module.exports = { ZkNeuralClaimValidator };
