"use strict";

/**
 * Track 70: PQC Carbon Credit Tokenization Hub.
 *
 * Interlocking environmental asset coordinator that
 * instantiates multi-party offset pools using
 * homomorphically split Pedersen commitments over carbon
 * volumes, vintage certification metrics, and retired
 * allocations. Parses CARBONPOOL packets, enforces
 * maxCarbonTonnageCap, and tracks state transitions
 * alongside the minRetirementQuorum boundary.
 *
 * Extended with batch pool initialization, tonnage
 * rebalancing, committee signature aggregation, pool
 * cancellation, cross-chain settlement, and summary
 * statistics.
 *
 * @module hsm-adapter/pqc-carbon-credit-tokenization-hub
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

const POOL_STATUS = {
  OPEN: "open",
  REBALANCING: "rebalancing",
  RETIRED: "retired",
  SETTLED: "settled",
  CANCELLED: "cancelled",
};

const REBALANCE_DIRECTION = {
  INCREASE: "increase",
  DECREASE: "decrease",
};

class PqcCarbonCreditTokenizationHub {
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
    this._retireCount = 0;
    this._settleCount = 0;
    this._rebalanceCount = 0;
    this._cancelCount = 0;
  }

  /**
   * Initialize a carbon credit tokenization pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this._pools.size >= this._maxPools) {
      throw new HsmAdapterError(
        "CARBONPOOL_MAX_POOLS",
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
            "CARBONPOOL_ASSET_INITIALIZER_UNATTESTED",
            "asset initializer attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "CARBONPOOL_ASSET_INITIALIZER_UNATTESTED",
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
        "CARBONPOOL_ATTESTATION_AUTHORITY_BLOCKED",
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
        "CARBONPOOL_PQC_SCHEME_BLOCKED",
        `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(", ")}`,
      );
    }
    if (
      typeof request.vintageAgeSeconds === "number" &&
      request.vintageAgeSeconds > (this.policy.maxVintageAgeSeconds || 63072000)
    ) {
      throw new HsmAdapterError(
        "CARBONPOOL_VINTAGE_AGE_EXCEEDED",
        `vintage age seconds ${request.vintageAgeSeconds} exceeds maximum ${this.policy.maxVintageAgeSeconds}`,
      );
    }
    if (
      typeof request.carbonTonnageCap === "number" &&
      request.carbonTonnageCap > (this.policy.maxCarbonTonnageCap || 1000000000)
    ) {
      throw new HsmAdapterError(
        "CARBONPOOL_TONNAGE_CAP_EXCEEDED",
        `carbon tonnage cap ${request.carbonTonnageCap} exceeds maximum ${this.policy.maxCarbonTonnageCap}`,
      );
    }
    const poolId =
      request.poolId || `pool-${crypto.randomBytes(4).toString("hex")}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError(
        "CARBONPOOL_DUPLICATE",
        `pool ${poolId} already exists`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedCarbonVolumeCommitment: request.blindedCarbonVolumeCommitment,
      blindedVintageCertificationCommitment:
        request.blindedVintageCertificationCommitment,
      blindedRetiredAllocationCommitment:
        request.blindedRetiredAllocationCommitment,
      vintageAgeSeconds: request.vintageAgeSeconds,
      carbonTonnageCap: request.carbonTonnageCap || 0,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: POOL_STATUS.OPEN,
      retirementProofVerified: false,
      retirementFinalizedAt: null,
      rebalanceEpoch: 0,
      settlementStatus: null,
      settledAt: null,
      cancelledAt: null,
    };
    this._pools.set(poolId, pool);
    this._initCount++;
    if (this._audit) {
      this._audit("CARBON_POOL_INITIALIZED", { ...pool });
    }
    return pool;
  }

  /**
   * Batch initialize multiple carbon credit tokenization pools.
   * @param {object[]} requests
   * @returns {object}
   */
  batchInitializePools(requests) {
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new HsmAdapterError(
        "CARBONPOOL_BATCH_EMPTY",
        "batch requests array is required",
      );
    }
    if (requests.length > this._maxBatchSize) {
      throw new HsmAdapterError(
        "CARBONPOOL_BATCH_TOO_LARGE",
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
          error: err.code || "CARBONPOOL_BATCH_ERROR",
        });
        failedCount++;
      }
    }
    if (this._audit) {
      this._audit("CARBONPOOL_BATCH_INITIALIZED", {
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
   * Mark a pool as retirement-proof-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markRetirementProofVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "CARBONPOOL_NOT_FOUND",
        `pool ${poolId} not found`,
      );
    }
    pool.retirementProofVerified = true;
    return pool;
  }

  /**
   * Rebalance carbon tonnage for a pool.
   * @param {object} request
   * @returns {object}
   */
  rebalanceTonnage(request) {
    if (!request || !request.poolId) {
      throw new HsmAdapterError(
        "CARBONPOOL_REBALANCE_FIELDS_MISSING",
        "poolId is required",
      );
    }
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "CARBONPOOL_NOT_FOUND",
        `pool ${request.poolId} not found`,
      );
    }
    if (
      pool.status !== POOL_STATUS.OPEN &&
      pool.status !== POOL_STATUS.REBALANCING
    ) {
      throw new HsmAdapterError(
        "CARBONPOOL_NOT_REBALANCEABLE",
        `pool ${request.poolId} status is ${pool.status}, expected open or rebalancing`,
      );
    }
    const direction = request.direction || REBALANCE_DIRECTION.INCREASE;
    if (!Object.values(REBALANCE_DIRECTION).includes(direction)) {
      throw new HsmAdapterError(
        "CARBONPOOL_REBALANCE_DIRECTION_INVALID",
        `direction ${direction} is not valid; allowed: ${Object.values(REBALANCE_DIRECTION).join(", ")}`,
      );
    }
    if (
      typeof request.rebalanceAmount !== "number" ||
      request.rebalanceAmount <= 0
    ) {
      throw new HsmAdapterError(
        "CARBONPOOL_REBALANCE_AMOUNT_INVALID",
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
      newCarbonTonnageCap: request.newCarbonTonnageCap || pool.carbonTonnageCap,
      rebalancedAt: Math.floor(Date.now() / 1000),
    };
    this._rebalances.set(rebalanceId, rebalance);
    this._rebalanceCount++;
    if (request.newCarbonTonnageCap !== undefined) {
      pool.carbonTonnageCap = request.newCarbonTonnageCap;
    }
    if (this._audit) {
      this._audit("CARBONPOOL_TONNAGE_REBALANCED", { ...rebalance });
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
   * Finalize a carbon credit retirement after quorum.
   * @param {object} request
   * @returns {object}
   */
  finalizeRetirement(request) {
    _validateFinalizeRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "CARBONPOOL_NOT_FOUND",
        `pool ${request.poolId} not found`,
      );
    }
    if (!pool.retirementProofVerified) {
      throw new HsmAdapterError(
        "CARBONPOOL_RETIREMENT_PROOF_NOT_VERIFIED",
        `pool ${request.poolId} retirement proof not verified`,
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
            "CARBONPOOL_CLEARING_COMMITTEE_UNATTESTED",
            "clearing committee attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "CARBONPOOL_CLEARING_COMMITTEE_UNATTESTED",
          "clearing committee attestation invalid",
        );
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minRetirementQuorum || 3)) {
      throw new HsmAdapterError(
        "CARBONPOOL_RETIREMENT_QUORUM_INSUFFICIENT",
        `retirement signatures ${signatures.length} below minimum ${this.policy.minRetirementQuorum}`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = POOL_STATUS.RETIRED;
    pool.retirementFinalizedAt = now;
    const finalizationId =
      request.finalizationId ||
      `finalize-${crypto.randomBytes(4).toString("hex")}`;
    const finalization = {
      finalizationId,
      poolId: request.poolId,
      retirementSignatureCount: signatures.length,
      finalizedAt: now,
    };
    this._retireCount++;
    if (this._audit) {
      this._audit("CARBON_CREDIT_RETIREMENT_FINALIZED", { ...finalization });
    }
    return finalization;
  }

  /**
   * Settle a retired pool cross-chain.
   * @param {object} request
   * @returns {object}
   */
  settlePool(request) {
    if (!request || !request.poolId) {
      throw new HsmAdapterError(
        "CARBONPOOL_SETTLE_FIELDS_MISSING",
        "poolId is required",
      );
    }
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "CARBONPOOL_NOT_FOUND",
        `pool ${request.poolId} not found`,
      );
    }
    if (pool.status !== POOL_STATUS.RETIRED) {
      throw new HsmAdapterError(
        "CARBONPOOL_NOT_RETIRED",
        `pool ${request.poolId} status is ${pool.status}, expected retired`,
      );
    }
    if (!request.targetChainId || typeof request.targetChainId !== "string") {
      throw new HsmAdapterError(
        "CARBONPOOL_SETTLE_CHAIN_MISSING",
        "targetChainId is required for settlement",
      );
    }
    if (request.targetChainId !== pool.targetChainId) {
      throw new HsmAdapterError(
        "CARBONPOOL_SETTLE_CHAIN_MISMATCH",
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
      this._audit("CARBONPOOL_SETTLED", { ...settlement });
    }
    return settlement;
  }

  /**
   * Aggregate committee signatures for retirement finalization.
   * @param {string} poolId
   * @param {object[]} partialSignatures - Array of {peerId, signature}
   * @returns {object}
   */
  aggregateCommitteeSignatures(poolId, partialSignatures) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "CARBONPOOL_NOT_FOUND",
        `pool ${poolId} not found`,
      );
    }
    if (!Array.isArray(partialSignatures) || partialSignatures.length === 0) {
      throw new HsmAdapterError(
        "CARBONPOOL_NO_SIGNATURES",
        "partialSignatures array is required",
      );
    }
    if (partialSignatures.length < (this.policy.minRetirementQuorum || 3)) {
      throw new HsmAdapterError(
        "CARBONPOOL_RETIREMENT_QUORUM_INSUFFICIENT",
        `${partialSignatures.length} signatures below minimum ${this.policy.minRetirementQuorum || 3}`,
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
      this._audit("CARBONPOOL_SIGNATURES_AGGREGATED", {
        poolId,
        count: partialSignatures.length,
      });
    }
    return result;
  }

  /**
   * Cancel a pool (only if not yet retired).
   * @param {string} poolId
   * @returns {object}
   */
  cancelPool(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "CARBONPOOL_NOT_FOUND",
        `pool ${poolId} not found`,
      );
    }
    if (
      pool.status === POOL_STATUS.RETIRED ||
      pool.status === POOL_STATUS.SETTLED
    ) {
      throw new HsmAdapterError(
        "CARBONPOOL_ALREADY_RETIRED",
        `pool ${poolId} has been retired/settled and cannot be cancelled`,
      );
    }
    if (pool.status === POOL_STATUS.CANCELLED) {
      throw new HsmAdapterError(
        "CARBONPOOL_ALREADY_CANCELLED",
        `pool ${poolId} is already cancelled`,
      );
    }
    pool.status = POOL_STATUS.CANCELLED;
    pool.cancelledAt = Math.floor(Date.now() / 1000);
    this._cancelCount++;
    if (this._audit) {
      this._audit("CARBONPOOL_CANCELLED", { poolId });
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
      vintageAgeSeconds: p.vintageAgeSeconds,
      carbonTonnageCap: p.carbonTonnageCap,
      retirementProofVerified: p.retirementProofVerified,
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
      retireCount: this._retireCount,
      settleCount: this._settleCount,
      rebalanceCount: this._rebalanceCount,
      cancelCount: this._cancelCount,
    };
  }
}

function _validateInitRequest(policy, request) {
  if (!request.sourceTenantId || !request.targetChainId) {
    throw new HsmAdapterError(
      "CARBONPOOL_FIELDS_MISSING",
      "sourceTenantId and targetChainId are required",
    );
  }
  if (
    !request.blindedCarbonVolumeCommitment ||
    !request.blindedVintageCertificationCommitment ||
    !request.blindedRetiredAllocationCommitment
  ) {
    throw new HsmAdapterError(
      "CARBONPOOL_FIELDS_MISSING",
      "blindedCarbonVolumeCommitment, blindedVintageCertificationCommitment, and blindedRetiredAllocationCommitment are required",
    );
  }
  if (typeof request.vintageAgeSeconds !== "number") {
    throw new HsmAdapterError(
      "CARBONPOOL_FIELDS_MISSING",
      "vintageAgeSeconds is required",
    );
  }
  if (
    policy.requireAssetInitializerAttestation &&
    !request.assetInitializerAttestation
  ) {
    throw new HsmAdapterError(
      "CARBONPOOL_ASSET_INITIALIZER_ATTESTATION_MISSING",
      "asset initializer attestation is required",
    );
  }
}

function _validateFinalizeRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError(
      "CARBONPOOL_FINALIZE_FIELDS_MISSING",
      "poolId is required",
    );
  }
  if (
    policy.requireClearingCommitteeAttestation &&
    !request.clearingCommitteeAttestation
  ) {
    throw new HsmAdapterError(
      "CARBONPOOL_CLEARING_ATTESTATION_MISSING",
      "clearing committee attestation is required",
    );
  }
}

module.exports = {
  PqcCarbonCreditTokenizationHub,
  POOL_STATUS,
  REBALANCE_DIRECTION,
};
