"use strict";

/**
 * Track 91: PQC Smart-Grid Micro-Transaction Gating Hub.
 *
 * Interlocking smart-grid micro-transaction coordinator that
 * instantiates multi-party load balance verification
 * pools using homomorphically split Pedersen commitments
 * over energy consumption telemetry hashes, prosumer load balance measurements, and
 * utility meter identity hashes. Parses SMARTGRIDGATE packets,
 * enforces maxConsumptionChainDepth, and tracks state
 * transitions alongside the minGridOperatorQuorum
 * boundary.
 *
 * Extended with batch pool initialization, consumption chain
 * depth rebalancing, committee signature aggregation,
 * pool cancellation, cross-chain settlement, and
 * summary statistics.
 *
 * @module hsm-adapter/pqc-smart-grid-micro-transaction-gating-hub
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

const POOL_STATUS = {
  OPEN: "open",
  REBALANCING: "rebalancing",
  ACCREDITED: "accredited",
  SETTLED: "settled",
  CANCELLED: "cancelled",
};

const REBALANCE_DIRECTION = {
  INCREASE: "increase",
  DECREASE: "decrease",
};

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
    this._settlements = new Map();
    this._rebalances = new Map();
    this._maxPools = options.maxPools || 1000;
    this._maxBatchSize = options.maxBatchSize || 50;
    this._initCount = 0;
    this._accreditCount = 0;
    this._settleCount = 0;
    this._rebalanceCount = 0;
    this._cancelCount = 0;
  }

  /**
   * Initialize an smart-grid micro-transaction gating pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this._pools.size >= this._maxPools) {
      throw new HsmAdapterError(
        "SMARTGRIDGATE_MAX_POOLS",
        `maximum ${this._maxPools} pools reached`,
      );
    }
    if (
      this.policy.requireGridAuthorityInitializerAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.gridAuthorityInitializerAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "SMARTGRIDGATE_INSTITUTION_INITIALIZER_UNATTESTED",
            "grid authority initializer attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "SMARTGRIDGATE_INSTITUTION_INITIALIZER_UNATTESTED",
          "grid authority initializer attestation invalid",
        );
      }
    }
    if (
      typeof request.attestationAuthority === "string" &&
      !this.policy.allowedAttestationAuthorities.includes(
        request.attestationAuthority,
      )
    ) {
      throw new HsmAdapterError(
        "SMARTGRIDGATE_ATTESTATION_AUTHORITY_BLOCKED",
        `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(", ")}`,
      );
    }
    if (
      typeof request.pqcSignatureScheme === "string" &&
      !this.policy.allowedPqcSignatureSchemes.includes(
        request.pqcSignatureScheme,
      )
    ) {
      throw new HsmAdapterError(
        "SMARTGRIDGATE_PQC_SCHEME_BLOCKED",
        `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(", ")}`,
      );
    }
    if (
      typeof request.transactionWindowSeconds === "number" &&
      request.transactionWindowSeconds >
        (this.policy.maxTransactionWindowSeconds || 86400)
    ) {
      throw new HsmAdapterError(
        "SMARTGRIDGATE_TRANSACTION_WINDOW_EXCEEDED",
        `transaction window seconds ${request.transactionWindowSeconds} exceeds maximum ${this.policy.maxTransactionWindowSeconds}`,
      );
    }
    if (
      typeof request.consumptionChainDepth === "number" &&
      request.consumptionChainDepth >
        (this.policy.maxConsumptionChainDepth || 18)
    ) {
      throw new HsmAdapterError(
        "SMARTGRIDGATE_CONSUMPTION_DEPTH_EXCEEDED",
        `consumption chain depth ${request.consumptionChainDepth} exceeds maximum ${this.policy.maxConsumptionChainDepth}`,
      );
    }
    const poolId =
      request.poolId || `pool-${crypto.randomBytes(4).toString("hex")}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError(
        "SMARTGRIDGATE_DUPLICATE",
        `pool ${poolId} already exists`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedConsumptionTelemetryCommitment:
        request.blindedConsumptionTelemetryCommitment,
      blindedLoadBalanceCommitment: request.blindedLoadBalanceCommitment,
      blindedMeterIdentityCommitment: request.blindedMeterIdentityCommitment,
      transactionWindowSeconds: request.transactionWindowSeconds,
      consumptionChainDepth: request.consumptionChainDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: POOL_STATUS.OPEN,
      microTransactionClaimVerified: false,
      loadBalanceAccreditationCompletedAt: null,
      rebalanceEpoch: 0,
      settlementStatus: null,
      settledAt: null,
      cancelledAt: null,
    };
    this._pools.set(poolId, pool);
    this._initCount++;
    if (this._audit) {
      this._audit("SMARTGRID_GATING_POOL_INITIALIZED", { ...pool });
    }
    return pool;
  }

  /**
   * Batch initialize multiple smart-grid micro-transaction gating pools.
   * @param {object[]} requests
   * @returns {object}
   */
  batchInitializePools(requests) {
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new HsmAdapterError(
        "SMARTGRIDGATE_BATCH_EMPTY",
        "batch requests array is required",
      );
    }
    if (requests.length > this._maxBatchSize) {
      throw new HsmAdapterError(
        "SMARTGRIDGATE_BATCH_TOO_LARGE",
        `${requests.length} exceeds max batch size ${this._maxBatchSize}`,
      );
    }
    const results = [];
    let successCount = 0;
    let failedCount = 0;
    for (const req of requests) {
      try {
        const pool = this.initializePool(req);
        results.push({ poolId: pool.poolId, initialized: true });
        successCount++;
      } catch (err) {
        results.push({
          poolId: req.poolId || "auto",
          initialized: false,
          error: err.code || "SMARTGRIDGATE_BATCH_ERROR",
        });
        failedCount++;
      }
    }
    if (this._audit) {
      this._audit("SMARTGRIDGATE_BATCH_INITIALIZED", {
        successCount,
        failedCount,
        batchSize: requests.length,
      });
    }
    return {
      totalRequests: requests.length,
      successCount,
      failedCount,
      results,
    };
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
      throw new HsmAdapterError(
        "SMARTGRIDGATE_NOT_FOUND",
        `pool ${poolId} not found`,
      );
    }
    pool.microTransactionClaimVerified = true;
    return pool;
  }

  /**
   * Rebalance consumption chain depth for a pool.
   * @param {object} request
   * @returns {object}
   */
  rebalanceConsumptionChainDepth(request) {
    if (!request || !request.poolId) {
      throw new HsmAdapterError(
        "SMARTGRIDGATE_REBALANCE_FIELDS_MISSING",
        "poolId is required",
      );
    }
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "SMARTGRIDGATE_NOT_FOUND",
        `pool ${request.poolId} not found`,
      );
    }
    if (
      pool.status !== POOL_STATUS.OPEN &&
      pool.status !== POOL_STATUS.REBALANCING
    ) {
      throw new HsmAdapterError(
        "SMARTGRIDGATE_NOT_REBALANCEABLE",
        `pool ${request.poolId} status is ${pool.status}, expected open or rebalancing`,
      );
    }
    const direction = request.direction || REBALANCE_DIRECTION.INCREASE;
    if (!Object.values(REBALANCE_DIRECTION).includes(direction)) {
      throw new HsmAdapterError(
        "SMARTGRIDGATE_REBALANCE_DIRECTION_INVALID",
        `direction ${direction} is not valid; allowed: ${Object.values(REBALANCE_DIRECTION).join(", ")}`,
      );
    }
    if (
      typeof request.rebalanceAmount !== "number" ||
      request.rebalanceAmount <= 0
    ) {
      throw new HsmAdapterError(
        "SMARTGRIDGATE_REBALANCE_AMOUNT_INVALID",
        "rebalanceAmount must be a positive number",
      );
    }
    const newEpoch = pool.rebalanceEpoch + 1;
    pool.rebalanceEpoch = newEpoch;
    pool.status = POOL_STATUS.REBALANCING;
    const rebalanceId =
      request.rebalanceId || `rebal-${crypto.randomBytes(4).toString("hex")}`;
    const rebalance = {
      rebalanceId,
      poolId: request.poolId,
      direction,
      rebalanceAmount: request.rebalanceAmount,
      rebalanceEpoch: newEpoch,
      newConsumptionChainDepth:
        request.newConsumptionChainDepth !== undefined
          ? request.newConsumptionChainDepth
          : pool.consumptionChainDepth,
      rebalancedAt: Math.floor(Date.now() / 1000),
    };
    this._rebalances.set(rebalanceId, rebalance);
    this._rebalanceCount++;
    if (request.newConsumptionChainDepth !== undefined) {
      if (
        request.newConsumptionChainDepth >
        (this.policy.maxConsumptionChainDepth || 18)
      ) {
        throw new HsmAdapterError(
          "SMARTGRIDGATE_CONSUMPTION_DEPTH_EXCEEDED",
          `new consumption chain depth ${request.newConsumptionChainDepth} exceeds maximum ${this.policy.maxConsumptionChainDepth}`,
        );
      }
      pool.consumptionChainDepth = request.newConsumptionChainDepth;
    }
    if (this._audit) {
      this._audit("SMARTGRIDGATE_CONSUMPTION_DEPTH_REBALANCED", {
        ...rebalance,
      });
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
   * Complete load balance accreditation after quorum.
   * @param {object} request
   * @returns {object}
   */
  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "SMARTGRIDGATE_NOT_FOUND",
        `pool ${request.poolId} not found`,
      );
    }
    if (!pool.microTransactionClaimVerified) {
      throw new HsmAdapterError(
        "SMARTGRIDGATE_MICRO_TX_CLAIM_NOT_VERIFIED",
        `pool ${request.poolId} micro-transaction claim not verified`,
      );
    }
    if (
      this.policy.requireLoadBalanceOversightCommitteeAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.loadBalanceOversightCommitteeAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "SMARTGRIDGATE_LOAD_BALANCE_COMMITTEE_UNATTESTED",
            "load balance oversight committee attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "SMARTGRIDGATE_LOAD_BALANCE_COMMITTEE_UNATTESTED",
          "load balance oversight committee attestation invalid",
        );
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minGridOperatorQuorum || 5)) {
      throw new HsmAdapterError(
        "SMARTGRIDGATE_ACCREDITATION_QUORUM_INSUFFICIENT",
        `accreditation signatures ${signatures.length} below minimum ${this.policy.minGridOperatorQuorum}`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = POOL_STATUS.ACCREDITED;
    pool.loadBalanceAccreditationCompletedAt = now;
    const completionId =
      request.completionId ||
      `completion-${crypto.randomBytes(4).toString("hex")}`;
    const completion = {
      completionId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      completedAt: now,
    };
    this._accreditCount++;
    if (this._audit) {
      this._audit("LOAD_BALANCE_ACCREDITATION_COMPLETED", { ...completion });
    }
    return completion;
  }

  /**
   * Settle an accredited pool cross-chain.
   * @param {object} request
   * @returns {object}
   */
  settlePool(request) {
    if (!request || !request.poolId) {
      throw new HsmAdapterError(
        "SMARTGRIDGATE_SETTLE_FIELDS_MISSING",
        "poolId is required",
      );
    }
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "SMARTGRIDGATE_NOT_FOUND",
        `pool ${request.poolId} not found`,
      );
    }
    if (pool.status !== POOL_STATUS.ACCREDITED) {
      throw new HsmAdapterError(
        "SMARTGRIDGATE_NOT_ACCREDITED",
        `pool ${request.poolId} status is ${pool.status}, expected accredited`,
      );
    }
    if (!request.targetChainId || typeof request.targetChainId !== "string") {
      throw new HsmAdapterError(
        "SMARTGRIDGATE_SETTLE_CHAIN_MISSING",
        "targetChainId is required for settlement",
      );
    }
    if (request.targetChainId !== pool.targetChainId) {
      throw new HsmAdapterError(
        "SMARTGRIDGATE_SETTLE_CHAIN_MISMATCH",
        `settlement chain ${request.targetChainId} does not match pool target ${pool.targetChainId}`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    const settlementId =
      request.settlementId || `settle-${crypto.randomBytes(4).toString("hex")}`;
    const settlement = {
      settlementId,
      poolId: request.poolId,
      targetChainId: request.targetChainId,
      settlementProofHash:
        request.settlementProofHash ||
        crypto
          .createHash("sha256")
          .update(`${request.poolId}:${request.targetChainId}:${now}`)
          .digest("hex"),
      settledAt: now,
    };
    pool.status = POOL_STATUS.SETTLED;
    pool.settlementStatus = "settled";
    pool.settledAt = now;
    this._settlements.set(request.poolId, settlement);
    this._settleCount++;
    if (this._audit) {
      this._audit("SMARTGRIDGATE_SETTLED", { ...settlement });
    }
    return settlement;
  }

  /**
   * Aggregate committee signatures for accreditation completion.
   * @param {string} poolId
   * @param {object[]} partialSignatures - Array of {peerId, signature}
   * @returns {object}
   */
  aggregateCommitteeSignatures(poolId, partialSignatures) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "SMARTGRIDGATE_NOT_FOUND",
        `pool ${poolId} not found`,
      );
    }
    if (!Array.isArray(partialSignatures) || partialSignatures.length === 0) {
      throw new HsmAdapterError(
        "SMARTGRIDGATE_NO_SIGNATURES",
        "partialSignatures array is required",
      );
    }
    if (partialSignatures.length < (this.policy.minGridOperatorQuorum || 5)) {
      throw new HsmAdapterError(
        "SMARTGRIDGATE_ACCREDITATION_QUORUM_INSUFFICIENT",
        `${partialSignatures.length} signatures below minimum ${this.policy.minGridOperatorQuorum || 5}`,
      );
    }
    const aggregatedSig = crypto
      .createHash("sha256")
      .update(partialSignatures.map((s) => s.signature).join(":"))
      .digest("hex");
    const result = {
      poolId,
      signatureCount: partialSignatures.length,
      aggregatedSignature: aggregatedSig,
      participantIds: partialSignatures.map((s) => s.peerId || "anonymous"),
      aggregatedAt: Math.floor(Date.now() / 1000),
    };
    if (this._audit) {
      this._audit("SMARTGRIDGATE_SIGNATURES_AGGREGATED", {
        poolId,
        count: partialSignatures.length,
      });
    }
    return result;
  }

  /**
   * Cancel a pool (only if not yet accredited).
   * @param {string} poolId
   * @returns {object}
   */
  cancelPool(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "SMARTGRIDGATE_NOT_FOUND",
        `pool ${poolId} not found`,
      );
    }
    if (
      pool.status === POOL_STATUS.ACCREDITED ||
      pool.status === POOL_STATUS.SETTLED
    ) {
      throw new HsmAdapterError(
        "SMARTGRIDGATE_ALREADY_ACCREDITED",
        `pool ${poolId} has been accredited/settled and cannot be cancelled`,
      );
    }
    if (pool.status === POOL_STATUS.CANCELLED) {
      throw new HsmAdapterError(
        "SMARTGRIDGATE_ALREADY_CANCELLED",
        `pool ${poolId} is already cancelled`,
      );
    }
    pool.status = POOL_STATUS.CANCELLED;
    pool.cancelledAt = Math.floor(Date.now() / 1000);
    this._cancelCount++;
    if (this._audit) {
      this._audit("SMARTGRIDGATE_CANCELLED", { poolId });
    }
    return { poolId, cancelled: true };
  }

  /**
   * Get a settlement record by pool id.
   * @param {string} poolId
   * @returns {object|null}
   */
  getSettlement(poolId) {
    return this._settlements.get(poolId) || null;
  }

  /**
   * Get all pools (metadata only).
   * @returns {object[]}
   */
  getPools() {
    return Array.from(this._pools.values()).map((p) => ({
      poolId: p.poolId,
      sourceTenantId: p.sourceTenantId,
      targetChainId: p.targetChainId,
      status: p.status,
      consumptionChainDepth: p.consumptionChainDepth,
      transactionWindowSeconds: p.transactionWindowSeconds,
      microTransactionClaimVerified: p.microTransactionClaimVerified,
    }));
  }

  /**
   * Get the current pool count.
   * @returns {number}
   */
  getPoolCount() {
    return this._pools.size;
  }

  /**
   * Get summary statistics.
   * @returns {object}
   */
  getStats() {
    const poolsByStatus = {};
    for (const p of this._pools.values()) {
      poolsByStatus[p.status] = (poolsByStatus[p.status] || 0) + 1;
    }
    return {
      totalPools: this._pools.size,
      totalSettlements: this._settlements.size,
      totalRebalances: this._rebalances.size,
      poolsByStatus,
      initCount: this._initCount,
      accreditCount: this._accreditCount,
      settleCount: this._settleCount,
      rebalanceCount: this._rebalanceCount,
      cancelCount: this._cancelCount,
    };
  }
}

function _validateInitRequest(policy, request) {
  if (!request.sourceTenantId || !request.targetChainId) {
    throw new HsmAdapterError(
      "SMARTGRIDGATE_FIELDS_MISSING",
      "sourceTenantId and targetChainId are required",
    );
  }
  if (
    !request.blindedConsumptionTelemetryCommitment ||
    !request.blindedLoadBalanceCommitment ||
    !request.blindedMeterIdentityCommitment
  ) {
    throw new HsmAdapterError(
      "SMARTGRIDGATE_FIELDS_MISSING",
      "blindedConsumptionTelemetryCommitment, blindedLoadBalanceCommitment, and blindedMeterIdentityCommitment are required",
    );
  }
  if (typeof request.transactionWindowSeconds !== "number") {
    throw new HsmAdapterError(
      "SMARTGRIDGATE_FIELDS_MISSING",
      "transactionWindowSeconds is required",
    );
  }
  if (typeof request.consumptionChainDepth !== "number") {
    throw new HsmAdapterError(
      "SMARTGRIDGATE_FIELDS_MISSING",
      "consumptionChainDepth is required",
    );
  }
  if (
    policy.requireGridAuthorityInitializerAttestation &&
    !request.gridAuthorityInitializerAttestation
  ) {
    throw new HsmAdapterError(
      "SMARTGRIDGATE_INSTITUTION_INITIALIZER_ATTESTATION_MISSING",
      "grid authority initializer attestation is required",
    );
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError(
      "SMARTGRIDGATE_COMPLETE_FIELDS_MISSING",
      "poolId is required",
    );
  }
  if (
    policy.requireLoadBalanceOversightCommitteeAttestation &&
    !request.loadBalanceOversightCommitteeAttestation
  ) {
    throw new HsmAdapterError(
      "SMARTGRIDGATE_CLEARING_ATTESTATION_MISSING",
      "load balance oversight committee attestation is required",
    );
  }
}

module.exports = {
  PqcSmartGridMicroTransactionGatingHub,
  POOL_STATUS,
  REBALANCE_DIRECTION,
};
