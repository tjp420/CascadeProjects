'use strict';

/**
 * Track 81: PQC Cross-Border Logistics Gating Hub.
 *
 * Interlocking customs authority coordinator
 * that instantiates multi-party logistics
 * verification pools using homomorphically split Pedersen
 * commitments over multi-jurisdictional customs manifest
 * hashes, transit log metrics, and carrier tracking
 * identifiers. Parses LOGIGATE packets, enforces
 * maxManifestDepth, and tracks state transitions
 * alongside the minCustomsQuorum boundary.
 *
 * @module hsm-adapter/pqc-cross-border-logistics-gating-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcCrossBorderLogisticsGatingHub {
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
   * Initialize a cross-border logistics verification gating pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireCustomsAuthorityInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.customsAuthorityInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('LOGIGATE_CUSTOMS_INITIALIZER_UNATTESTED', 'customs authority initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('LOGIGATE_CUSTOMS_INITIALIZER_UNATTESTED', 'customs authority initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('LOGIGATE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('LOGIGATE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.transitWindowSeconds === 'number' && request.transitWindowSeconds > (this.policy.maxTransitWindowSeconds || 7776000)) {
      throw new HsmAdapterError('LOGIGATE_TRANSIT_WINDOW_EXCEEDED', `transit window seconds ${request.transitWindowSeconds} exceeds maximum ${this.policy.maxTransitWindowSeconds}`);
    }
    if (typeof request.manifestDepth === 'number' && request.manifestDepth > (this.policy.maxManifestDepth || 32)) {
      throw new HsmAdapterError('LOGIGATE_MANIFEST_DEPTH_EXCEEDED', `manifest depth ${request.manifestDepth} exceeds maximum ${this.policy.maxManifestDepth}`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('LOGIGATE_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedManifestHashCommitment: request.blindedManifestHashCommitment,
      blindedTransitLogCommitment: request.blindedTransitLogCommitment,
      blindedCarrierTrackingCommitment: request.blindedCarrierTrackingCommitment,
      transitWindowSeconds: request.transitWindowSeconds,
      manifestDepth: request.manifestDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      manifestClaimVerified: false,
      carrierAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit('LOGISTICS_GATING_POOL_INITIALIZED', { ...pool });
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
   * Mark a pool as manifest-claim-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markManifestClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('LOGIGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    pool.manifestClaimVerified = true;
    return pool;
  }

  /**
   * Complete carrier accreditation after quorum.
   * @param {object} request
   * @returns {object}
   */
  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('LOGIGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.manifestClaimVerified) {
      throw new HsmAdapterError('LOGIGATE_MANIFEST_CLAIM_NOT_VERIFIED', `pool ${request.poolId} manifest claim not verified`);
    }
    if (this.policy.requireTradeCorridorCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.tradeCorridorCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('LOGIGATE_TRADE_CORRIDOR_UNATTESTED', 'trade corridor committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('LOGIGATE_TRADE_CORRIDOR_UNATTESTED', 'trade corridor committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minCustomsQuorum || 3)) {
      throw new HsmAdapterError('LOGIGATE_QUORUM_INSUFFICIENT', `customs signatures ${signatures.length} below minimum ${this.policy.minCustomsQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = 'accredited';
    pool.carrierAccreditationCompletedAt = now;
    const completionId = request.completionId || `completion-${crypto.randomBytes(4).toString('hex')}`;
    const completion = {
      completionId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      completedAt: now,
    };
    if (this._audit) {
      this._audit('CARRIER_ACCREDITATION_COMPLETED', { ...completion });
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
    throw new HsmAdapterError('LOGIGATE_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedManifestHashCommitment || !request.blindedTransitLogCommitment || !request.blindedCarrierTrackingCommitment) {
    throw new HsmAdapterError('LOGIGATE_FIELDS_MISSING', 'blindedManifestHashCommitment, blindedTransitLogCommitment, and blindedCarrierTrackingCommitment are required');
  }
  if (typeof request.transitWindowSeconds !== 'number') {
    throw new HsmAdapterError('LOGIGATE_FIELDS_MISSING', 'transitWindowSeconds is required');
  }
  if (typeof request.manifestDepth !== 'number') {
    throw new HsmAdapterError('LOGIGATE_FIELDS_MISSING', 'manifestDepth is required');
  }
  if (policy.requireCustomsAuthorityInitializerAttestation && !request.customsAuthorityInitializerAttestation) {
    throw new HsmAdapterError('LOGIGATE_CUSTOMS_ATTESTATION_MISSING', 'customs authority initializer attestation is required');
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('LOGIGATE_COMPLETE_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireTradeCorridorCommitteeAttestation && !request.tradeCorridorCommitteeAttestation) {
    throw new HsmAdapterError('LOGIGATE_CORRIDOR_ATTESTATION_MISSING', 'trade corridor committee attestation is required');
  }
}

module.exports = { PqcCrossBorderLogisticsGatingHub };
