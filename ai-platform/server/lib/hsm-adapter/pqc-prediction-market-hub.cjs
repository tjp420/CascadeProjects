"use strict";

/**
 * Track 64: PQC Prediction Market Hub.
 *
 * Interlocking market supervisor that registers binary or scalar
 * market conditions, records blinded resolution inputs using
 * Pedersen commitments, and enforces the minReporterQuorum boundary.
 * Parses PREDMKT packets, enforces maxContractLifetimeSeconds, and
 * tracks state transitions alongside dispute resolution epochs.
 *
 * Extended with multi-asset privacy pool support, batch market
 * initialization, dispute resolution escalation, cross-chain
 * settlement, market cancellation, committee signature aggregation,
 * and summary statistics.
 *
 * @module hsm-adapter/pqc-prediction-market-hub
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

const MARKET_STATUS = {
  OPEN: "open",
  DISPUTED: "disputed",
  FINALIZED: "finalized",
  SETTLED: "settled",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
};

const MARKET_TYPE = {
  BINARY: "binary",
  SCALAR: "scalar",
  MULTI_ASSET: "multi_asset",
};

class PqcPredictionMarketHub {
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
    this._markets = new Map();
    this._settlements = new Map();
    this._disputes = new Map();
    this._maxMarkets = options.maxMarkets || 1000;
    this._maxBatchSize = options.maxBatchSize || 50;
    this._initCount = 0;
    this._finalizeCount = 0;
    this._settleCount = 0;
    this._disputeCount = 0;
    this._cancelCount = 0;
    this._expireCount = 0;
  }

  /**
   * Initialize a prediction market.
   * @param {object} request
   * @returns {object}
   */
  initializeMarket(request) {
    _validateInitRequest(this.policy, request);
    if (this._markets.size >= this._maxMarkets) {
      throw new HsmAdapterError(
        "PREDMKT_MAX_MARKETS",
        `maximum ${this._maxMarkets} markets reached`,
      );
    }
    if (
      this.policy.requireMarketInitializerAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.marketInitializerAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "PREDMKT_INITIALIZER_UNATTESTED",
            "market initializer attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "PREDMKT_INITIALIZER_UNATTESTED",
          "market initializer attestation invalid",
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
        "PREDMKT_ATTESTATION_AUTHORITY_BLOCKED",
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
        "PREDMKT_PQC_SCHEME_BLOCKED",
        `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(", ")}`,
      );
    }
    if (
      typeof request.assetWeight === "number" &&
      request.assetWeight > (this.policy.maxAssetWeightCap || 1000000)
    ) {
      throw new HsmAdapterError(
        "PREDMKT_ASSET_WEIGHT_EXCEEDED",
        `asset weight ${request.assetWeight} exceeds maximum ${this.policy.maxAssetWeightCap}`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    const lifetime = request.expirationTimestamp - now;
    if (lifetime > (this.policy.maxContractLifetimeSeconds || 2592000)) {
      throw new HsmAdapterError(
        "PREDMKT_LIFETIME_EXCEEDED",
        `contract lifetime ${lifetime}s exceeds maximum ${this.policy.maxContractLifetimeSeconds}s`,
      );
    }
    if (lifetime <= 0) {
      throw new HsmAdapterError(
        "PREDMKT_EXPIRED",
        `contract expiration ${request.expirationTimestamp} is in the past`,
      );
    }
    const marketId =
      request.marketId || `market-${crypto.randomBytes(4).toString("hex")}`;
    if (this._markets.has(marketId)) {
      throw new HsmAdapterError(
        "PREDMKT_DUPLICATE",
        `market ${marketId} already exists`,
      );
    }
    // Parse multi-asset pool parameters if provided
    const multiAssetPool = request.multiAssetPool
      ? this._parseMultiAssetPool(request.multiAssetPool)
      : null;
    const market = {
      marketId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      marketType: request.marketType || MARKET_TYPE.BINARY,
      blindedOutcomeCommitment: request.blindedOutcomeCommitment,
      assetWeight: request.assetWeight || 0,
      expirationTimestamp: request.expirationTimestamp,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: MARKET_STATUS.OPEN,
      voteCount: 0,
      finalizedAt: null,
      resolutionEpoch: 0,
      multiAssetPool,
      settlementStatus: null,
      settledAt: null,
      cancelledAt: null,
      disputeEpoch: 0,
    };
    this._markets.set(marketId, market);
    this._initCount++;
    if (this._audit) {
      this._audit("PREDICTION_MARKET_INITIALIZED", { ...market });
    }
    return market;
  }

  /**
   * Batch initialize multiple prediction markets.
   * @param {object[]} requests
   * @returns {object}
   */
  batchInitializeMarkets(requests) {
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new HsmAdapterError(
        "PREDMKT_BATCH_EMPTY",
        "batch requests array is required",
      );
    }
    if (requests.length > this._maxBatchSize) {
      throw new HsmAdapterError(
        "PREDMKT_BATCH_TOO_LARGE",
        `${requests.length} exceeds max batch size ${this._maxBatchSize}`,
      );
    }
    const results = [];
    let successCount = 0;
    let failedCount = 0;
    for (const req of requests) {
      try {
        const market = this.initializeMarket(req);
        results.push({ marketId: market.marketId, initialized: true });
        successCount++;
      } catch (err) {
        results.push({
          marketId: req.marketId || "auto",
          initialized: false,
          error: err.code || "PREDMKT_BATCH_ERROR",
        });
        failedCount++;
      }
    }
    if (this._audit) {
      this._audit("PREDMKT_BATCH_INITIALIZED", {
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
   * Get a market by id.
   * @param {string} marketId
   * @returns {object|null}
   */
  getMarket(marketId) {
    return this._markets.get(marketId) || null;
  }

  /**
   * Increment vote count for a market.
   * @param {string} marketId
   * @returns {object}
   */
  recordVote(marketId) {
    const market = this._markets.get(marketId);
    if (!market) {
      throw new HsmAdapterError(
        "PREDMKT_NOT_FOUND",
        `market ${marketId} not found`,
      );
    }
    market.voteCount += 1;
    return market;
  }

  /**
   * Escalate a market to dispute resolution.
   * @param {object} request
   * @returns {object}
   */
  escalateDispute(request) {
    if (!request || !request.marketId) {
      throw new HsmAdapterError(
        "PREDMKT_DISPUTE_FIELDS_MISSING",
        "marketId is required",
      );
    }
    const market = this._markets.get(request.marketId);
    if (!market) {
      throw new HsmAdapterError(
        "PREDMKT_NOT_FOUND",
        `market ${request.marketId} not found`,
      );
    }
    if (
      market.status === MARKET_STATUS.FINALIZED ||
      market.status === MARKET_STATUS.SETTLED
    ) {
      throw new HsmAdapterError(
        "PREDMKT_ALREADY_FINALIZED",
        `market ${request.marketId} is already ${market.status}`,
      );
    }
    if (market.status === MARKET_STATUS.CANCELLED) {
      throw new HsmAdapterError(
        "PREDMKT_CANCELLED",
        `market ${request.marketId} is cancelled`,
      );
    }
    const newEpoch = market.disputeEpoch + 1;
    if (newEpoch > (this.policy.maxDisputeResolutionEpochs || 5)) {
      throw new HsmAdapterError(
        "PREDMKT_DISPUTE_EPOCHS_EXCEEDED",
        `dispute epoch ${newEpoch} exceeds maximum ${this.policy.maxDisputeResolutionEpochs || 5}`,
      );
    }
    market.disputeEpoch = newEpoch;
    market.status = MARKET_STATUS.DISPUTED;
    const disputeId =
      request.disputeId || `dispute-${crypto.randomBytes(4).toString("hex")}`;
    const dispute = {
      disputeId,
      marketId: request.marketId,
      disputeEpoch: newEpoch,
      disputeReason: request.disputeReason || "unspecified",
      escalatedAt: Math.floor(Date.now() / 1000),
    };
    this._disputes.set(disputeId, dispute);
    this._disputeCount++;
    if (this._audit) {
      this._audit("PREDMKT_DISPUTE_ESCALATED", { ...dispute });
    }
    return dispute;
  }

  /**
   * Finalize a market after quorum.
   * @param {object} request
   * @returns {object}
   */
  finalizeMarket(request) {
    _validateFinalizeRequest(this.policy, request);
    const market = this._markets.get(request.marketId);
    if (!market) {
      throw new HsmAdapterError(
        "PREDMKT_NOT_FOUND",
        `market ${request.marketId} not found`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    if (now > market.expirationTimestamp) {
      throw new HsmAdapterError(
        "PREDMKT_CONTRACT_EXPIRED",
        `market ${request.marketId} expired at ${market.expirationTimestamp}`,
      );
    }
    if (market.voteCount < (this.policy.minReporterQuorum || 3)) {
      throw new HsmAdapterError(
        "PREDMKT_QUORUM_INSUFFICIENT",
        `reporter votes ${market.voteCount} below minimum ${this.policy.minReporterQuorum}`,
      );
    }
    const resolutionEpoch = request.resolutionEpoch || market.disputeEpoch || 0;
    if (resolutionEpoch > (this.policy.maxDisputeResolutionEpochs || 5)) {
      throw new HsmAdapterError(
        "PREDMKT_DISPUTE_EPOCHS_EXCEEDED",
        `resolution epoch ${resolutionEpoch} exceeds maximum ${this.policy.maxDisputeResolutionEpochs}`,
      );
    }
    market.status = MARKET_STATUS.FINALIZED;
    market.finalizedAt = now;
    market.resolutionEpoch = resolutionEpoch;
    const finalId =
      request.finalId || `final-${crypto.randomBytes(4).toString("hex")}`;
    const finalization = {
      finalId,
      marketId: request.marketId,
      resolutionEpoch: market.resolutionEpoch,
      reporterSignatureCount: market.voteCount,
      finalizedAt: now,
    };
    this._finalizeCount++;
    if (this._audit) {
      this._audit("PREDICTION_MARKET_FINALIZED", { ...finalization });
    }
    return finalization;
  }

  /**
   * Settle a finalized market cross-chain.
   * @param {object} request
   * @returns {object}
   */
  settleMarket(request) {
    if (!request || !request.marketId) {
      throw new HsmAdapterError(
        "PREDMKT_SETTLE_FIELDS_MISSING",
        "marketId is required",
      );
    }
    const market = this._markets.get(request.marketId);
    if (!market) {
      throw new HsmAdapterError(
        "PREDMKT_NOT_FOUND",
        `market ${request.marketId} not found`,
      );
    }
    if (market.status !== MARKET_STATUS.FINALIZED) {
      throw new HsmAdapterError(
        "PREDMKT_NOT_FINALIZED",
        `market ${request.marketId} status is ${market.status}, expected finalized`,
      );
    }
    if (!request.targetChainId || typeof request.targetChainId !== "string") {
      throw new HsmAdapterError(
        "PREDMKT_SETTLE_CHAIN_MISSING",
        "targetChainId is required for settlement",
      );
    }
    if (request.targetChainId !== market.targetChainId) {
      throw new HsmAdapterError(
        "PREDMKT_SETTLE_CHAIN_MISMATCH",
        `settlement chain ${request.targetChainId} does not match market target ${market.targetChainId}`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    const settlementId =
      request.settlementId || `settle-${crypto.randomBytes(4).toString("hex")}`;
    const settlement = {
      settlementId,
      marketId: request.marketId,
      targetChainId: request.targetChainId,
      settlementProofHash:
        request.settlementProofHash ||
        crypto
          .createHash("sha256")
          .update(`${request.marketId}:${request.targetChainId}:${now}`)
          .digest("hex"),
      settledAt: now,
    };
    market.status = MARKET_STATUS.SETTLED;
    market.settlementStatus = "settled";
    market.settledAt = now;
    this._settlements.set(request.marketId, settlement);
    this._settleCount++;
    if (this._audit) {
      this._audit("PREDMKT_SETTLED", { ...settlement });
    }
    return settlement;
  }

  /**
   * Aggregate committee signatures for market finalization.
   * @param {string} marketId
   * @param {object[]} partialSignatures - Array of {peerId, signature}
   * @returns {object}
   */
  aggregateCommitteeSignatures(marketId, partialSignatures) {
    const market = this._markets.get(marketId);
    if (!market) {
      throw new HsmAdapterError(
        "PREDMKT_NOT_FOUND",
        `market ${marketId} not found`,
      );
    }
    if (!Array.isArray(partialSignatures) || partialSignatures.length === 0) {
      throw new HsmAdapterError(
        "PREDMKT_NO_SIGNATURES",
        "partialSignatures array is required",
      );
    }
    if (partialSignatures.length < (this.policy.minReporterQuorum || 3)) {
      throw new HsmAdapterError(
        "PREDMKT_QUORUM_INSUFFICIENT",
        `${partialSignatures.length} signatures below minimum ${this.policy.minReporterQuorum || 3}`,
      );
    }
    const aggregatedSig = crypto
      .createHash("sha256")
      .update(partialSignatures.map((s) => s.signature).join(":"))
      .digest("hex");
    const result = {
      marketId,
      signatureCount: partialSignatures.length,
      aggregatedSignature: aggregatedSig,
      participantIds: partialSignatures.map((s) => s.peerId || "anonymous"),
      aggregatedAt: Math.floor(Date.now() / 1000),
    };
    if (this._audit) {
      this._audit("PREDMKT_SIGNATURES_AGGREGATED", {
        marketId,
        count: partialSignatures.length,
      });
    }
    return result;
  }

  /**
   * Cancel a market (only if not yet finalized).
   * @param {string} marketId
   * @returns {object}
   */
  cancelMarket(marketId) {
    const market = this._markets.get(marketId);
    if (!market) {
      throw new HsmAdapterError(
        "PREDMKT_NOT_FOUND",
        `market ${marketId} not found`,
      );
    }
    if (
      market.status === MARKET_STATUS.FINALIZED ||
      market.status === MARKET_STATUS.SETTLED
    ) {
      throw new HsmAdapterError(
        "PREDMKT_ALREADY_FINALIZED",
        `market ${marketId} has been finalized/settled and cannot be cancelled`,
      );
    }
    if (market.status === MARKET_STATUS.CANCELLED) {
      throw new HsmAdapterError(
        "PREDMKT_ALREADY_CANCELLED",
        `market ${marketId} is already cancelled`,
      );
    }
    market.status = MARKET_STATUS.CANCELLED;
    market.cancelledAt = Math.floor(Date.now() / 1000);
    this._cancelCount++;
    if (this._audit) {
      this._audit("PREDMKT_CANCELLED", { marketId });
    }
    return { marketId, cancelled: true };
  }

  /**
   * Expire a market.
   * @param {string} marketId
   * @returns {object}
   */
  expireMarket(marketId) {
    const market = this._markets.get(marketId);
    if (!market) {
      throw new HsmAdapterError(
        "PREDMKT_NOT_FOUND",
        `market ${marketId} not found`,
      );
    }
    if (market.status === MARKET_STATUS.EXPIRED) {
      throw new HsmAdapterError(
        "PREDMKT_ALREADY_EXPIRED",
        `market ${marketId} is already expired`,
      );
    }
    market.status = MARKET_STATUS.EXPIRED;
    this._expireCount++;
    if (this._audit) {
      this._audit("PREDMKT_EXPIRED", { marketId });
    }
    return { marketId, expired: true };
  }

  /**
   * Get a settlement record by market id.
   * @param {string} marketId
   * @returns {object|null}
   */
  getSettlement(marketId) {
    return this._settlements.get(marketId) || null;
  }

  /**
   * Get a dispute record by dispute id.
   * @param {string} disputeId
   * @returns {object|null}
   */
  getDispute(disputeId) {
    return this._disputes.get(disputeId) || null;
  }

  /**
   * Get all markets (metadata only).
   * @returns {object[]}
   */
  getMarkets() {
    return Array.from(this._markets.values()).map((m) => ({
      marketId: m.marketId,
      sourceTenantId: m.sourceTenantId,
      targetChainId: m.targetChainId,
      status: m.status,
      marketType: m.marketType,
      expirationTimestamp: m.expirationTimestamp,
      voteCount: m.voteCount,
    }));
  }

  /**
   * Get the current market count.
   * @returns {number}
   */
  getMarketCount() {
    return this._markets.size;
  }

  /**
   * Get summary statistics.
   * @returns {object}
   */
  getStats() {
    const marketsByStatus = {};
    for (const m of this._markets.values()) {
      marketsByStatus[m.status] = (marketsByStatus[m.status] || 0) + 1;
    }
    return {
      totalMarkets: this._markets.size,
      totalSettlements: this._settlements.size,
      totalDisputes: this._disputes.size,
      marketsByStatus,
      initCount: this._initCount,
      finalizeCount: this._finalizeCount,
      settleCount: this._settleCount,
      disputeCount: this._disputeCount,
      cancelCount: this._cancelCount,
      expireCount: this._expireCount,
    };
  }

  /**
   * Parse multi-asset privacy pool parameters.
   * @private
   */
  _parseMultiAssetPool(pool) {
    if (!pool || typeof pool !== "object") {
      throw new HsmAdapterError(
        "PREDMKT_POOL_INVALID",
        "multiAssetPool must be an object",
      );
    }
    if (!Array.isArray(pool.assetIds) || pool.assetIds.length === 0) {
      throw new HsmAdapterError(
        "PREDMKT_POOL_ASSETS_MISSING",
        "multiAssetPool.assetIds array is required",
      );
    }
    if (pool.assetIds.length > 100) {
      throw new HsmAdapterError(
        "PREDMKT_POOL_TOO_MANY_ASSETS",
        `${pool.assetIds.length} assets exceeds maximum 100`,
      );
    }
    return {
      assetIds: pool.assetIds,
      blindedAssetValues: pool.blindedAssetValues || [],
      shieldedPoolType: pool.shieldedPoolType || "pedersen",
      merkleRoot: pool.merkleRoot || null,
    };
  }
}

function _validateInitRequest(policy, request) {
  if (!request.sourceTenantId || !request.targetChainId) {
    throw new HsmAdapterError(
      "PREDMKT_FIELDS_MISSING",
      "sourceTenantId and targetChainId are required",
    );
  }
  if (!request.blindedOutcomeCommitment) {
    throw new HsmAdapterError(
      "PREDMKT_FIELDS_MISSING",
      "blindedOutcomeCommitment is required",
    );
  }
  if (typeof request.expirationTimestamp !== "number") {
    throw new HsmAdapterError(
      "PREDMKT_FIELDS_MISSING",
      "expirationTimestamp is required",
    );
  }
  if (
    policy.requireMarketInitializerAttestation &&
    !request.marketInitializerAttestation
  ) {
    throw new HsmAdapterError(
      "PREDMKT_INITIALIZER_ATTESTATION_MISSING",
      "market initializer attestation is required",
    );
  }
}

function _validateFinalizeRequest(policy, request) {
  if (!request.marketId) {
    throw new HsmAdapterError(
      "PREDMKT_FINALIZE_FIELDS_MISSING",
      "marketId is required",
    );
  }
}

module.exports = {
  PqcPredictionMarketHub,
  MARKET_STATUS,
  MARKET_TYPE,
};
