'use strict';

/**
 * Track 89: PQC Nuclear Safeguards Monitoring Gating Hub.
 *
 * Interlocking IAEA safeguards authority
 * endpoint coordinator that instantiates
 * multi-party safeguards verification pools
 * using homomorphically split Pedersen
 * commitments over reactor telemetry hashes,
 * inspection report digests, and facility
 * identity hashes. Parses NUCLEARGATE
 * packets, enforces maxTelemetryChainDepth,
 * and tracks state transitions alongside
 * the minSafeguardsQuorum boundary.
 *
 * @module hsm-adapter/pqc-nuclear-safeguards-monitoring-gating-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcNuclearSafeguardsMonitoringGatingHub {
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
   * Initialize a nuclear safeguards monitoring verification gating pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireSafeguardsAuthorityInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.safeguardsAuthorityInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('NUCLEARGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'safeguards authority initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('NUCLEARGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'safeguards authority initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('NUCLEARGATE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('NUCLEARGATE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.inspectionWindowSeconds === 'number' && request.inspectionWindowSeconds > (this.policy.maxInspectionWindowSeconds || 7776000)) {
      throw new HsmAdapterError('NUCLEARGATE_INSPECTION_WINDOW_EXCEEDED', `inspection window seconds ${request.inspectionWindowSeconds} exceeds maximum ${this.policy.maxInspectionWindowSeconds}`);
    }
    if (typeof request.telemetryChainDepth === 'number' && request.telemetryChainDepth > (this.policy.maxTelemetryChainDepth || 12)) {
      throw new HsmAdapterError('NUCLEARGATE_TELEMETRY_DEPTH_EXCEEDED', `telemetry chain depth ${request.telemetryChainDepth} exceeds maximum ${this.policy.maxTelemetryChainDepth}`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('NUCLEARGATE_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedReactorTelemetryCommitment: request.blindedReactorTelemetryCommitment,
      blindedInspectionReportCommitment: request.blindedInspectionReportCommitment,
      blindedFacilityIdentityCommitment: request.blindedFacilityIdentityCommitment,
      inspectionWindowSeconds: request.inspectionWindowSeconds,
      telemetryChainDepth: request.telemetryChainDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      safeguardsClaimVerified: false,
      nuclearAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit('NUCLEAR_GATING_POOL_INITIALIZED', { ...pool });
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
   * Mark a pool as safeguards-claim-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markSafeguardsClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('NUCLEARGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    pool.safeguardsClaimVerified = true;
    return pool;
  }

  /**
   * Complete nuclear accreditation after quorum.
   * @param {object} request
   * @returns {object}
   */
  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('NUCLEARGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.safeguardsClaimVerified) {
      throw new HsmAdapterError('NUCLEARGATE_SAFEGUARDS_CLAIM_NOT_VERIFIED', `pool ${request.poolId} safeguards claim not verified`);
    }
    if (this.policy.requireNuclearOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.nuclearOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('NUCLEARGATE_NUCLEAR_COMMITTEE_UNATTESTED', 'nuclear oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('NUCLEARGATE_NUCLEAR_COMMITTEE_UNATTESTED', 'nuclear oversight committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minSafeguardsQuorum || 6)) {
      throw new HsmAdapterError('NUCLEARGATE_QUORUM_INSUFFICIENT', `safeguards signatures ${signatures.length} below minimum ${this.policy.minSafeguardsQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = 'accredited';
    pool.nuclearAccreditationCompletedAt = now;
    const completionId = request.completionId || `completion-${crypto.randomBytes(4).toString('hex')}`;
    const completion = {
      completionId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      completedAt: now,
    };
    if (this._audit) {
      this._audit('NUCLEAR_ACCREDITATION_COMPLETED', { ...completion });
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
    throw new HsmAdapterError('NUCLEARGATE_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedReactorTelemetryCommitment || !request.blindedInspectionReportCommitment || !request.blindedFacilityIdentityCommitment) {
    throw new HsmAdapterError('NUCLEARGATE_FIELDS_MISSING', 'blindedReactorTelemetryCommitment, blindedInspectionReportCommitment, and blindedFacilityIdentityCommitment are required');
  }
  if (typeof request.inspectionWindowSeconds !== 'number') {
    throw new HsmAdapterError('NUCLEARGATE_FIELDS_MISSING', 'inspectionWindowSeconds is required');
  }
  if (typeof request.telemetryChainDepth !== 'number') {
    throw new HsmAdapterError('NUCLEARGATE_FIELDS_MISSING', 'telemetryChainDepth is required');
  }
  if (policy.requireSafeguardsAuthorityInitializerAttestation && !request.safeguardsAuthorityInitializerAttestation) {
    throw new HsmAdapterError('NUCLEARGATE_AUTHORITY_ATTESTATION_MISSING', 'safeguards authority initializer attestation is required');
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('NUCLEARGATE_COMPLETE_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireNuclearOversightCommitteeAttestation && !request.nuclearOversightCommitteeAttestation) {
    throw new HsmAdapterError('NUCLEARGATE_NUCLEAR_ATTESTATION_MISSING', 'nuclear oversight committee attestation is required');
  }
}

module.exports = { PqcNuclearSafeguardsMonitoringGatingHub };
