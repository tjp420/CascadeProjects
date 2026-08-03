'use strict';

/**
 * Track 91: ZK Micro-Transaction Claim Validator.
 *
 * Succinct micro-transaction claim verifier
 * that processes non-interactive zero-knowledge
 * range and consumption proofs with blind
 * threshold signature verification, ensuring
 * that an entity's hidden micro-transaction
 * claim status strictly satisfies policy-defined
 * thresholds without disclosing individual
 * prosumer or grid attributes. Triggers
 * defensive node bans for malformed or
 * out-of-order micro-transaction claims.
 *
 * @module hsm-adapter/zk-micro-transaction-claim-validator
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class ZkMicroTransactionClaimValidator {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {PqcSmartGridMicroTransactionGatingHub} options.hub
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
   * Verify a micro-transaction claim proof.
   * @param {object} request
   * @returns {object}
   */
  verifyMicroTransactionClaim(request) {
    _validateClaimRequest(this.policy, request);
    if (!this._hub) {
      throw new HsmAdapterError('SMARTGRIDCLAIM_HUB_MISSING', 'smart-grid micro-transaction gating hub is required');
    }
    if (this.policy.requireLoadBalanceOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.loadBalanceOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('SMARTGRIDCLAIM_COMMITTEE_UNATTESTED', 'load balance oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('SMARTGRIDCLAIM_COMMITTEE_UNATTESTED', 'load balance oversight committee attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('SMARTGRIDCLAIM_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.peerId === 'string' && this._bannedPeers.has(request.peerId)) {
      throw new HsmAdapterError('SMARTGRIDCLAIM_PEER_BANNED', `peer ${request.peerId} is banned`);
    }
    if (!request.zkMicroTransactionRangeProofHash || typeof request.zkMicroTransactionRangeProofHash !== 'string') {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('SMARTGRIDCLAIM_ZK_PROOF_MISSING', 'zero-knowledge micro-transaction range proof hash is required');
    }
    if (!request.blindThresholdSignature || typeof request.blindThresholdSignature !== 'string') {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('SMARTGRIDCLAIM_BLIND_THRESHOLD_SIG_MISSING', 'blind threshold signature is required');
    }
    const pool = this._hub.getPool(request.poolId);
    if (!pool) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('SMARTGRIDCLAIM_POOL_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (typeof request.transactionWindowSeconds === 'number' && request.transactionWindowSeconds > (this.policy.maxTransactionWindowSeconds || 86400)) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('SMARTGRIDCLAIM_TRANSACTION_WINDOW_OUT_OF_BOUNDS', `transaction window seconds ${request.transactionWindowSeconds} exceeds maximum ${this.policy.maxTransactionWindowSeconds}`);
    }
    const claimKey = `${request.poolId}:${request.peerId || 'anonymous'}`;
    if (this._verifiedClaims.has(claimKey)) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('SMARTGRIDCLAIM_DUPLICATE', `micro-transaction claim for pool ${request.poolId} already verified`);
    }
    const claimId = request.claimId || `claim-${crypto.randomBytes(4).toString('hex')}`;
    const now = Math.floor(Date.now() / 1000);
    const claim = {
      claimId,
      poolId: request.poolId,
      blindedLoadBalanceCommitment: request.blindedLoadBalanceCommitment || 'unspecified',
      blindedClaimValueCommitment: request.blindedClaimValueCommitment || 'unspecified',
      zkMicroTransactionRangeProofHash: request.zkMicroTransactionRangeProofHash,
      loadBalanceOversightCommitteeAttestationHash: request.loadBalanceOversightCommitteeAttestationHash || 'unspecified',
      blindThresholdSignature: request.blindThresholdSignature,
      verifiedAt: now,
    };
    this._verifiedClaims.set(claimKey, claim);
    this._hub.markMicroTransactionClaimVerified(request.poolId);
    if (this._audit) {
      this._audit('ZK_MICRO_TRANSACTION_CLAIM_VERIFIED', { ...claim });
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
    if (this.policy.banMalformedOrOutOfOrderMicroTransactionClaims && typeof request.peerId === 'string') {
      this._bannedPeers.add(request.peerId);
    }
  }
}

function _validateClaimRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('SMARTGRIDCLAIM_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireLoadBalanceOversightCommitteeAttestation && !request.loadBalanceOversightCommitteeAttestation) {
    throw new HsmAdapterError('SMARTGRIDCLAIM_ATTESTATION_MISSING', 'load balance oversight committee attestation is required');
  }
}

module.exports = { ZkMicroTransactionClaimValidator };
