"use strict";

/**
 * Track 63: PQC Blind Option Pool Hub.
 *
 * Interlocking contract coordinator that instantiates blinded option
 * pools using homomorphically additive Pedersen commitments over
 * values, strikes, and collateral thresholds. Parses OPTPOOL packets,
 * enforces maxContractLifetimeSeconds, and tracks state transitions
 * alongside the minExecutionSignatureQuorum.
 *
 * Extended with VDF-locked execution windows, cross-chain settlement
 * coordination, batch pool initialization, committee signature
 * aggregation, pool expiration, and summary statistics.
 *
 * @module hsm-adapter/pqc-blind-option-pool-hub
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

const POOL_STATUS = {
  OPEN: "open",
  MARGIN_VERIFIED: "margin_verified",
  EXECUTED: "executed",
  SETTLED: "settled",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
};

const VDF_PARAMS = {
  // Simulated VDF difficulty parameters for hardware-accelerated SNARK proof
  // generation. In production, these would map to ASIC/FPGA acceleration
  // parameters for Wesolowski or Pietrzak VDF schemes.
  minDifficulty: 1024,
  maxDifficulty: 65536,
  defaultDifficulty: 2048,
};

class PqcBlindOptionPoolHub {
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
    this._settlements = new Map(); // poolId -> settlement record
    this._maxPools = options.maxPools || 1000;
    this._maxBatchSize = options.maxBatchSize || 50;
    this._initCount = 0;
    this._execCount = 0;
    this._settleCount = 0;
    this._expireCount = 0;
  }

  /**
   * Initialize a blind option pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this._pools.size >= this._maxPools) {
      throw new HsmAdapterError(
        "OPTPOOL_MAX_POOLS",
        `maximum ${this._maxPools} pools reached`,
      );
    }
    if (this.policy.requireInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(
          request.initializerAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "OPTPOOL_INITIALIZER_UNATTESTED",
            "initializer attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "OPTPOOL_INITIALIZER_UNATTESTED",
          "initializer attestation invalid",
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
        "OPTPOOL_ATTESTATION_AUTHORITY_BLOCKED",
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
        "OPTPOOL_PQC_SCHEME_BLOCKED",
        `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(", ")}`,
      );
    }
    if (
      typeof request.collateralRatio === "number" &&
      request.collateralRatio < (this.policy.minCollateralRatio || 150)
    ) {
      throw new HsmAdapterError(
        "OPTPOOL_COLLATERAL_INSUFFICIENT",
        `collateral ratio ${request.collateralRatio}% below minimum ${this.policy.minCollateralRatio}%`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    const lifetime = request.expirationTimestamp - now;
    if (lifetime > (this.policy.maxContractLifetimeSeconds || 2592000)) {
      throw new HsmAdapterError(
        "OPTPOOL_LIFETIME_EXCEEDED",
        `contract lifetime ${lifetime}s exceeds maximum ${this.policy.maxContractLifetimeSeconds}s`,
      );
    }
    if (lifetime <= 0) {
      throw new HsmAdapterError(
        "OPTPOOL_EXPIRED",
        `contract expiration ${request.expirationTimestamp} is in the past`,
      );
    }
    const poolId =
      request.poolId || `pool-${crypto.randomBytes(4).toString("hex")}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError(
        "OPTPOOL_DUPLICATE",
        `pool ${poolId} already exists`,
      );
    }
    // Generate VDF-locked execution window parameters
    const vdfDifficulty = request.vdfDifficulty || VDF_PARAMS.defaultDifficulty;
    if (
      vdfDifficulty < VDF_PARAMS.minDifficulty ||
      vdfDifficulty > VDF_PARAMS.maxDifficulty
    ) {
      throw new HsmAdapterError(
        "OPTPOOL_VDF_DIFFICULTY_INVALID",
        `VDF difficulty ${vdfDifficulty} outside range [${VDF_PARAMS.minDifficulty}, ${VDF_PARAMS.maxDifficulty}]`,
      );
    }
    const vdfLock = this._generateVdfLock(
      vdfDifficulty,
      request.expirationTimestamp,
      request.enforceVdfLock === true,
    );
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedValueCommitment: request.blindedValueCommitment,
      blindedStrikeCommitment: request.blindedStrikeCommitment,
      blindedCollateralCommitment: request.blindedCollateralCommitment,
      collateralRatio: request.collateralRatio,
      expirationTimestamp: request.expirationTimestamp,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: POOL_STATUS.OPEN,
      marginVerified: false,
      executedAt: null,
      vdfLock,
      settlementStatus: null,
      settledAt: null,
      cancelledAt: null,
    };
    this._pools.set(poolId, pool);
    this._initCount++;
    if (this._audit) {
      this._audit("BLIND_OPTION_POOL_INITIALIZED", { ...pool });
    }
    return pool;
  }

  /**
   * Batch initialize multiple blind option pools.
   * @param {object[]} requests
   * @returns {object}
   */
  batchInitializePools(requests) {
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new HsmAdapterError(
        "OPTPOOL_BATCH_EMPTY",
        "batch requests array is required",
      );
    }
    if (requests.length > this._maxBatchSize) {
      throw new HsmAdapterError(
        "OPTPOOL_BATCH_TOO_LARGE",
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
          error: err.code || "OPTPOOL_BATCH_ERROR",
        });
        failedCount++;
      }
    }
    if (this._audit) {
      this._audit("OPTPOOL_BATCH_INITIALIZED", {
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
   * Mark a pool as margin-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markMarginVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "OPTPOOL_NOT_FOUND",
        `pool ${poolId} not found`,
      );
    }
    pool.marginVerified = true;
    pool.status = POOL_STATUS.MARGIN_VERIFIED;
    return pool;
  }

  /**
   * Execute a cleared option contract.
   * @param {object} request
   * @returns {object}
   */
  executeContract(request) {
    _validateExecRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "OPTPOOL_NOT_FOUND",
        `pool ${request.poolId} not found`,
      );
    }
    if (!pool.marginVerified) {
      throw new HsmAdapterError(
        "OPTPOOL_MARGIN_NOT_VERIFIED",
        `pool ${request.poolId} margin not verified`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    if (now > pool.expirationTimestamp) {
      throw new HsmAdapterError(
        "OPTPOOL_CONTRACT_EXPIRED",
        `pool ${request.poolId} expired at ${pool.expirationTimestamp}`,
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
            "OPTPOOL_CLEARING_COMMITTEE_UNATTESTED",
            "clearing committee attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "OPTPOOL_CLEARING_COMMITTEE_UNATTESTED",
          "clearing committee attestation invalid",
        );
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minExecutionSignatureQuorum || 3)) {
      throw new HsmAdapterError(
        "OPTPOOL_EXEC_QUORUM_INSUFFICIENT",
        `execution signatures ${signatures.length} below minimum ${this.policy.minExecutionSignatureQuorum}`,
      );
    }
    // Verify VDF lock has elapsed (only if enforcement is enabled)
    if (
      pool.vdfLock &&
      pool.vdfLock.enforced &&
      now < pool.vdfLock.unlockTimestamp
    ) {
      throw new HsmAdapterError(
        "OPTPOOL_VDF_LOCKED",
        `pool ${request.poolId} VDF lock active until ${pool.vdfLock.unlockTimestamp} (now ${now})`,
      );
    }
    pool.status = POOL_STATUS.EXECUTED;
    pool.executedAt = now;
    const execId =
      request.execId || `exec-${crypto.randomBytes(4).toString("hex")}`;
    const execution = {
      execId,
      poolId: request.poolId,
      executionSignatureCount: signatures.length,
      executedAt: now,
      vdfProofHash: pool.vdfLock ? pool.vdfLock.vdfProofHash : null,
    };
    this._execCount++;
    if (this._audit) {
      this._audit("BLIND_OPTION_CONTRACT_EXECUTED", { ...execution });
    }
    return execution;
  }

  /**
   * Settle an executed option contract cross-chain.
   * @param {object} request
   * @returns {object}
   */
  settleContract(request) {
    if (!request || !request.poolId) {
      throw new HsmAdapterError(
        "OPTPOOL_SETTLE_FIELDS_MISSING",
        "poolId is required",
      );
    }
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "OPTPOOL_NOT_FOUND",
        `pool ${request.poolId} not found`,
      );
    }
    if (pool.status !== POOL_STATUS.EXECUTED) {
      throw new HsmAdapterError(
        "OPTPOOL_NOT_EXECUTED",
        `pool ${request.poolId} status is ${pool.status}, expected executed`,
      );
    }
    if (!request.targetChainId || typeof request.targetChainId !== "string") {
      throw new HsmAdapterError(
        "OPTPOOL_SETTLE_CHAIN_MISSING",
        "targetChainId is required for settlement",
      );
    }
    if (request.targetChainId !== pool.targetChainId) {
      throw new HsmAdapterError(
        "OPTPOOL_SETTLE_CHAIN_MISMATCH",
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
      this._audit("BLIND_OPTION_CONTRACT_SETTLED", { ...settlement });
    }
    return settlement;
  }

  /**
   * Aggregate committee signatures for contract execution.
   * @param {string} poolId
   * @param {object[]} partialSignatures - Array of {peerId, signature}
   * @returns {object}
   */
  aggregateCommitteeSignatures(poolId, partialSignatures) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "OPTPOOL_NOT_FOUND",
        `pool ${poolId} not found`,
      );
    }
    if (!Array.isArray(partialSignatures) || partialSignatures.length === 0) {
      throw new HsmAdapterError(
        "OPTPOOL_NO_SIGNATURES",
        "partialSignatures array is required",
      );
    }
    if (
      partialSignatures.length < (this.policy.minExecutionSignatureQuorum || 3)
    ) {
      throw new HsmAdapterError(
        "OPTPOOL_EXEC_QUORUM_INSUFFICIENT",
        `${partialSignatures.length} signatures below minimum ${this.policy.minExecutionSignatureQuorum || 3}`,
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
      this._audit("OPTPOOL_SIGNATURES_AGGREGATED", {
        poolId,
        count: partialSignatures.length,
      });
    }
    return result;
  }

  /**
   * Cancel a pool (only if not yet executed).
   * @param {string} poolId
   * @returns {object}
   */
  cancelPool(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "OPTPOOL_NOT_FOUND",
        `pool ${poolId} not found`,
      );
    }
    if (
      pool.status === POOL_STATUS.EXECUTED ||
      pool.status === POOL_STATUS.SETTLED
    ) {
      throw new HsmAdapterError(
        "OPTPOOL_ALREADY_EXECUTED",
        `pool ${poolId} has been executed/settled and cannot be cancelled`,
      );
    }
    if (pool.status === POOL_STATUS.CANCELLED) {
      throw new HsmAdapterError(
        "OPTPOOL_ALREADY_CANCELLED",
        `pool ${poolId} is already cancelled`,
      );
    }
    pool.status = POOL_STATUS.CANCELLED;
    pool.cancelledAt = Math.floor(Date.now() / 1000);
    if (this._audit) {
      this._audit("OPTPOOL_CANCELLED", { poolId });
    }
    return { poolId, cancelled: true };
  }

  /**
   * Expire a pool.
   * @param {string} poolId
   * @returns {object}
   */
  expirePool(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "OPTPOOL_NOT_FOUND",
        `pool ${poolId} not found`,
      );
    }
    if (pool.status === POOL_STATUS.EXPIRED) {
      throw new HsmAdapterError(
        "OPTPOOL_ALREADY_EXPIRED",
        `pool ${poolId} is already expired`,
      );
    }
    pool.status = POOL_STATUS.EXPIRED;
    this._expireCount++;
    if (this._audit) {
      this._audit("OPTPOOL_EXPIRED", { poolId });
    }
    return { poolId, expired: true };
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
      expirationTimestamp: p.expirationTimestamp,
      collateralRatio: p.collateralRatio,
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
      poolsByStatus,
      initCount: this._initCount,
      execCount: this._execCount,
      settleCount: this._settleCount,
      expireCount: this._expireCount,
    };
  }

  /**
   * Generate VDF-locked execution window parameters.
   * @private
   */
  _generateVdfLock(difficulty, expirationTimestamp, enforced) {
    const seed = crypto.randomBytes(32);
    const vdfProofHash = crypto
      .createHash("sha256")
      .update(`vdf:${seed.toString("hex")}:${difficulty}`)
      .digest("hex");
    // VDF unlock is at expiration (time-locked until contract expiry)
    return {
      difficulty,
      seed: seed.toString("hex"),
      vdfProofHash,
      unlockTimestamp: expirationTimestamp,
      algorithm: "wesolowski",
      enforced: enforced === true,
    };
  }
}

function _validateInitRequest(policy, request) {
  if (!request.sourceTenantId || !request.targetChainId) {
    throw new HsmAdapterError(
      "OPTPOOL_FIELDS_MISSING",
      "sourceTenantId and targetChainId are required",
    );
  }
  if (
    !request.blindedValueCommitment ||
    !request.blindedStrikeCommitment ||
    !request.blindedCollateralCommitment
  ) {
    throw new HsmAdapterError(
      "OPTPOOL_FIELDS_MISSING",
      "blindedValueCommitment, blindedStrikeCommitment, and blindedCollateralCommitment are required",
    );
  }
  if (typeof request.collateralRatio !== "number") {
    throw new HsmAdapterError(
      "OPTPOOL_FIELDS_MISSING",
      "collateralRatio is required",
    );
  }
  if (typeof request.expirationTimestamp !== "number") {
    throw new HsmAdapterError(
      "OPTPOOL_FIELDS_MISSING",
      "expirationTimestamp is required",
    );
  }
  if (policy.requireInitializerAttestation && !request.initializerAttestation) {
    throw new HsmAdapterError(
      "OPTPOOL_INITIALIZER_ATTESTATION_MISSING",
      "initializer attestation is required",
    );
  }
}

function _validateExecRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError(
      "OPTPOOL_EXEC_FIELDS_MISSING",
      "poolId is required",
    );
  }
  if (
    policy.requireClearingCommitteeAttestation &&
    !request.clearingCommitteeAttestation
  ) {
    throw new HsmAdapterError(
      "OPTPOOL_CLEARING_ATTESTATION_MISSING",
      "clearing committee attestation is required",
    );
  }
}

module.exports = {
  PqcBlindOptionPoolHub,
  POOL_STATUS,
  VDF_PARAMS,
};
