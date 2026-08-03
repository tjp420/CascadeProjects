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
 * Extended with batch order initialization, delivery
 * epoch rebalancing, committee signature aggregation,
 * order cancellation, cross-chain settlement, and
 * summary statistics.
 *
 * @module hsm-adapter/pqc-supply-chain-escrow-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

const ORDER_STATUS = {
  OPEN: 'open',
  REBALANCING: 'rebalancing',
  RELEASED: 'released',
  SETTLED: 'settled',
  CANCELLED: 'cancelled',
};

const REBALANCE_DIRECTION = {
  INCREASE: 'increase',
  DECREASE: 'decrease',
};

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
    this._settlements = new Map();
    this._rebalances = new Map();
    this._maxOrders = options.maxOrders || 1000;
    this._maxBatchSize = options.maxBatchSize || 50;
    this._initCount = 0;
    this._releaseCount = 0;
    this._settleCount = 0;
    this._rebalanceCount = 0;
    this._cancelCount = 0;
  }

  /**
   * Initialize a supply chain order.
   * @param {object} request
   * @returns {object}
   */
  initializeOrder(request) {
    _validateInitRequest(this.policy, request);
    if (this._orders.size >= this._maxOrders) {
      throw new HsmAdapterError('SCORDER_MAX_ORDERS',
        `maximum ${this._maxOrders} orders reached`);
    }
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
      status: ORDER_STATUS.OPEN,
      milestoneVerified: false,
      escrowReleasedAt: null,
      rebalanceEpoch: 0,
      settlementStatus: null,
      settledAt: null,
      cancelledAt: null,
    };
    this._orders.set(orderId, order);
    this._initCount++;
    if (this._audit) {
      this._audit('SUPPLY_CHAIN_ORDER_INITIALIZED', { ...order });
    }
    return order;
  }

  /**
   * Batch initialize multiple supply chain orders.
   * @param {object[]} requests
   * @returns {object}
   */
  batchInitializeOrders(requests) {
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new HsmAdapterError('SCORDER_BATCH_EMPTY', 'batch requests array is required');
    }
    if (requests.length > this._maxBatchSize) {
      throw new HsmAdapterError('SCORDER_BATCH_TOO_LARGE',
        `${requests.length} exceeds max batch size ${this._maxBatchSize}`);
    }
    const results = [];
    let successCount = 0;
    let failedCount = 0;
    for (const req of requests) {
      try {
        const order = this.initializeOrder(req);
        results.push({ orderId: order.orderId, initialized: true });
        successCount++;
      } catch (err) {
        results.push({
          orderId: req.orderId || 'auto',
          initialized: false,
          error: err.code || 'SCORDER_BATCH_ERROR',
        });
        failedCount++;
      }
    }
    if (this._audit) {
      this._audit('SCORDER_BATCH_INITIALIZED', { successCount, failedCount, batchSize: requests.length });
    }
    return { totalRequests: requests.length, successCount, failedCount, results };
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
   * Rebalance delivery epochs for an order.
   * @param {object} request
   * @returns {object}
   */
  rebalanceDeliveryEpochs(request) {
    if (!request || !request.orderId) {
      throw new HsmAdapterError('SCORDER_REBALANCE_FIELDS_MISSING', 'orderId is required');
    }
    const order = this._orders.get(request.orderId);
    if (!order) {
      throw new HsmAdapterError('SCORDER_NOT_FOUND', `order ${request.orderId} not found`);
    }
    if (order.status !== ORDER_STATUS.OPEN && order.status !== ORDER_STATUS.REBALANCING) {
      throw new HsmAdapterError('SCORDER_NOT_REBALANCEABLE',
        `order ${request.orderId} status is ${order.status}, expected open or rebalancing`);
    }
    const direction = request.direction || REBALANCE_DIRECTION.INCREASE;
    if (!Object.values(REBALANCE_DIRECTION).includes(direction)) {
      throw new HsmAdapterError('SCORDER_REBALANCE_DIRECTION_INVALID',
        `direction ${direction} is not valid; allowed: ${Object.values(REBALANCE_DIRECTION).join(', ')}`);
    }
    if (typeof request.rebalanceAmount !== 'number' || request.rebalanceAmount <= 0) {
      throw new HsmAdapterError('SCORDER_REBALANCE_AMOUNT_INVALID',
        'rebalanceAmount must be a positive number');
    }
    const newEpoch = order.rebalanceEpoch + 1;
    order.rebalanceEpoch = newEpoch;
    order.status = ORDER_STATUS.REBALANCING;
    const rebalanceId = request.rebalanceId || `rebal-${crypto.randomBytes(4).toString('hex')}`;
    const rebalance = {
      rebalanceId,
      orderId: request.orderId,
      direction,
      rebalanceAmount: request.rebalanceAmount,
      rebalanceEpoch: newEpoch,
      newDeliveryEpochs: request.newDeliveryEpochs || order.deliveryEpochs,
      rebalancedAt: Math.floor(Date.now() / 1000),
    };
    this._rebalances.set(rebalanceId, rebalance);
    this._rebalanceCount++;
    if (request.newDeliveryEpochs !== undefined) {
      order.deliveryEpochs = request.newDeliveryEpochs;
    }
    if (this._audit) {
      this._audit('SCORDER_DELIVERY_REBALANCED', { ...rebalance });
    }
    return rebalance;
  }

  /**
   * Get a rebalance record by id.
   * @param {string} rebalanceId
   * @returns {object|null}
   */
  getRebalance(rebalanceId) {
    return this._rebalances.get(rebalanceId) || null;
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
    order.status = ORDER_STATUS.RELEASED;
    order.escrowReleasedAt = now;
    const releaseId = request.releaseId || `release-${crypto.randomBytes(4).toString('hex')}`;
    const release = {
      releaseId,
      orderId: request.orderId,
      milestoneSignatureCount: signatures.length,
      releasedAt: now,
    };
    this._releaseCount++;
    if (this._audit) {
      this._audit('PROCUREMENT_ESCROW_RELEASED', { ...release });
    }
    return release;
  }

  /**
   * Settle a released order cross-chain.
   * @param {object} request
   * @returns {object}
   */
  settleOrder(request) {
    if (!request || !request.orderId) {
      throw new HsmAdapterError('SCORDER_SETTLE_FIELDS_MISSING', 'orderId is required');
    }
    const order = this._orders.get(request.orderId);
    if (!order) {
      throw new HsmAdapterError('SCORDER_NOT_FOUND', `order ${request.orderId} not found`);
    }
    if (order.status !== ORDER_STATUS.RELEASED) {
      throw new HsmAdapterError('SCORDER_NOT_RELEASED',
        `order ${request.orderId} status is ${order.status}, expected released`);
    }
    if (!request.targetChainId || typeof request.targetChainId !== 'string') {
      throw new HsmAdapterError('SCORDER_SETTLE_CHAIN_MISSING', 'targetChainId is required for settlement');
    }
    if (request.targetChainId !== order.targetChainId) {
      throw new HsmAdapterError('SCORDER_SETTLE_CHAIN_MISMATCH',
        `settlement chain ${request.targetChainId} does not match order target ${order.targetChainId}`);
    }
    const now = Math.floor(Date.now() / 1000);
    const settlementId = request.settlementId || `settle-${crypto.randomBytes(4).toString('hex')}`;
    const settlement = {
      settlementId,
      orderId: request.orderId,
      targetChainId: request.targetChainId,
      settlementProofHash: request.settlementProofHash || crypto.createHash('sha256')
        .update(`${request.orderId}:${request.targetChainId}:${now}`)
        .digest('hex'),
      settledAt: now,
    };
    order.status = ORDER_STATUS.SETTLED;
    order.settlementStatus = 'settled';
    order.settledAt = now;
    this._settlements.set(request.orderId, settlement);
    this._settleCount++;
    if (this._audit) {
      this._audit('SCORDER_SETTLED', { ...settlement });
    }
    return settlement;
  }

  /**
   * Aggregate committee signatures for escrow release.
   * @param {string} orderId
   * @param {object[]} partialSignatures - Array of {peerId, signature}
   * @returns {object}
   */
  aggregateCommitteeSignatures(orderId, partialSignatures) {
    const order = this._orders.get(orderId);
    if (!order) {
      throw new HsmAdapterError('SCORDER_NOT_FOUND', `order ${orderId} not found`);
    }
    if (!Array.isArray(partialSignatures) || partialSignatures.length === 0) {
      throw new HsmAdapterError('SCORDER_NO_SIGNATURES', 'partialSignatures array is required');
    }
    if (partialSignatures.length < (this.policy.minOrderMatchingQuorum || 3)) {
      throw new HsmAdapterError('SCORDER_RELEASE_QUORUM_INSUFFICIENT',
        `${partialSignatures.length} signatures below minimum ${this.policy.minOrderMatchingQuorum || 3}`);
    }
    const aggregatedSig = crypto.createHash('sha256')
      .update(partialSignatures.map(s => s.signature).join(':'))
      .digest('hex');
    const result = {
      orderId,
      signatureCount: partialSignatures.length,
      aggregatedSignature: aggregatedSig,
      participantIds: partialSignatures.map(s => s.peerId || 'anonymous'),
      aggregatedAt: Math.floor(Date.now() / 1000),
    };
    if (this._audit) {
      this._audit('SCORDER_SIGNATURES_AGGREGATED', { orderId, count: partialSignatures.length });
    }
    return result;
  }

  /**
   * Cancel an order (only if not yet released).
   * @param {string} orderId
   * @returns {object}
   */
  cancelOrder(orderId) {
    const order = this._orders.get(orderId);
    if (!order) {
      throw new HsmAdapterError('SCORDER_NOT_FOUND', `order ${orderId} not found`);
    }
    if (order.status === ORDER_STATUS.RELEASED || order.status === ORDER_STATUS.SETTLED) {
      throw new HsmAdapterError('SCORDER_ALREADY_RELEASED',
        `order ${orderId} has been released/settled and cannot be cancelled`);
    }
    if (order.status === ORDER_STATUS.CANCELLED) {
      throw new HsmAdapterError('SCORDER_ALREADY_CANCELLED',
        `order ${orderId} is already cancelled`);
    }
    order.status = ORDER_STATUS.CANCELLED;
    order.cancelledAt = Math.floor(Date.now() / 1000);
    this._cancelCount++;
    if (this._audit) {
      this._audit('SCORDER_CANCELLED', { orderId });
    }
    return { orderId, cancelled: true };
  }

  /**
   * Get a settlement record by order id.
   * @param {string} orderId
   * @returns {object|null}
   */
  getSettlement(orderId) {
    return this._settlements.get(orderId) || null;
  }

  /**
   * Get all orders (metadata only).
   * @returns {object[]}
   */
  getOrders() {
    return Array.from(this._orders.values()).map(o => ({
      orderId: o.orderId,
      sourceTenantId: o.sourceTenantId,
      targetChainId: o.targetChainId,
      status: o.status,
      deliveryEpochs: o.deliveryEpochs,
      escrowFundingCap: o.escrowFundingCap,
      milestoneVerified: o.milestoneVerified,
    }));
  }

  /**
   * Get the current order count.
   * @returns {number}
   */
  getOrderCount() {
    return this._orders.size;
  }

  /**
   * Get summary statistics.
   * @returns {object}
   */
  getStats() {
    const ordersByStatus = {};
    for (const o of this._orders.values()) {
      ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1;
    }
    return {
      totalOrders: this._orders.size,
      totalSettlements: this._settlements.size,
      totalRebalances: this._rebalances.size,
      ordersByStatus,
      initCount: this._initCount,
      releaseCount: this._releaseCount,
      settleCount: this._settleCount,
      rebalanceCount: this._rebalanceCount,
      cancelCount: this._cancelCount,
    };
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

module.exports = {
  PqcSupplyChainEscrowHub,
  ORDER_STATUS,
  REBALANCE_DIRECTION,
};
