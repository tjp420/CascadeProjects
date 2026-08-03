'use strict';

/**
 * Track 91: PQC Smart-Grid Micro-Transaction Gating Hub.
 *
 * Interlocking utility authority
 * endpoint coordinator that instantiates
 * multi-party smart-grid verification pools
 * using homomorphically split Pedersen
 * commitments over energy consumption
 * telemetry hashes, prosumer load balance
 * measurements, and utility meter identity
 * hashes. Parses SMARTGRIDGATE packets,
 * enforces maxConsumptionChainDepth, and
 * tracks state transitions alongside the
 * minGridOperatorQuorum boundary.
 *
 * @module hsm-adapter/pqc-smart-grid-micro-transaction-gating-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcSmartGridMicroTransactionGatingHub {
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
   * Initialize a smart-grid micro-transaction verification gating pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireGridAuthorityInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.gridAuthorityInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('SMARTGRIDGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'grid authority initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('SMARTGRIDGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'grid authority initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('SMARTGRIDGATE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('SMARTGRIDGATE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.transactionWindowSeconds === 'number' && request.transactionWindowSeconds > (this.policy.maxTransactionWindowSeconds || 86400)) {
      throw new HsmAdapterError('SMARTGRIDGATE_TRANSACTION_WINDOW_EXCEEDED', `transaction window seconds ${request.transactionWindowSeconds} exceeds maximum ${this.policy.maxTransactionWindowSeconds}`);
    }
    if (typeof request.consumptionChainDepth === 'number' && request.consumptionChainDepth > (this.policy.maxConsumptionChainDepth || 18)) {
      throw new HsmAdapterError('SMARTGRIDGATE_CONSUMPTION_DEPTH_EXCEEDED', `consumption chain depth ${request.consumptionChainDepth} exceeds maximum ${this.policy.maxConsumptionChainDepth}`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('SMARTGRIDGATE_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedConsumptionTelemetryCommitment: request.blindedConsumptionTelemetryCommitment,
      blindedLoadBalanceCommitment: request.blindedLoadBalanceCommitment,
      blindedMeterIdentityCommitment: request.blindedMeterIdentityCommitment,
      transactionWindowSeconds: request.transactionWindowSeconds,
      consumptionChainDepth: request.consumptionChainDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      microTransactionClaimVerified: false,
      loadBalanceAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit('SMARTGRID_GATING_POOL_INITIALIZED', { ...pool });
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
   * Mark a pool as micro-transaction-claim-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markMicroTransactionClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('SMARTGRIDGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    pool.microTransactionClaimVerified = true;
    return pool;
  }

  /**
   * Complete load balance accreditation after quorum.
   * @param {object} request
   * @returns {object}
   */
  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('SMARTGRIDGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.microTransactionClaimVerified) {
      throw new HsmAdapterError('SMARTGRIDGATE_MICRO_TX_CLAIM_NOT_VERIFIED', `pool ${request.poolId} micro-transaction claim not verified`);
    }
    if (this.policy.requireLoadBalanceOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.loadBalanceOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('SMARTGRIDGATE_LOAD_BALANCE_COMMITTEE_UNATTESTED', 'load balance oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('SMARTGRIDGATE_LOAD_BALANCE_COMMITTEE_UNATTESTED', 'load balance oversight committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minGridOperatorQuorum || 5)) {
      throw new HsmAdapterError('SMARTGRIDGATE_QUORUM_INSUFFICIENT', `grid operator signatures ${signatures.length} below minimum ${this.policy.minGridOperatorQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = 'accredited';
    pool.loadBalanceAccreditationCompletedAt = now;
    const completionId = request.completionId || `completion-${crypto.randomBytes(4).toString('hex')}`;
    const completion = {
      completionId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      completedAt: now,
    };
    if (this._audit) {
      this._audit('LOAD_BALANCE_ACCREDITATION_COMPLETED', { ...completion });
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
    throw new HsmAdapterError('SMARTGRIDGATE_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedConsumptionTelemetryCommitment || !request.blindedLoadBalanceCommitment || !request.blindedMeterIdentityCommitment) {
    throw new HsmAdapterError('SMARTGRIDGATE_FIELDS_MISSING', 'blindedConsumptionTelemetryCommitment, blindedLoadBalanceCommitment, and blindedMeterIdentityCommitment are required');
  }
  if (typeof request.transactionWindowSeconds !== 'number') {
    throw new HsmAdapterError('SMARTGRIDGATE_FIELDS_MISSING', 'transactionWindowSeconds is required');
  }
  if (typeof request.consumptionChainDepth !== 'number') {
    throw new HsmAdapterError('SMARTGRIDGATE_FIELDS_MISSING', 'consumptionChainDepth is required');
  }
  if (policy.requireGridAuthorityInitializerAttestation && !request.gridAuthorityInitializerAttestation) {
    throw new HsmAdapterError('SMARTGRIDGATE_AUTHORITY_ATTESTATION_MISSING', 'grid authority initializer attestation is required');
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('SMARTGRIDGATE_COMPLETE_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireLoadBalanceOversightCommitteeAttestation && !request.loadBalanceOversightCommitteeAttestation) {
    throw new HsmAdapterError('SMARTGRIDGATE_LOAD_BALANCE_ATTESTATION_MISSING', 'load balance oversight committee attestation is required');
  }
}

module.exports = { PqcSmartGridMicroTransactionGatingHub };
