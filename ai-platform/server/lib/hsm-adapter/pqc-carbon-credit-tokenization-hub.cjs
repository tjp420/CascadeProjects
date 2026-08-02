'use strict';

/**
 * Track 70: PQC Carbon Credit Tokenization Hub.
 *
 * Interlocking environmental asset coordinator that
 * instantiates multi-party offset pools using
 * homomorphically split Pedersen commitments over carbon
 * volumes, vintage certification metrics, and retired
 * allocations. Parses CARBONPOOL packets, enforces
 * maxCarbonTonnageCap, and tracks state transitions
 * alongside the minRetirementQuorum boundary.
 *
 * @module hsm-adapter/pqc-carbon-credit-tokenization-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcCarbonCreditTokenizationHub {
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
   * Initialize a carbon credit tokenization pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireAssetInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.assetInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('CARBONPOOL_ASSET_INITIALIZER_UNATTESTED', 'asset initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('CARBONPOOL_ASSET_INITIALIZER_UNATTESTED', 'asset initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('CARBONPOOL_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('CARBONPOOL_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.vintageAgeSeconds === 'number' && request.vintageAgeSeconds > (this.policy.maxVintageAgeSeconds || 63072000)) {
      throw new HsmAdapterError('CARBONPOOL_VINTAGE_AGE_EXCEEDED', `vintage age seconds ${request.vintageAgeSeconds} exceeds maximum ${this.policy.maxVintageAgeSeconds}`);
    }
    if (typeof request.carbonTonnageCap === 'number' && request.carbonTonnageCap > (this.policy.maxCarbonTonnageCap || 1000000000)) {
      throw new HsmAdapterError('CARBONPOOL_TONNAGE_CAP_EXCEEDED', `carbon tonnage cap ${request.carbonTonnageCap} exceeds maximum ${this.policy.maxCarbonTonnageCap}`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('CARBONPOOL_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedCarbonVolumeCommitment: request.blindedCarbonVolumeCommitment,
      blindedVintageCertificationCommitment: request.blindedVintageCertificationCommitment,
      blindedRetiredAllocationCommitment: request.blindedRetiredAllocationCommitment,
      vintageAgeSeconds: request.vintageAgeSeconds,
      carbonTonnageCap: request.carbonTonnageCap || 0,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      retirementProofVerified: false,
      retirementFinalizedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit('CARBON_POOL_INITIALIZED', { ...pool });
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
   * Mark a pool as retirement-proof-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markRetirementProofVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('CARBONPOOL_NOT_FOUND', `pool ${poolId} not found`);
    }
    pool.retirementProofVerified = true;
    return pool;
  }

  /**
   * Finalize a carbon credit retirement after quorum.
   * @param {object} request
   * @returns {object}
   */
  finalizeRetirement(request) {
    _validateFinalizeRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('CARBONPOOL_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.retirementProofVerified) {
      throw new HsmAdapterError('CARBONPOOL_RETIREMENT_PROOF_NOT_VERIFIED', `pool ${request.poolId} retirement proof not verified`);
    }
    if (this.policy.requireClearingCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.clearingCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('CARBONPOOL_CLEARING_COMMITTEE_UNATTESTED', 'clearing committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('CARBONPOOL_CLEARING_COMMITTEE_UNATTESTED', 'clearing committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minRetirementQuorum || 3)) {
      throw new HsmAdapterError('CARBONPOOL_RETIREMENT_QUORUM_INSUFFICIENT', `retirement signatures ${signatures.length} below minimum ${this.policy.minRetirementQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = 'retired';
    pool.retirementFinalizedAt = now;
    const finalizationId = request.finalizationId || `finalize-${crypto.randomBytes(4).toString('hex')}`;
    const finalization = {
      finalizationId,
      poolId: request.poolId,
      retirementSignatureCount: signatures.length,
      finalizedAt: now,
    };
    if (this._audit) {
      this._audit('CARBON_CREDIT_RETIREMENT_FINALIZED', { ...finalization });
    }
    return finalization;
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
    throw new HsmAdapterError('CARBONPOOL_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedCarbonVolumeCommitment || !request.blindedVintageCertificationCommitment || !request.blindedRetiredAllocationCommitment) {
    throw new HsmAdapterError('CARBONPOOL_FIELDS_MISSING', 'blindedCarbonVolumeCommitment, blindedVintageCertificationCommitment, and blindedRetiredAllocationCommitment are required');
  }
  if (typeof request.vintageAgeSeconds !== 'number') {
    throw new HsmAdapterError('CARBONPOOL_FIELDS_MISSING', 'vintageAgeSeconds is required');
  }
  if (policy.requireAssetInitializerAttestation && !request.assetInitializerAttestation) {
    throw new HsmAdapterError('CARBONPOOL_ASSET_INITIALIZER_ATTESTATION_MISSING', 'asset initializer attestation is required');
  }
}

function _validateFinalizeRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('CARBONPOOL_FINALIZE_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireClearingCommitteeAttestation && !request.clearingCommitteeAttestation) {
    throw new HsmAdapterError('CARBONPOOL_CLEARING_ATTESTATION_MISSING', 'clearing committee attestation is required');
  }
}

module.exports = { PqcCarbonCreditTokenizationHub };
