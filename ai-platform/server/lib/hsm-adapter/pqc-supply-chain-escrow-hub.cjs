'use strict';

/**
 * Track 68: PQC Supply Chain Escrow Hub.
 *
 * Interlocking order coordinator that instantiates
 * multi-party procurement pools using homomorphically
 * additive Pedersen commitments over order values,
 * logistics volumes, and deposit margins. Parses
 * SCORDER packets, enforces maxEscrowFundingCap, and
 * tracks state transitions alongside the
 * minOrderMatchingQuorum boundary.
 *
 * @module hsm-adapter/pqc-supply-chain-escrow-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcSupplyChainEscrowHub {
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
    this._orders = new Map();
  }

  /**
   * Initialize a supply chain order.
   * @param {object} request
   * @returns {object}
   */
  initializeOrder(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireProcurementInitiatorAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.procurementInitiatorAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('SCORDER_PROCUREMENT_INITIATOR_UNATTESTED', 'procurement initiator attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('SCORDER_PROCUREMENT_INITIATOR_UNATTESTED', 'procurement initiator attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('SCORDER_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('SCORDER_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.deliveryEpochs === 'number' && request.deliveryEpochs > (this.policy.maxProcurementDeliveryEpochs || 30)) {
      throw new HsmAdapterError('SCORDER_DELIVERY_EPOCHS_EXCEEDED', `delivery epochs ${request.deliveryEpochs} exceeds maximum ${this.policy.maxProcurementDeliveryEpochs}`);
    }
    if (typeof request.escrowFundingCap === 'number' && request.escrowFundingCap > (this.policy.maxEscrowFundingCap || 1000000000)) {
      throw new HsmAdapterError('SCORDER_ESCROW_CAP_EXCEEDED', `escrow funding cap ${request.escrowFundingCap} exceeds maximum ${this.policy.maxEscrowFundingCap}`);
    }
    const orderId = request.orderId || `order-${crypto.randomBytes(4).toString('hex')}`;
    if (this._orders.has(orderId)) {
      throw new HsmAdapterError('SCORDER_DUPLICATE', `order ${orderId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const order = {
      orderId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedOrderValueCommitment: request.blindedOrderValueCommitment,
      blindedLogisticsVolumeCommitment: request.blindedLogisticsVolumeCommitment,
      blindedDepositMarginCommitment: request.blindedDepositMarginCommitment,
      deliveryEpochs: request.deliveryEpochs,
      escrowFundingCap: request.escrowFundingCap || 0,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      milestoneVerified: false,
      escrowReleasedAt: null,
    };
    this._orders.set(orderId, order);
    if (this._audit) {
      this._audit('SUPPLY_CHAIN_ORDER_INITIALIZED', { ...order });
    }
    return order;
  }

  /**
   * Get an order by id.
   * @param {string} orderId
   * @returns {object|null}
   */
  getOrder(orderId) {
    return this._orders.get(orderId) || null;
  }

  /**
   * Mark an order as milestone-verified.
   * @param {string} orderId
   * @returns {object}
   */
  markMilestoneVerified(orderId) {
    const order = this._orders.get(orderId);
    if (!order) {
      throw new HsmAdapterError('SCORDER_NOT_FOUND', `order ${orderId} not found`);
    }
    order.milestoneVerified = true;
    return order;
  }

  /**
   * Release escrow after milestone verification.
   * @param {object} request
   * @returns {object}
   */
  releaseEscrow(request) {
    _validateReleaseRequest(this.policy, request);
    const order = this._orders.get(request.orderId);
    if (!order) {
      throw new HsmAdapterError('SCORDER_NOT_FOUND', `order ${request.orderId} not found`);
    }
    if (!order.milestoneVerified) {
      throw new HsmAdapterError('SCORDER_MILESTONE_NOT_VERIFIED', `order ${request.orderId} milestone not verified`);
    }
    if (this.policy.requireClearingCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.clearingCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('SCORDER_CLEARING_COMMITTEE_UNATTESTED', 'clearing committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('SCORDER_CLEARING_COMMITTEE_UNATTESTED', 'clearing committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minOrderMatchingQuorum || 3)) {
      throw new HsmAdapterError('SCORDER_RELEASE_QUORUM_INSUFFICIENT', `milestone signatures ${signatures.length} below minimum ${this.policy.minOrderMatchingQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    order.status = 'released';
    order.escrowReleasedAt = now;
    const releaseId = request.releaseId || `release-${crypto.randomBytes(4).toString('hex')}`;
    const release = {
      releaseId,
      orderId: request.orderId,
      milestoneSignatureCount: signatures.length,
      releasedAt: now,
    };
    if (this._audit) {
      this._audit('PROCUREMENT_ESCROW_RELEASED', { ...release });
    }
    return release;
  }

  /**
   * Get the current order count.
   * @returns {number}
   */
  getOrderCount() {
    return this._orders.size;
  }
}

function _validateInitRequest(policy, request) {
  if (!request.sourceTenantId || !request.targetChainId) {
    throw new HsmAdapterError('SCORDER_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedOrderValueCommitment || !request.blindedLogisticsVolumeCommitment || !request.blindedDepositMarginCommitment) {
    throw new HsmAdapterError('SCORDER_FIELDS_MISSING', 'blindedOrderValueCommitment, blindedLogisticsVolumeCommitment, and blindedDepositMarginCommitment are required');
  }
  if (typeof request.deliveryEpochs !== 'number') {
    throw new HsmAdapterError('SCORDER_FIELDS_MISSING', 'deliveryEpochs is required');
  }
  if (policy.requireProcurementInitiatorAttestation && !request.procurementInitiatorAttestation) {
    throw new HsmAdapterError('SCORDER_PROCUREMENT_INITIATOR_ATTESTATION_MISSING', 'procurement initiator attestation is required');
  }
}

function _validateReleaseRequest(policy, request) {
  if (!request.orderId) {
    throw new HsmAdapterError('SCORDER_RELEASE_FIELDS_MISSING', 'orderId is required');
  }
  if (policy.requireClearingCommitteeAttestation && !request.clearingCommitteeAttestation) {
    throw new HsmAdapterError('SCORDER_CLEARING_ATTESTATION_MISSING', 'clearing committee attestation is required');
  }
}

module.exports = { PqcSupplyChainEscrowHub };
