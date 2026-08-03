'use strict';

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcDecentralizedIdentityProofGatingHub {
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._pools = new Map();
  }

  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireIdentityAuthorityInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.identityAuthorityInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('DIDGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'identity authority initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('DIDGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'identity authority initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('DIDGATE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('DIDGATE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.revocationWindowSeconds === 'number' && request.revocationWindowSeconds > (this.policy.maxRevocationWindowSeconds || 86400)) {
      throw new HsmAdapterError('DIDGATE_REVOCATION_WINDOW_EXCEEDED', `revocation window seconds ${request.revocationWindowSeconds} exceeds maximum ${this.policy.maxRevocationWindowSeconds}`);
    }
    if (typeof request.identityChainDepth === 'number' && request.identityChainDepth > (this.policy.maxIdentityChainDepth || 32)) {
      throw new HsmAdapterError('DIDGATE_IDENTITY_DEPTH_EXCEEDED', `identity chain depth ${request.identityChainDepth} exceeds maximum ${this.policy.maxIdentityChainDepth}`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('DIDGATE_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedIdentityAccumulatorDigestCommitment: request.blindedIdentityAccumulatorDigestCommitment,
      blindedMembershipWitnessCommitment: request.blindedMembershipWitnessCommitment,
      blindedIdentityAuthorityIdentityCommitment: request.blindedIdentityAuthorityIdentityCommitment,
      revocationWindowSeconds: request.revocationWindowSeconds,
      identityChainDepth: request.identityChainDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      identityClaimVerified: false,
      revocationAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit('IDENTITY_POOL_INITIALIZED', { ...pool });
    }
    return pool;
  }

  getPool(poolId) {
    return this._pools.get(poolId) || null;
  }

  markIdentityClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('DIDGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    pool.identityClaimVerified = true;
    return pool;
  }

  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('DIDGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.identityClaimVerified) {
      throw new HsmAdapterError('DIDGATE_IDENTITY_CLAIM_NOT_VERIFIED', `pool ${request.poolId} identity claim not verified`);
    }
    if (this.policy.requireIdentityEthicsOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.identityEthicsOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('DIDGATE_OVERSIGHT_COMMITTEE_UNATTESTED', 'identity ethics oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('DIDGATE_OVERSIGHT_COMMITTEE_UNATTESTED', 'identity ethics oversight committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minIdentityQuorum || 12)) {
      throw new HsmAdapterError('DIDGATE_QUORUM_INSUFFICIENT', `identity quorum signatures ${signatures.length} below minimum ${this.policy.minIdentityQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = 'accredited';
    pool.revocationAccreditationCompletedAt = now;
    const completionId = request.completionId || `completion-${crypto.randomBytes(4).toString('hex')}`;
    const completion = {
      completionId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      completedAt: now,
    };
    if (this._audit) {
      this._audit('REVOCATION_ACCREDITATION_COMPLETED', { ...completion });
    }
    return completion;
  }

  getPoolCount() {
    return this._pools.size;
  }
}

function _validateInitRequest(policy, request) {
  if (!request.sourceTenantId || !request.targetChainId) {
    throw new HsmAdapterError('DIDGATE_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedIdentityAccumulatorDigestCommitment || !request.blindedMembershipWitnessCommitment || !request.blindedIdentityAuthorityIdentityCommitment) {
    throw new HsmAdapterError('DIDGATE_FIELDS_MISSING', 'blindedIdentityAccumulatorDigestCommitment, blindedMembershipWitnessCommitment, and blindedIdentityAuthorityIdentityCommitment are required');
  }
  if (typeof request.revocationWindowSeconds !== 'number') {
    throw new HsmAdapterError('DIDGATE_FIELDS_MISSING', 'revocationWindowSeconds is required');
  }
  if (typeof request.identityChainDepth !== 'number') {
    throw new HsmAdapterError('DIDGATE_FIELDS_MISSING', 'identityChainDepth is required');
  }
  if (policy.requireIdentityAuthorityInitializerAttestation && !request.identityAuthorityInitializerAttestation) {
    throw new HsmAdapterError('DIDGATE_AUTHORITY_ATTESTATION_MISSING', 'identity authority initializer attestation is required');
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('DIDGATE_COMPLETE_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireIdentityEthicsOversightCommitteeAttestation && !request.identityEthicsOversightCommitteeAttestation) {
    throw new HsmAdapterError('DIDGATE_OVERSIGHT_ATTESTATION_MISSING', 'identity ethics oversight committee attestation is required');
  }
}

module.exports = { PqcDecentralizedIdentityProofGatingHub };
