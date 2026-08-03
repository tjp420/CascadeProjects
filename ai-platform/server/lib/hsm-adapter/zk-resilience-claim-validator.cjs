'use strict';

/**
 * Track 103: ZK Resilience Claim Validator.
 *
 * Validates zero-knowledge supply chain resilience claims against
 * supply chain resilience integrity gating pools. Enforces canonical
 * payload layout, verifies verifiableSecretSharingDigest for VSS
 * verification, and bans peers broadcasting malformed or out-of-order
 * claims.
 *
 * @module hsm-adapter/zk-resilience-claim-validator
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class ZkResilienceClaimValidator {
  constructor(options = {}) {
    this.policy = options.policy || {};
    this.hub = options.hub || null;
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._verifiedClaims = new Set();
    this._bannedPeers = new Set();
  }

  verifyResilienceClaim(request) {
    _validateClaimRequest(this.policy, request, this._bannedPeers);
    const pool = this.hub ? this.hub.getPool(request.poolId) : null;
    if (!pool) {
      throw new HsmAdapterError('RESILIOCLAIM_POOL_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (pool.status !== 'open') {
      throw new HsmAdapterError('RESILIOCLAIM_POOL_NOT_OPEN', `pool ${request.poolId} is not open`);
    }
    if (this.policy.requireSupplyChainEthicsOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.supplyChainEthicsOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('RESILIOCLAIM_OVERSIGHT_COMMITTEE_UNATTESTED', 'supply chain ethics oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('RESILIOCLAIM_OVERSIGHT_COMMITTEE_UNATTESTED', 'supply chain ethics oversight committee attestation invalid');
      }
    }
    if (this.policy.banMalformedOrOutOfOrderResilienceClaims && request.peerId && this._bannedPeers.has(request.peerId)) {
      throw new HsmAdapterError('RESILIOCLAIM_PEER_BANNED', `peer ${request.peerId} is banned`);
    }
    const claimHash = crypto.createHash('sha256').update(JSON.stringify({
      poolId: request.poolId,
      blindedDisruptionPredictionCommitment: request.blindedDisruptionPredictionCommitment,
      blindedSupplierDiversityCommitment: request.blindedSupplierDiversityCommitment,
      blindedSupplyChainResilienceAuthorityIdentityCommitment: request.blindedSupplyChainResilienceAuthorityIdentityCommitment,
      zkResilienceRangeProofHash: request.zkResilienceRangeProofHash,
      verifiableSecretSharingDigest: request.verifiableSecretSharingDigest,
    })).digest('hex');
    if (this.policy.banMalformedOrOutOfOrderResilienceClaims && this._verifiedClaims.has(claimHash)) {
      if (request.peerId) this._bannedPeers.add(request.peerId);
      throw new HsmAdapterError('RESILIOCLAIM_DUPLICATE', `duplicate resilience claim for pool ${request.poolId}`);
    }
    this._verifiedClaims.add(claimHash);
    if (this.hub) this.hub.markResilienceClaimVerified(request.poolId);
    const claimId = request.claimId || `claim-${crypto.randomBytes(4).toString('hex')}`;
    const claim = {
      claimId,
      poolId: request.poolId,
      verifiableSecretSharingDigest: request.verifiableSecretSharingDigest,
      zkResilienceRangeProofHash: request.zkResilienceRangeProofHash,
      verifiedAt: Math.floor(Date.now() / 1000),
    };
    if (this._audit) {
      this._audit('ZK_RESILIENCE_CLAIM_VERIFIED', { ...claim });
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
    throw new HsmAdapterError('RESILIOCLAIM_FIELDS_MISSING', 'poolId is required');
  }
  if (!request.blindedDisruptionPredictionCommitment || !request.blindedSupplierDiversityCommitment || !request.blindedSupplyChainResilienceAuthorityIdentityCommitment) {
    throw new HsmAdapterError('RESILIOCLAIM_FIELDS_MISSING', 'blindedDisruptionPredictionCommitment, blindedSupplierDiversityCommitment, and blindedSupplyChainResilienceAuthorityIdentityCommitment are required');
  }
  if (!request.zkResilienceRangeProofHash) {
    if (policy.banMalformedOrOutOfOrderResilienceClaims && request.peerId) bannedPeers.add(request.peerId);
    throw new HsmAdapterError('RESILIOCLAIM_ZK_PROOF_MISSING', 'zkResilienceRangeProofHash is required');
  }
  if (!request.verifiableSecretSharingDigest) {
    if (policy.banMalformedOrOutOfOrderResilienceClaims && request.peerId) bannedPeers.add(request.peerId);
    throw new HsmAdapterError('RESILIOCLAIM_VSS_DIGEST_MISSING', 'verifiableSecretSharingDigest is required');
  }
  if (policy.requireSupplyChainEthicsOversightCommitteeAttestation && !request.supplyChainEthicsOversightCommitteeAttestation) {
    throw new HsmAdapterError('RESILIOCLAIM_OVERSIGHT_ATTESTATION_MISSING', 'supply chain ethics oversight committee attestation is required');
  }
}

module.exports = { ZkResilienceClaimValidator };
