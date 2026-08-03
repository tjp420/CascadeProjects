'use strict';

/**
 * Track 76: PQC Supply Chain Provenance Gating Hub.
 *
 * Interlocking supply chain provenance verification
 * coordinator that instantiates multi-party supplier
 * checkpoint verification pools using homomorphically split
 * Pedersen commitments over component lineage records,
 * supplier identity hashes, and manufacturing metric
 * commitments. Parses SUPPLYGATE packets, enforces
 * maxComponentLineageDepth, and tracks state transitions
 * alongside the minSupplierCheckpointQuorum boundary.
 *
 * @module hsm-adapter/pqc-supply-chain-provenance-gating-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcSupplyChainProvenanceGatingHub {
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
   * Initialize a supply chain provenance gating pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireFactoryEndpointInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.factoryEndpointInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('SUPPLYGATE_FACTORY_ENDPOINT_INITIALIZER_UNATTESTED', 'factory endpoint initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('SUPPLYGATE_FACTORY_ENDPOINT_INITIALIZER_UNATTESTED', 'factory endpoint initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('SUPPLYGATE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('SUPPLYGATE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.transitExpirationSeconds === 'number' && request.transitExpirationSeconds > (this.policy.maxTransitExpirationSeconds || 7776000)) {
      throw new HsmAdapterError('SUPPLYGATE_TRANSIT_EXPIRATION_EXCEEDED', `transit expiration seconds ${request.transitExpirationSeconds} exceeds maximum ${this.policy.maxTransitExpirationSeconds}`);
    }
    if (typeof request.componentLineageDepth === 'number' && request.componentLineageDepth > (this.policy.maxComponentLineageDepth || 64)) {
      throw new HsmAdapterError('SUPPLYGATE_LINEAGE_DEPTH_EXCEEDED', `component lineage depth ${request.componentLineageDepth} exceeds maximum ${this.policy.maxComponentLineageDepth}`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('SUPPLYGATE_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedLineageCommitment: request.blindedLineageCommitment,
      blindedSupplierHashCommitment: request.blindedSupplierHashCommitment,
      blindedManufacturingMetricCommitment: request.blindedManufacturingMetricCommitment,
      transitExpirationSeconds: request.transitExpirationSeconds,
      componentLineageDepth: request.componentLineageDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      provenanceClaimVerified: false,
      lineageAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit('SUPPLY_CHAIN_GATING_POOL_INITIALIZED', { ...pool });
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
   * Mark a pool as provenance-claim-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markProvenanceClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('SUPPLYGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    pool.provenanceClaimVerified = true;
    return pool;
  }

  /**
   * Complete component lineage accreditation after quorum.
   * @param {object} request
   * @returns {object}
   */
  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('SUPPLYGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.provenanceClaimVerified) {
      throw new HsmAdapterError('SUPPLYGATE_PROVENANCE_CLAIM_NOT_VERIFIED', `pool ${request.poolId} provenance claim not verified`);
    }
    if (this.policy.requireClearingCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.clearingCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('SUPPLYGATE_CLEARING_COMMITTEE_UNATTESTED', 'clearing committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('SUPPLYGATE_CLEARING_COMMITTEE_UNATTESTED', 'clearing committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minSupplierCheckpointQuorum || 3)) {
      throw new HsmAdapterError('SUPPLYGATE_QUORUM_INSUFFICIENT', `supplier checkpoint signatures ${signatures.length} below minimum ${this.policy.minSupplierCheckpointQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = 'accredited';
    pool.lineageAccreditationCompletedAt = now;
    const completionId = request.completionId || `completion-${crypto.randomBytes(4).toString('hex')}`;
    const completion = {
      completionId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      completedAt: now,
    };
    if (this._audit) {
      this._audit('COMPONENT_LINEAGE_ACCREDITATION_COMPLETED', { ...completion });
    }
    return completion;
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
    throw new HsmAdapterError('SUPPLYGATE_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedLineageCommitment || !request.blindedSupplierHashCommitment || !request.blindedManufacturingMetricCommitment) {
    throw new HsmAdapterError('SUPPLYGATE_FIELDS_MISSING', 'blindedLineageCommitment, blindedSupplierHashCommitment, and blindedManufacturingMetricCommitment are required');
  }
  if (typeof request.transitExpirationSeconds !== 'number') {
    throw new HsmAdapterError('SUPPLYGATE_FIELDS_MISSING', 'transitExpirationSeconds is required');
  }
  if (typeof request.componentLineageDepth !== 'number') {
    throw new HsmAdapterError('SUPPLYGATE_FIELDS_MISSING', 'componentLineageDepth is required');
  }
  if (policy.requireFactoryEndpointInitializerAttestation && !request.factoryEndpointInitializerAttestation) {
    throw new HsmAdapterError('SUPPLYGATE_FACTORY_ENDPOINT_ATTESTATION_MISSING', 'factory endpoint initializer attestation is required');
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('SUPPLYGATE_COMPLETE_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireClearingCommitteeAttestation && !request.clearingCommitteeAttestation) {
    throw new HsmAdapterError('SUPPLYGATE_CLEARING_ATTESTATION_MISSING', 'clearing committee attestation is required');
  }
}

module.exports = { PqcSupplyChainProvenanceGatingHub };
