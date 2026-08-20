"use strict";

/**
 * Track 69: PQC Real Estate Tokenization Hub.
 *
 * Interlocking title deed coordinator that instantiates
 * multi-party asset pools using homomorphically split
 * Pedersen commitments over real-estate values,
 * encumbrance balances, and fractional share allocations.
 * Parses REPOOL packets, enforces maxAssetValuationCap, and
 * tracks state transitions alongside the minCoSignerQuorum
 * boundary.
 *
 * Extended with batch pool initialization, valuation
 * rebalancing, committee signature aggregation, pool
 * cancellation, cross-chain settlement, and summary
 * statistics.
 *
 * @module hsm-adapter/pqc-real-estate-tokenization-hub
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

const POOL_STATUS = {
  OPEN: "open",
  REBALANCING: "rebalancing",
  FINALIZED: "finalized",
  SETTLED: "settled",
  CANCELLED: "cancelled",
};

const REBALANCE_DIRECTION = {
  INCREASE: "increase",
  DECREASE: "decrease",
};

class PqcRealEstateTokenizationHub {
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
    this._transferCount = 0;
    this._settleCount = 0;
    this._rebalanceCount = 0;
    this._cancelCount = 0;
  }

  /**
   * Initialize a real-estate tokenization pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this._pools.size >= this._maxPools) {
      throw new HsmAdapterError(
        "REPOOL_MAX_POOLS",
        `maximum ${this._maxPools} pools reached`,
      );
    }
    if (
      this.policy.requireAssetInitializerAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.assetInitializerAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "REPOOL_ASSET_INITIALIZER_UNATTESTED",
            "asset initializer attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "REPOOL_ASSET_INITIALIZER_UNATTESTED",
          "asset initializer attestation invalid",
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
        "REPOOL_ATTESTATION_AUTHORITY_BLOCKED",
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
        "REPOOL_PQC_SCHEME_BLOCKED",
        `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(", ")}`,
      );
    }
    if (
      typeof request.legalDisputeSeconds === "number" &&
      request.legalDisputeSeconds >
        (this.policy.maxLegalDisputeSeconds || 2592000)
    ) {
      throw new HsmAdapterError(
        "REPOOL_LEGAL_DISPUTE_WINDOW_EXCEEDED",
        `legal dispute seconds ${request.legalDisputeSeconds} exceeds maximum ${this.policy.maxLegalDisputeSeconds}`,
      );
    }
    if (
      typeof request.assetValuationCap === "number" &&
      request.assetValuationCap >
        (this.policy.maxAssetValuationCap || 1000000000)
    ) {
      throw new HsmAdapterError(
        "REPOOL_ASSET_VALUATION_CAP_EXCEEDED",
        `asset valuation cap ${request.assetValuationCap} exceeds maximum ${this.policy.maxAssetValuationCap}`,
      );
    }
    const poolId =
      request.poolId || `pool-${crypto.randomBytes(4).toString("hex")}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError(
        "REPOOL_DUPLICATE",
        `pool ${poolId} already exists`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedRealEstateValueCommitment:
        request.blindedRealEstateValueCommitment,
      blindedEncumbranceBalanceCommitment:
        request.blindedEncumbranceBalanceCommitment,
      blindedFractionalShareCommitment:
        request.blindedFractionalShareCommitment,
      legalDisputeSeconds: request.legalDisputeSeconds,
      assetValuationCap: request.assetValuationCap || 0,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: POOL_STATUS.OPEN,
      encumbranceClearanceVerified: false,
      transferFinalizedAt: null,
      rebalanceEpoch: 0,
      settlementStatus: null,
      settledAt: null,
      cancelledAt: null,
    };
    this._pools.set(poolId, pool);
    this._initCount++;
    if (this._audit) {
      this._audit("REAL_ESTATE_POOL_INITIALIZED", { ...pool });
    }
    return pool;
  }

  /**
   * Batch initialize multiple real-estate tokenization pools.
   * @param {object[]} requests
   * @returns {object}
   */
  batchInitializePools(requests) {
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new HsmAdapterError(
        "REPOOL_BATCH_EMPTY",
        "batch requests array is required",
      );
    }
    if (requests.length > this._maxBatchSize) {
      throw new HsmAdapterError(
        "REPOOL_BATCH_TOO_LARGE",
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
          error: err.code || "REPOOL_BATCH_ERROR",
        });
        failedCount++;
      }
    }
    if (this._audit) {
      this._audit("REPOOL_BATCH_INITIALIZED", {
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
   * Mark a pool as encumbrance-clearance-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markEncumbranceClearanceVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError("REPOOL_NOT_FOUND", `pool ${poolId} not found`);
    }
    pool.encumbranceClearanceVerified = true;
    return pool;
  }

  /**
   * Rebalance asset valuation for a pool.
   * @param {object} request
   * @returns {object}
   */
  rebalanceValuation(request) {
    if (!request || !request.poolId) {
      throw new HsmAdapterError(
        "REPOOL_REBALANCE_FIELDS_MISSING",
        "poolId is required",
      );
    }
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "REPOOL_NOT_FOUND",
        `pool ${request.poolId} not found`,
      );
    }
    if (
      pool.status !== POOL_STATUS.OPEN &&
      pool.status !== POOL_STATUS.REBALANCING
    ) {
      throw new HsmAdapterError(
        "REPOOL_NOT_REBALANCEABLE",
        `pool ${request.poolId} status is ${pool.status}, expected open or rebalancing`,
      );
    }
    const direction = request.direction || REBALANCE_DIRECTION.INCREASE;
    if (!Object.values(REBALANCE_DIRECTION).includes(direction)) {
      throw new HsmAdapterError(
        "REPOOL_REBALANCE_DIRECTION_INVALID",
        `direction ${direction} is not valid; allowed: ${Object.values(REBALANCE_DIRECTION).join(", ")}`,
      );
    }
    if (
      typeof request.rebalanceAmount !== "number" ||
      request.rebalanceAmount <= 0
    ) {
      throw new HsmAdapterError(
        "REPOOL_REBALANCE_AMOUNT_INVALID",
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
      newAssetValuationCap:
        request.newAssetValuationCap || pool.assetValuationCap,
      rebalancedAt: Math.floor(Date.now() / 1000),
    };
    this._rebalances.set(rebalanceId, rebalance);
    this._rebalanceCount++;
    if (request.newAssetValuationCap !== undefined) {
      pool.assetValuationCap = request.newAssetValuationCap;
    }
    if (this._audit) {
      this._audit("REPOOL_VALUATION_REBALANCED", { ...rebalance });
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
   * Finalize a title deed transfer after quorum.
   * @param {object} request
   * @returns {object}
   */
  finalizeTitleDeedTransfer(request) {
    _validateTransferRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "REPOOL_NOT_FOUND",
        `pool ${request.poolId} not found`,
      );
    }
    if (!pool.encumbranceClearanceVerified) {
      throw new HsmAdapterError(
        "REPOOL_ENCUMBRANCE_NOT_VERIFIED",
        `pool ${request.poolId} encumbrance clearance not verified`,
      );
    }
    if (
      this.policy.requireClearingCommitteeAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.clearingCommitteeAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "REPOOL_CLEARING_COMMITTEE_UNATTESTED",
            "clearing committee attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "REPOOL_CLEARING_COMMITTEE_UNATTESTED",
          "clearing committee attestation invalid",
        );
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minCoSignerQuorum || 3)) {
      throw new HsmAdapterError(
        "REPOOL_TRANSFER_QUORUM_INSUFFICIENT",
        `co-signer signatures ${signatures.length} below minimum ${this.policy.minCoSignerQuorum}`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = POOL_STATUS.FINALIZED;
    pool.transferFinalizedAt = now;
    const transferId =
      request.transferId || `transfer-${crypto.randomBytes(4).toString("hex")}`;
    const transfer = {
      transferId,
      poolId: request.poolId,
      coSignerSignatureCount: signatures.length,
      finalizedAt: now,
    };
    this._transferCount++;
    if (this._audit) {
      this._audit("TITLE_DEED_TRANSFER_FINALIZED", { ...transfer });
    }
    return transfer;
  }

  /**
   * Settle a finalized pool cross-chain.
   * @param {object} request
   * @returns {object}
   */
  settlePool(request) {
    if (!request || !request.poolId) {
      throw new HsmAdapterError(
        "REPOOL_SETTLE_FIELDS_MISSING",
        "poolId is required",
      );
    }
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "REPOOL_NOT_FOUND",
        `pool ${request.poolId} not found`,
      );
    }
    if (pool.status !== POOL_STATUS.FINALIZED) {
      throw new HsmAdapterError(
        "REPOOL_NOT_FINALIZED",
        `pool ${request.poolId} status is ${pool.status}, expected finalized`,
      );
    }
    if (!request.targetChainId || typeof request.targetChainId !== "string") {
      throw new HsmAdapterError(
        "REPOOL_SETTLE_CHAIN_MISSING",
        "targetChainId is required for settlement",
      );
    }
    if (request.targetChainId !== pool.targetChainId) {
      throw new HsmAdapterError(
        "REPOOL_SETTLE_CHAIN_MISMATCH",
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
      this._audit("REPOOL_SETTLED", { ...settlement });
    }
    return settlement;
  }

  /**
   * Aggregate committee signatures for title deed transfer.
   * @param {string} poolId
   * @param {object[]} partialSignatures - Array of {peerId, signature}
   * @returns {object}
   */
  aggregateCommitteeSignatures(poolId, partialSignatures) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError("REPOOL_NOT_FOUND", `pool ${poolId} not found`);
    }
    if (!Array.isArray(partialSignatures) || partialSignatures.length === 0) {
      throw new HsmAdapterError(
        "REPOOL_NO_SIGNATURES",
        "partialSignatures array is required",
      );
    }
    if (partialSignatures.length < (this.policy.minCoSignerQuorum || 3)) {
      throw new HsmAdapterError(
        "REPOOL_TRANSFER_QUORUM_INSUFFICIENT",
        `${partialSignatures.length} signatures below minimum ${this.policy.minCoSignerQuorum || 3}`,
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
      this._audit("REPOOL_SIGNATURES_AGGREGATED", {
        poolId,
        count: partialSignatures.length,
      });
    }
    return result;
  }

  /**
   * Cancel a pool (only if not yet finalized).
   * @param {string} poolId
   * @returns {object}
   */
  cancelPool(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError("REPOOL_NOT_FOUND", `pool ${poolId} not found`);
    }
    if (
      pool.status === POOL_STATUS.FINALIZED ||
      pool.status === POOL_STATUS.SETTLED
    ) {
      throw new HsmAdapterError(
        "REPOOL_ALREADY_FINALIZED",
        `pool ${poolId} has been finalized/settled and cannot be cancelled`,
      );
    }
    if (pool.status === POOL_STATUS.CANCELLED) {
      throw new HsmAdapterError(
        "REPOOL_ALREADY_CANCELLED",
        `pool ${poolId} is already cancelled`,
      );
    }
    pool.status = POOL_STATUS.CANCELLED;
    pool.cancelledAt = Math.floor(Date.now() / 1000);
    this._cancelCount++;
    if (this._audit) {
      this._audit("REPOOL_CANCELLED", { poolId });
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
      legalDisputeSeconds: p.legalDisputeSeconds,
      assetValuationCap: p.assetValuationCap,
      encumbranceClearanceVerified: p.encumbranceClearanceVerified,
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
      transferCount: this._transferCount,
      settleCount: this._settleCount,
      rebalanceCount: this._rebalanceCount,
      cancelCount: this._cancelCount,
    };
  }
}

function _validateInitRequest(policy, request) {
  if (!request.sourceTenantId || !request.targetChainId) {
    throw new HsmAdapterError(
      "REPOOL_FIELDS_MISSING",
      "sourceTenantId and targetChainId are required",
    );
  }
  if (
    !request.blindedRealEstateValueCommitment ||
    !request.blindedEncumbranceBalanceCommitment ||
    !request.blindedFractionalShareCommitment
  ) {
    throw new HsmAdapterError(
      "REPOOL_FIELDS_MISSING",
      "blindedRealEstateValueCommitment, blindedEncumbranceBalanceCommitment, and blindedFractionalShareCommitment are required",
    );
  }
  if (typeof request.legalDisputeSeconds !== "number") {
    throw new HsmAdapterError(
      "REPOOL_FIELDS_MISSING",
      "legalDisputeSeconds is required",
    );
  }
  if (
    policy.requireAssetInitializerAttestation &&
    !request.assetInitializerAttestation
  ) {
    throw new HsmAdapterError(
      "REPOOL_ASSET_INITIALIZER_ATTESTATION_MISSING",
      "asset initializer attestation is required",
    );
  }
}

function _validateTransferRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError(
      "REPOOL_TRANSFER_FIELDS_MISSING",
      "poolId is required",
    );
  }
  if (
    policy.requireClearingCommitteeAttestation &&
    !request.clearingCommitteeAttestation
  ) {
    throw new HsmAdapterError(
      "REPOOL_CLEARING_ATTESTATION_MISSING",
      "clearing committee attestation is required",
    );
  }
}

module.exports = {
  PqcRealEstateTokenizationHub,
  POOL_STATUS,
  REBALANCE_DIRECTION,
};
