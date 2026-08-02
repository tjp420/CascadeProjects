'use strict';

/**
 * Track 69: PQC Real Estate Tokenization Hub.
 *
 * Interlocking title deed coordinator that instantiates
 * multi-party asset pools using homomorphically split
 * Pedersen commitments over real-estate values,
 * encumbrance balances, and fractional share allocations.
 * Parses REPOOL packets, enforces maxAssetValuationCap, and
 * tracks state transitions alongside the minCoSignerQuorum
 * boundary.
 *
 * @module hsm-adapter/pqc-real-estate-tokenization-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcRealEstateTokenizationHub {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {EnclaveAttestationClient} [options.attestationClient]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._pools = new Map();
  }

  /**
   * Initialize a real-estate tokenization pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireAssetInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.assetInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('REPOOL_ASSET_INITIALIZER_UNATTESTED', 'asset initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('REPOOL_ASSET_INITIALIZER_UNATTESTED', 'asset initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('REPOOL_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('REPOOL_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.legalDisputeSeconds === 'number' && request.legalDisputeSeconds > (this.policy.maxLegalDisputeSeconds || 2592000)) {
      throw new HsmAdapterError('REPOOL_LEGAL_DISPUTE_WINDOW_EXCEEDED', `legal dispute seconds ${request.legalDisputeSeconds} exceeds maximum ${this.policy.maxLegalDisputeSeconds}`);
    }
    if (typeof request.assetValuationCap === 'number' && request.assetValuationCap > (this.policy.maxAssetValuationCap || 1000000000)) {
      throw new HsmAdapterError('REPOOL_ASSET_VALUATION_CAP_EXCEEDED', `asset valuation cap ${request.assetValuationCap} exceeds maximum ${this.policy.maxAssetValuationCap}`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('REPOOL_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedRealEstateValueCommitment: request.blindedRealEstateValueCommitment,
      blindedEncumbranceBalanceCommitment: request.blindedEncumbranceBalanceCommitment,
      blindedFractionalShareCommitment: request.blindedFractionalShareCommitment,
      legalDisputeSeconds: request.legalDisputeSeconds,
      assetValuationCap: request.assetValuationCap || 0,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      encumbranceClearanceVerified: false,
      transferFinalizedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit('REAL_ESTATE_POOL_INITIALIZED', { ...pool });
    }
    return pool;
  }

  /**
   * Get a pool by id.
   * @param {string} poolId
   * @returns {object|null}
   */
  getPool(poolId) {
    return this._pools.get(poolId) || null;
  }

  /**
   * Mark a pool as encumbrance-clearance-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markEncumbranceClearanceVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('REPOOL_NOT_FOUND', `pool ${poolId} not found`);
    }
    pool.encumbranceClearanceVerified = true;
    return pool;
  }

  /**
   * Finalize a title deed transfer after quorum.
   * @param {object} request
   * @returns {object}
   */
  finalizeTitleDeedTransfer(request) {
    _validateTransferRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('REPOOL_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.encumbranceClearanceVerified) {
      throw new HsmAdapterError('REPOOL_ENCUMBRANCE_NOT_VERIFIED', `pool ${request.poolId} encumbrance clearance not verified`);
    }
    if (this.policy.requireClearingCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.clearingCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('REPOOL_CLEARING_COMMITTEE_UNATTESTED', 'clearing committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('REPOOL_CLEARING_COMMITTEE_UNATTESTED', 'clearing committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minCoSignerQuorum || 3)) {
      throw new HsmAdapterError('REPOOL_TRANSFER_QUORUM_INSUFFICIENT', `co-signer signatures ${signatures.length} below minimum ${this.policy.minCoSignerQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = 'finalized';
    pool.transferFinalizedAt = now;
    const transferId = request.transferId || `transfer-${crypto.randomBytes(4).toString('hex')}`;
    const transfer = {
      transferId,
      poolId: request.poolId,
      coSignerSignatureCount: signatures.length,
      finalizedAt: now,
    };
    if (this._audit) {
      this._audit('TITLE_DEED_TRANSFER_FINALIZED', { ...transfer });
    }
    return transfer;
  }

  /**
   * Get the current pool count.
   * @returns {number}
   */
  getPoolCount() {
    return this._pools.size;
  }
}

function _validateInitRequest(policy, request) {
  if (!request.sourceTenantId || !request.targetChainId) {
    throw new HsmAdapterError('REPOOL_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedRealEstateValueCommitment || !request.blindedEncumbranceBalanceCommitment || !request.blindedFractionalShareCommitment) {
    throw new HsmAdapterError('REPOOL_FIELDS_MISSING', 'blindedRealEstateValueCommitment, blindedEncumbranceBalanceCommitment, and blindedFractionalShareCommitment are required');
  }
  if (typeof request.legalDisputeSeconds !== 'number') {
    throw new HsmAdapterError('REPOOL_FIELDS_MISSING', 'legalDisputeSeconds is required');
  }
  if (policy.requireAssetInitializerAttestation && !request.assetInitializerAttestation) {
    throw new HsmAdapterError('REPOOL_ASSET_INITIALIZER_ATTESTATION_MISSING', 'asset initializer attestation is required');
  }
}

function _validateTransferRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('REPOOL_TRANSFER_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireClearingCommitteeAttestation && !request.clearingCommitteeAttestation) {
    throw new HsmAdapterError('REPOOL_CLEARING_ATTESTATION_MISSING', 'clearing committee attestation is required');
  }
}

module.exports = { PqcRealEstateTokenizationHub };
