'use strict';

/**
 * Track 85: PQC Telecom Routing Gating Hub.
 *
 * Interlocking carrier endpoint coordinator
 * that instantiates multi-party telecom authority
 * verification pools using homomorphically split
 * Pedersen commitments over network packet routing
 * volumes, latency bounds, and infrastructure identity
 * hashes. Parses TELECOMGATE packets, enforces
 * maxNetworkRoutingDepth, and tracks state transitions
 * alongside the minTelecomPeeringQuorum boundary.
 *
 * @module hsm-adapter/pqc-telecom-routing-gating-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcTelecomRoutingGatingHub {
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
   * Initialize a telecom routing verification gating pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireCarrierEndpointInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.carrierEndpointInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('TELECOMGATE_CARRIER_INITIALIZER_UNATTESTED', 'carrier endpoint initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('TELECOMGATE_CARRIER_INITIALIZER_UNATTESTED', 'carrier endpoint initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('TELECOMGATE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('TELECOMGATE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.allocationWindowSeconds === 'number' && request.allocationWindowSeconds > (this.policy.maxAllocationWindowSeconds || 2592000)) {
      throw new HsmAdapterError('TELECOMGATE_ALLOCATION_WINDOW_EXCEEDED', `allocation window seconds ${request.allocationWindowSeconds} exceeds maximum ${this.policy.maxAllocationWindowSeconds}`);
    }
    if (typeof request.networkRoutingDepth === 'number' && request.networkRoutingDepth > (this.policy.maxNetworkRoutingDepth || 32)) {
      throw new HsmAdapterError('TELECOMGATE_ROUTING_DEPTH_EXCEEDED', `network routing depth ${request.networkRoutingDepth} exceeds maximum ${this.policy.maxNetworkRoutingDepth}`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('TELECOMGATE_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedRoutingVolumeCommitment: request.blindedRoutingVolumeCommitment,
      blindedLatencyBoundCommitment: request.blindedLatencyBoundCommitment,
      blindedInfrastructureHashCommitment: request.blindedInfrastructureHashCommitment,
      allocationWindowSeconds: request.allocationWindowSeconds,
      networkRoutingDepth: request.networkRoutingDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      bandwidthClaimVerified: false,
      routingAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit('TELECOM_ROUTING_POOL_INITIALIZED', { ...pool });
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
   * Mark a pool as bandwidth-claim-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markBandwidthClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('TELECOMGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    pool.bandwidthClaimVerified = true;
    return pool;
  }

  /**
   * Complete routing accreditation after quorum.
   * @param {object} request
   * @returns {object}
   */
  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('TELECOMGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.bandwidthClaimVerified) {
      throw new HsmAdapterError('TELECOMGATE_BANDWIDTH_CLAIM_NOT_VERIFIED', `pool ${request.poolId} bandwidth claim not verified`);
    }
    if (this.policy.requireRoutingCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.routingCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('TELECOMGATE_ROUTING_COMMITTEE_UNATTESTED', 'routing committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('TELECOMGATE_ROUTING_COMMITTEE_UNATTESTED', 'routing committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minTelecomPeeringQuorum || 3)) {
      throw new HsmAdapterError('TELECOMGATE_QUORUM_INSUFFICIENT', `telecom peering signatures ${signatures.length} below minimum ${this.policy.minTelecomPeeringQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = 'accredited';
    pool.routingAccreditationCompletedAt = now;
    const completionId = request.completionId || `completion-${crypto.randomBytes(4).toString('hex')}`;
    const completion = {
      completionId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      completedAt: now,
    };
    if (this._audit) {
      this._audit('ROUTING_ACCREDITATION_COMPLETED', { ...completion });
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
    throw new HsmAdapterError('TELECOMGATE_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedRoutingVolumeCommitment || !request.blindedLatencyBoundCommitment || !request.blindedInfrastructureHashCommitment) {
    throw new HsmAdapterError('TELECOMGATE_FIELDS_MISSING', 'blindedRoutingVolumeCommitment, blindedLatencyBoundCommitment, and blindedInfrastructureHashCommitment are required');
  }
  if (typeof request.allocationWindowSeconds !== 'number') {
    throw new HsmAdapterError('TELECOMGATE_FIELDS_MISSING', 'allocationWindowSeconds is required');
  }
  if (typeof request.networkRoutingDepth !== 'number') {
    throw new HsmAdapterError('TELECOMGATE_FIELDS_MISSING', 'networkRoutingDepth is required');
  }
  if (policy.requireCarrierEndpointInitializerAttestation && !request.carrierEndpointInitializerAttestation) {
    throw new HsmAdapterError('TELECOMGATE_CARRIER_ATTESTATION_MISSING', 'carrier endpoint initializer attestation is required');
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('TELECOMGATE_COMPLETE_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireRoutingCommitteeAttestation && !request.routingCommitteeAttestation) {
    throw new HsmAdapterError('TELECOMGATE_ROUTING_ATTESTATION_MISSING', 'routing committee attestation is required');
  }
}

module.exports = { PqcTelecomRoutingGatingHub };
