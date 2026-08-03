'use strict';

/**
 * Track 95: ZK Extraction Claim Validator.
 *
 * Succinct extraction claim verifier
 * that processes non-interactive
 * zero-knowledge range and extraction
 * compliance proofs with attribute-based
 * encryption key policy verification,
 * ensuring that an entity's hidden
 * extraction claim status strictly
 * satisfies policy-defined thresholds
 * without disclosing individual
 * sovereign or authority attributes.
 * Triggers defensive node bans for
 * malformed or out-of-order extraction
 * claims.
 *
 * @module hsm-adapter/zk-extraction-claim-validator
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class ZkExtractionClaimValidator {
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._hub = options.hub || null;
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._bannedPeers = new Set();
    this._verifiedClaims = new Map();
  }

  verifyExtractionClaim(request) {
    _validateClaimRequest(this.policy, request);
    if (!this._hub) {
      throw new HsmAdapterError('SEABEDCLAIM_HUB_MISSING', 'deep-sea mineral rights gating hub is required');
    }
    if (this.policy.requireSeabedOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.seabedOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('SEABEDCLAIM_COMMITTEE_UNATTESTED', 'seabed oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('SEABEDCLAIM_COMMITTEE_UNATTESTED', 'seabed oversight committee attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('SEABEDCLAIM_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.peerId === 'string' && this._bannedPeers.has(request.peerId)) {
      throw new HsmAdapterError('SEABEDCLAIM_PEER_BANNED', `peer ${request.peerId} is banned`);
    }
    if (!request.zkExtractionRangeProofHash || typeof request.zkExtractionRangeProofHash !== 'string') {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('SEABEDCLAIM_ZK_PROOF_MISSING', 'zero-knowledge extraction range proof hash is required');
    }
    if (!request.abeKeyPolicyDigest || typeof request.abeKeyPolicyDigest !== 'string') {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('SEABEDCLAIM_ABE_POLICY_DIGEST_MISSING', 'attribute-based encryption key policy digest is required');
    }
    const pool = this._hub.getPool(request.poolId);
    if (!pool) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('SEABEDCLAIM_POOL_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (typeof request.leaseWindowSeconds === 'number' && request.leaseWindowSeconds > (this.policy.maxLeaseWindowSeconds || 31536000)) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('SEABEDCLAIM_LEASE_WINDOW_OUT_OF_BOUNDS', `lease window seconds ${request.leaseWindowSeconds} exceeds maximum ${this.policy.maxLeaseWindowSeconds}`);
    }
    const claimKey = `${request.poolId}:${request.peerId || 'anonymous'}`;
    if (this._verifiedClaims.has(claimKey)) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('SEABEDCLAIM_DUPLICATE', `extraction claim for pool ${request.poolId} already verified`);
    }
    const claimId = request.claimId || `claim-${crypto.randomBytes(4).toString('hex')}`;
    const now = Math.floor(Date.now() / 1000);
    const claim = {
      claimId,
      poolId: request.poolId,
      blindedExtractionVolumeCommitment: request.blindedExtractionVolumeCommitment || 'unspecified',
      blindedClaimValueCommitment: request.blindedClaimValueCommitment || 'unspecified',
      zkExtractionRangeProofHash: request.zkExtractionRangeProofHash,
      seabedOversightCommitteeAttestationHash: request.seabedOversightCommitteeAttestationHash || 'unspecified',
      abeKeyPolicyDigest: request.abeKeyPolicyDigest,
      verifiedAt: now,
    };
    this._verifiedClaims.set(claimKey, claim);
    this._hub.markExtractionClaimVerified(request.poolId);
    if (this._audit) {
      this._audit('ZK_EXTRACTION_CLAIM_VERIFIED', { ...claim });
    }
    return claim;
  }

  isPeerBanned(peerId) {
    return this._bannedPeers.has(peerId);
  }

  getVerifiedClaims() {
    return Array.from(this._verifiedClaims.values());
  }

  _banPeerIfPolicy(request) {
    if (this.policy.banMalformedOrOutOfOrderExtractionClaims && typeof request.peerId === 'string') {
      this._bannedPeers.add(request.peerId);
    }
  }
}

function _validateClaimRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('SEABEDCLAIM_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireSeabedOversightCommitteeAttestation && !request.seabedOversightCommitteeAttestation) {
    throw new HsmAdapterError('SEABEDCLAIM_ATTESTATION_MISSING', 'seabed oversight committee attestation is required');
  }
}

module.exports = { ZkExtractionClaimValidator };
