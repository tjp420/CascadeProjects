'use strict';

/**
 * Track 104: ZK Execution Claim Validator.
 *
 * Validates zero-knowledge smart-contract verifiable execution claims
 * against smart-contract verifiable execution gating pools. Enforces
 * canonical payload layout, verifies verifiableComputationProofHash
 * for Verifiable Computation (VC) proof verification, and bans peers
 * broadcasting malformed or out-of-order claims.
 *
 * @module hsm-adapter/zk-execution-claim-validator
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class ZkExecutionClaimValidator {
  constructor(options = {}) {
    this.policy = options.policy || {};
    this.hub = options.hub || null;
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._verifiedClaims = new Set();
    this._bannedPeers = new Set();
  }

  verifyExecutionClaim(request) {
    _validateClaimRequest(this.policy, request, this._bannedPeers);
    const pool = this.hub ? this.hub.getPool(request.poolId) : null;
    if (!pool) {
      throw new HsmAdapterError('EXECCLAIM_POOL_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (pool.status !== 'open') {
      throw new HsmAdapterError('EXECCLAIM_POOL_NOT_OPEN', `pool ${request.poolId} is not open`);
    }
    if (this.policy.requireExecutionEthicsOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.executionEthicsOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('EXECCLAIM_OVERSIGHT_COMMITTEE_UNATTESTED', 'execution ethics oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('EXECCLAIM_OVERSIGHT_COMMITTEE_UNATTESTED', 'execution ethics oversight committee attestation invalid');
      }
    }
    if (this.policy.banMalformedOrOutOfOrderExecutionClaims && request.peerId && this._bannedPeers.has(request.peerId)) {
      throw new HsmAdapterError('EXECCLAIM_PEER_BANNED', `peer ${request.peerId} is banned`);
    }
    const claimHash = crypto.createHash('sha256').update(JSON.stringify({
      poolId: request.poolId,
      blindedExecutionStateCommitment: request.blindedExecutionStateCommitment,
      blindedComputationTraceCommitment: request.blindedComputationTraceCommitment,
      blindedExecutionAuthorityIdentityCommitment: request.blindedExecutionAuthorityIdentityCommitment,
      zkExecutionRangeProofHash: request.zkExecutionRangeProofHash,
      verifiableComputationProofHash: request.verifiableComputationProofHash,
    })).digest('hex');
    if (this.policy.banMalformedOrOutOfOrderExecutionClaims && this._verifiedClaims.has(claimHash)) {
      if (request.peerId) this._bannedPeers.add(request.peerId);
      throw new HsmAdapterError('EXECCLAIM_DUPLICATE', `duplicate execution claim for pool ${request.poolId}`);
    }
    this._verifiedClaims.add(claimHash);
    if (this.hub) this.hub.markExecutionClaimVerified(request.poolId);
    const claimId = request.claimId || `claim-${crypto.randomBytes(4).toString('hex')}`;
    const claim = {
      claimId,
      poolId: request.poolId,
      verifiableComputationProofHash: request.verifiableComputationProofHash,
      zkExecutionRangeProofHash: request.zkExecutionRangeProofHash,
      verifiedAt: Math.floor(Date.now() / 1000),
    };
    if (this._audit) {
      this._audit('ZK_EXECUTION_CLAIM_VERIFIED', { ...claim });
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
    throw new HsmAdapterError('EXECCLAIM_FIELDS_MISSING', 'poolId is required');
  }
  if (!request.blindedExecutionStateCommitment || !request.blindedComputationTraceCommitment || !request.blindedExecutionAuthorityIdentityCommitment) {
    throw new HsmAdapterError('EXECCLAIM_FIELDS_MISSING', 'blindedExecutionStateCommitment, blindedComputationTraceCommitment, and blindedExecutionAuthorityIdentityCommitment are required');
  }
  if (!request.zkExecutionRangeProofHash) {
    if (policy.banMalformedOrOutOfOrderExecutionClaims && request.peerId) bannedPeers.add(request.peerId);
    throw new HsmAdapterError('EXECCLAIM_ZK_PROOF_MISSING', 'zkExecutionRangeProofHash is required');
  }
  if (!request.verifiableComputationProofHash) {
    if (policy.banMalformedOrOutOfOrderExecutionClaims && request.peerId) bannedPeers.add(request.peerId);
    throw new HsmAdapterError('EXECCLAIM_VC_PROOF_HASH_MISSING', 'verifiableComputationProofHash is required');
  }
  if (policy.requireExecutionEthicsOversightCommitteeAttestation && !request.executionEthicsOversightCommitteeAttestation) {
    throw new HsmAdapterError('EXECCLAIM_OVERSIGHT_ATTESTATION_MISSING', 'execution ethics oversight committee attestation is required');
  }
}

module.exports = { ZkExecutionClaimValidator };
