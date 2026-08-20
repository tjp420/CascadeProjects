"use strict";

/**
 * Track 87: PQC Space-Asset Telemetry Gating Hub.
 *
 * Interlocking space-asset telemetry coordinator that
 * instantiates multi-party orbital verification
 * pools using homomorphically split Pedersen commitments
 * over orbital telemetry hashes, slot allocation parameters, and
 * satellite identity hashes. Parses SPACEGATE packets,
 * enforces maxTelemetryChainDepth, and tracks state
 * transitions alongside the minOrbitalSlotQuorum
 * boundary.
 *
 * Extended with batch pool initialization, telemetry chain
 * depth rebalancing, committee signature aggregation,
 * pool cancellation, cross-chain settlement, and
 * summary statistics.
 *
 * @module hsm-adapter/pqc-space-asset-telemetry-gating-hub
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

class PqcSpaceAssetTelemetryGatingHub {
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
   * Initialize an space-asset telemetry gating pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this._pools.size >= this._maxPools) {
      throw new HsmAdapterError(
        "SPACEGATE_MAX_POOLS",
        `maximum ${this._maxPools} pools reached`,
      );
    }
    if (
      this.policy.requireSpaceAuthorityInitializerAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.spaceAuthorityInitializerAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "SPACEGATE_INSTITUTION_INITIALIZER_UNATTESTED",
            "space authority initializer attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "SPACEGATE_INSTITUTION_INITIALIZER_UNATTESTED",
          "space authority initializer attestation invalid",
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
        "SPACEGATE_ATTESTATION_AUTHORITY_BLOCKED",
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
        "SPACEGATE_PQC_SCHEME_BLOCKED",
        `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(", ")}`,
      );
    }
    if (
      typeof request.slotAllocationWindowSeconds === "number" &&
      request.slotAllocationWindowSeconds >
        (this.policy.maxSlotAllocationWindowSeconds || 31536000)
    ) {
      throw new HsmAdapterError(
        "SPACEGATE_SLOT_WINDOW_EXCEEDED",
        `slot allocation window seconds ${request.slotAllocationWindowSeconds} exceeds maximum ${this.policy.maxSlotAllocationWindowSeconds}`,
      );
    }
    if (
      typeof request.telemetryChainDepth === "number" &&
      request.telemetryChainDepth > (this.policy.maxTelemetryChainDepth || 16)
    ) {
      throw new HsmAdapterError(
        "SPACEGATE_TELEMETRY_DEPTH_EXCEEDED",
        `telemetry chain depth ${request.telemetryChainDepth} exceeds maximum ${this.policy.maxTelemetryChainDepth}`,
      );
    }
    const poolId =
      request.poolId || `pool-${crypto.randomBytes(4).toString("hex")}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError(
        "SPACEGATE_DUPLICATE",
        `pool ${poolId} already exists`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedOrbitalTelemetryCommitment:
        request.blindedOrbitalTelemetryCommitment,
      blindedSlotAllocationCommitment: request.blindedSlotAllocationCommitment,
      blindedSatelliteIdentityCommitment:
        request.blindedSatelliteIdentityCommitment,
      slotAllocationWindowSeconds: request.slotAllocationWindowSeconds,
      telemetryChainDepth: request.telemetryChainDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: POOL_STATUS.OPEN,
      telemetryClaimVerified: false,
      orbitalAccreditationCompletedAt: null,
      rebalanceEpoch: 0,
      settlementStatus: null,
      settledAt: null,
      cancelledAt: null,
    };
    this._pools.set(poolId, pool);
    this._initCount++;
    if (this._audit) {
      this._audit("ORBITAL_GATING_POOL_INITIALIZED", { ...pool });
    }
    return pool;
  }

  /**
   * Batch initialize multiple space-asset telemetry gating pools.
   * @param {object[]} requests
   * @returns {object}
   */
  batchInitializePools(requests) {
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new HsmAdapterError(
        "SPACEGATE_BATCH_EMPTY",
        "batch requests array is required",
      );
    }
    if (requests.length > this._maxBatchSize) {
      throw new HsmAdapterError(
        "SPACEGATE_BATCH_TOO_LARGE",
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
          error: err.code || "SPACEGATE_BATCH_ERROR",
        });
        failedCount++;
      }
    }
    if (this._audit) {
      this._audit("SPACEGATE_BATCH_INITIALIZED", {
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
   * Mark a pool as telemetry-claim-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markTelemetryClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "SPACEGATE_NOT_FOUND",
        `pool ${poolId} not found`,
      );
    }
    pool.telemetryClaimVerified = true;
    return pool;
  }

  /**
   * Rebalance telemetry chain depth for a pool.
   * @param {object} request
   * @returns {object}
   */
  rebalanceTelemetryChainDepth(request) {
    if (!request || !request.poolId) {
      throw new HsmAdapterError(
        "SPACEGATE_REBALANCE_FIELDS_MISSING",
        "poolId is required",
      );
    }
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "SPACEGATE_NOT_FOUND",
        `pool ${request.poolId} not found`,
      );
    }
    if (
      pool.status !== POOL_STATUS.OPEN &&
      pool.status !== POOL_STATUS.REBALANCING
    ) {
      throw new HsmAdapterError(
        "SPACEGATE_NOT_REBALANCEABLE",
        `pool ${request.poolId} status is ${pool.status}, expected open or rebalancing`,
      );
    }
    const direction = request.direction || REBALANCE_DIRECTION.INCREASE;
    if (!Object.values(REBALANCE_DIRECTION).includes(direction)) {
      throw new HsmAdapterError(
        "SPACEGATE_REBALANCE_DIRECTION_INVALID",
        `direction ${direction} is not valid; allowed: ${Object.values(REBALANCE_DIRECTION).join(", ")}`,
      );
    }
    if (
      typeof request.rebalanceAmount !== "number" ||
      request.rebalanceAmount <= 0
    ) {
      throw new HsmAdapterError(
        "SPACEGATE_REBALANCE_AMOUNT_INVALID",
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
      newTelemetryChainDepth:
        request.newTelemetryChainDepth !== undefined
          ? request.newTelemetryChainDepth
          : pool.telemetryChainDepth,
      rebalancedAt: Math.floor(Date.now() / 1000),
    };
    this._rebalances.set(rebalanceId, rebalance);
    this._rebalanceCount++;
    if (request.newTelemetryChainDepth !== undefined) {
      if (
        request.newTelemetryChainDepth >
        (this.policy.maxTelemetryChainDepth || 16)
      ) {
        throw new HsmAdapterError(
          "SPACEGATE_TELEMETRY_DEPTH_EXCEEDED",
          `new telemetry chain depth ${request.newTelemetryChainDepth} exceeds maximum ${this.policy.maxTelemetryChainDepth}`,
        );
      }
      pool.telemetryChainDepth = request.newTelemetryChainDepth;
    }
    if (this._audit) {
      this._audit("SPACEGATE_TELEMETRY_DEPTH_REBALANCED", { ...rebalance });
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
   * Complete orbital accreditation after quorum.
   * @param {object} request
   * @returns {object}
   */
  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "SPACEGATE_NOT_FOUND",
        `pool ${request.poolId} not found`,
      );
    }
    if (!pool.telemetryClaimVerified) {
      throw new HsmAdapterError(
        "SPACEGATE_TELEMETRY_CLAIM_NOT_VERIFIED",
        `pool ${request.poolId} telemetry claim not verified`,
      );
    }
    if (
      this.policy.requireOrbitalOversightCommitteeAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.orbitalOversightCommitteeAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "SPACEGATE_ORBITAL_COMMITTEE_UNATTESTED",
            "orbital oversight committee attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "SPACEGATE_ORBITAL_COMMITTEE_UNATTESTED",
          "orbital oversight committee attestation invalid",
        );
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minOrbitalSlotQuorum || 5)) {
      throw new HsmAdapterError(
        "SPACEGATE_ACCREDITATION_QUORUM_INSUFFICIENT",
        `accreditation signatures ${signatures.length} below minimum ${this.policy.minOrbitalSlotQuorum}`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = POOL_STATUS.ACCREDITED;
    pool.orbitalAccreditationCompletedAt = now;
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
      this._audit("ORBITAL_ACCREDITATION_COMPLETED", { ...completion });
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
        "SPACEGATE_SETTLE_FIELDS_MISSING",
        "poolId is required",
      );
    }
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "SPACEGATE_NOT_FOUND",
        `pool ${request.poolId} not found`,
      );
    }
    if (pool.status !== POOL_STATUS.ACCREDITED) {
      throw new HsmAdapterError(
        "SPACEGATE_NOT_ACCREDITED",
        `pool ${request.poolId} status is ${pool.status}, expected accredited`,
      );
    }
    if (!request.targetChainId || typeof request.targetChainId !== "string") {
      throw new HsmAdapterError(
        "SPACEGATE_SETTLE_CHAIN_MISSING",
        "targetChainId is required for settlement",
      );
    }
    if (request.targetChainId !== pool.targetChainId) {
      throw new HsmAdapterError(
        "SPACEGATE_SETTLE_CHAIN_MISMATCH",
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
      this._audit("SPACEGATE_SETTLED", { ...settlement });
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
        "SPACEGATE_NOT_FOUND",
        `pool ${poolId} not found`,
      );
    }
    if (!Array.isArray(partialSignatures) || partialSignatures.length === 0) {
      throw new HsmAdapterError(
        "SPACEGATE_NO_SIGNATURES",
        "partialSignatures array is required",
      );
    }
    if (partialSignatures.length < (this.policy.minOrbitalSlotQuorum || 5)) {
      throw new HsmAdapterError(
        "SPACEGATE_ACCREDITATION_QUORUM_INSUFFICIENT",
        `${partialSignatures.length} signatures below minimum ${this.policy.minOrbitalSlotQuorum || 5}`,
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
      this._audit("SPACEGATE_SIGNATURES_AGGREGATED", {
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
        "SPACEGATE_NOT_FOUND",
        `pool ${poolId} not found`,
      );
    }
    if (
      pool.status === POOL_STATUS.ACCREDITED ||
      pool.status === POOL_STATUS.SETTLED
    ) {
      throw new HsmAdapterError(
        "SPACEGATE_ALREADY_ACCREDITED",
        `pool ${poolId} has been accredited/settled and cannot be cancelled`,
      );
    }
    if (pool.status === POOL_STATUS.CANCELLED) {
      throw new HsmAdapterError(
        "SPACEGATE_ALREADY_CANCELLED",
        `pool ${poolId} is already cancelled`,
      );
    }
    pool.status = POOL_STATUS.CANCELLED;
    pool.cancelledAt = Math.floor(Date.now() / 1000);
    this._cancelCount++;
    if (this._audit) {
      this._audit("SPACEGATE_CANCELLED", { poolId });
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
      telemetryChainDepth: p.telemetryChainDepth,
      slotAllocationWindowSeconds: p.slotAllocationWindowSeconds,
      telemetryClaimVerified: p.telemetryClaimVerified,
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
      "SPACEGATE_FIELDS_MISSING",
      "sourceTenantId and targetChainId are required",
    );
  }
  if (
    !request.blindedOrbitalTelemetryCommitment ||
    !request.blindedSlotAllocationCommitment ||
    !request.blindedSatelliteIdentityCommitment
  ) {
    throw new HsmAdapterError(
      "SPACEGATE_FIELDS_MISSING",
      "blindedOrbitalTelemetryCommitment, blindedSlotAllocationCommitment, and blindedSatelliteIdentityCommitment are required",
    );
  }
  if (typeof request.slotAllocationWindowSeconds !== "number") {
    throw new HsmAdapterError(
      "SPACEGATE_FIELDS_MISSING",
      "slotAllocationWindowSeconds is required",
    );
  }
  if (typeof request.telemetryChainDepth !== "number") {
    throw new HsmAdapterError(
      "SPACEGATE_FIELDS_MISSING",
      "telemetryChainDepth is required",
    );
  }
  if (
    policy.requireSpaceAuthorityInitializerAttestation &&
    !request.spaceAuthorityInitializerAttestation
  ) {
    throw new HsmAdapterError(
      "SPACEGATE_INSTITUTION_INITIALIZER_ATTESTATION_MISSING",
      "space authority initializer attestation is required",
    );
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError(
      "SPACEGATE_COMPLETE_FIELDS_MISSING",
      "poolId is required",
    );
  }
  if (
    policy.requireOrbitalOversightCommitteeAttestation &&
    !request.orbitalOversightCommitteeAttestation
  ) {
    throw new HsmAdapterError(
      "SPACEGATE_CLEARING_ATTESTATION_MISSING",
      "orbital oversight committee attestation is required",
    );
  }
}

module.exports = {
  PqcSpaceAssetTelemetryGatingHub,
  POOL_STATUS,
  REBALANCE_DIRECTION,
};
