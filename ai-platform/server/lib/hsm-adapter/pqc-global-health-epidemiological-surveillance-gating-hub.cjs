'use strict';

/**
 * Track 92: PQC Global Health Epidemiological Surveillance Gating Hub.
 *
 * Interlocking WHO authority endpoint
 * coordinator that instantiates
 * multi-party epidemiological surveillance
 * verification pools using homomorphically
 * split Pedersen commitments over
 * epidemiological case telemetry hashes,
 * pathogen genomic sequence digests, and
 * public health authority identity hashes.
 * Parses EPIGATE packets, enforces
 * maxGenomicChainDepth, and tracks state
 * transitions alongside the
 * minEpidemiologyQuorum boundary.
 *
 * @module hsm-adapter/pqc-global-health-epidemiological-surveillance-gating-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcGlobalHealthEpidemiologicalSurveillanceGatingHub {
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
   * Initialize a global health epidemiological surveillance verification gating pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireWhoAuthorityInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.whoAuthorityInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('EPIGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'WHO authority initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('EPIGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'WHO authority initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('EPIGATE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('EPIGATE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.surveillanceWindowSeconds === 'number' && request.surveillanceWindowSeconds > (this.policy.maxSurveillanceWindowSeconds || 604800)) {
      throw new HsmAdapterError('EPIGATE_SURVEILLANCE_WINDOW_EXCEEDED', `surveillance window seconds ${request.surveillanceWindowSeconds} exceeds maximum ${this.policy.maxSurveillanceWindowSeconds}`);
    }
    if (typeof request.genomicChainDepth === 'number' && request.genomicChainDepth > (this.policy.maxGenomicChainDepth || 16)) {
      throw new HsmAdapterError('EPIGATE_GENOMIC_DEPTH_EXCEEDED', `genomic chain depth ${request.genomicChainDepth} exceeds maximum ${this.policy.maxGenomicChainDepth}`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('EPIGATE_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedCaseTelemetryCommitment: request.blindedCaseTelemetryCommitment,
      blindedGenomicSequenceCommitment: request.blindedGenomicSequenceCommitment,
      blindedHealthAuthorityIdentityCommitment: request.blindedHealthAuthorityIdentityCommitment,
      surveillanceWindowSeconds: request.surveillanceWindowSeconds,
      genomicChainDepth: request.genomicChainDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      epidemiologicalClaimVerified: false,
      outbreakAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit('EPIDEMIOLOGY_GATING_POOL_INITIALIZED', { ...pool });
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
   * Mark a pool as epidemiological-claim-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markEpidemiologicalClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('EPIGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    pool.epidemiologicalClaimVerified = true;
    return pool;
  }

  /**
   * Complete outbreak accreditation after quorum.
   * @param {object} request
   * @returns {object}
   */
  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('EPIGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.epidemiologicalClaimVerified) {
      throw new HsmAdapterError('EPIGATE_EPIDEMIOLOGICAL_CLAIM_NOT_VERIFIED', `pool ${request.poolId} epidemiological claim not verified`);
    }
    if (this.policy.requireEpidemiologyOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.epidemiologyOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('EPIGATE_EPIDEMIOLOGY_COMMITTEE_UNATTESTED', 'epidemiology oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('EPIGATE_EPIDEMIOLOGY_COMMITTEE_UNATTESTED', 'epidemiology oversight committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minEpidemiologyQuorum || 5)) {
      throw new HsmAdapterError('EPIGATE_QUORUM_INSUFFICIENT', `epidemiology signatures ${signatures.length} below minimum ${this.policy.minEpidemiologyQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = 'accredited';
    pool.outbreakAccreditationCompletedAt = now;
    const completionId = request.completionId || `completion-${crypto.randomBytes(4).toString('hex')}`;
    const completion = {
      completionId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      completedAt: now,
    };
    if (this._audit) {
      this._audit('OUTBREAK_ACCREDITATION_COMPLETED', { ...completion });
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
    throw new HsmAdapterError('EPIGATE_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedCaseTelemetryCommitment || !request.blindedGenomicSequenceCommitment || !request.blindedHealthAuthorityIdentityCommitment) {
    throw new HsmAdapterError('EPIGATE_FIELDS_MISSING', 'blindedCaseTelemetryCommitment, blindedGenomicSequenceCommitment, and blindedHealthAuthorityIdentityCommitment are required');
  }
  if (typeof request.surveillanceWindowSeconds !== 'number') {
    throw new HsmAdapterError('EPIGATE_FIELDS_MISSING', 'surveillanceWindowSeconds is required');
  }
  if (typeof request.genomicChainDepth !== 'number') {
    throw new HsmAdapterError('EPIGATE_FIELDS_MISSING', 'genomicChainDepth is required');
  }
  if (policy.requireWhoAuthorityInitializerAttestation && !request.whoAuthorityInitializerAttestation) {
    throw new HsmAdapterError('EPIGATE_AUTHORITY_ATTESTATION_MISSING', 'WHO authority initializer attestation is required');
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('EPIGATE_COMPLETE_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireEpidemiologyOversightCommitteeAttestation && !request.epidemiologyOversightCommitteeAttestation) {
    throw new HsmAdapterError('EPIGATE_EPIDEMIOLOGY_ATTESTATION_MISSING', 'epidemiology oversight committee attestation is required');
  }
}

module.exports = { PqcGlobalHealthEpidemiologicalSurveillanceGatingHub };
