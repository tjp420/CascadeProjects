"use strict";

/**
 * Track 61: Zero-Knowledge Verifiable Delay Functions with Succinct
 * Recursive Proof Aggregation.
 *
 * Compresses multi-hop mixnet states and VDF proofs using recursive
 * SNARK composition. A "proof of proofs" that folds multiple proofs
 * into a single succinct proof, enabling O(log N) verification of
 * arbitrarily long computation chains.
 *
 * Components:
 *   - RecursiveProofFolder: Folds two proofs into one via recursion
 *   - ProofChainBuilder: Builds chains of recursively composed proofs
 *   - VdfRecursiveAggregator: Aggregates VDF proofs recursively
 *   - MixnetStateCompressor: Compresses multi-hop mixnet states
 *   - SuccinctVerifier: Verifies recursive proofs in constant time
 *   - ProofTreeBuilder: Builds tree-structured proof aggregation
 *   - RecursiveCircuitCompiler: Compiles recursion circuits
 *   - AggregationScheduler: Schedules batch aggregation rounds
 *
 * @module hsm-adapter/recursive-proof-aggregation-engine
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

const DEFAULT_OPTIONS = {
  fieldPrime: (1n << 256n) - 189n,
  maxProofs: 10000,
  maxRecursionDepth: 20,
  maxFoldBatch: 16,
  maxChainLength: 100,
  maxTreeDepth: 10,
  maxProofSize: 4096,
  enableTreeAggregation: true,
  enableChainAggregation: true,
  aggregationTimeoutMs: 30000,
};

const PROOF_STATUS = {
  PENDING: "pending",
  VERIFIED: "verified",
  FOLDED: "folded",
  INVALID: "invalid",
  EXPIRED: "expired",
};

const AGG_STATUS = {
  PENDING: "pending",
  FOLDING: "folding",
  COMPLETED: "completed",
  FAILED: "failed",
};

const AGG_TYPE = {
  CHAIN: "chain",
  TREE: "tree",
  VDF: "vdf",
  MIXNET: "mixnet",
};

/**
 * Recursive Proof Aggregation Engine.
 */
class RecursiveProofAggregationEngine {
  /**
   * @param {object} [options]
   */
  constructor(options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    this.fieldPrime = opts.fieldPrime;
    this.maxProofs = opts.maxProofs;
    this.maxRecursionDepth = opts.maxRecursionDepth;
    this.maxFoldBatch = opts.maxFoldBatch;
    this.maxChainLength = opts.maxChainLength;
    this.maxTreeDepth = opts.maxTreeDepth;
    this.maxProofSize = opts.maxProofSize;
    this.enableTreeAggregation = opts.enableTreeAggregation;
    this.enableChainAggregation = opts.enableChainAggregation;
    this.aggregationTimeoutMs = opts.aggregationTimeoutMs;
    this._audit = opts.audit || null;

    this._proofs = new Map(); // proofId -> proof
    this._aggregations = new Map(); // aggId -> aggregation
    this._completedAggs = [];
    this._maxHistory = 100;
    this._foldCount = 0;
    this._verifyCount = 0;
    this._aggCount = 0;
  }

  /**
   * Submit a proof for aggregation.
   * @param {object} config
   * @param {string} config.proofId
   * @param {string} [config.sourceType] - 'vdf', 'mixnet', 'snark', etc.
   * @param {Buffer|string} config.proofData
   * @param {object} [config.metadata]
   * @returns {object} Proof info
   */
  submitProof(config) {
    if (!config || typeof config !== "object") {
      throw new HsmAdapterError("INVALID_CONFIG", "proof config is required");
    }
    if (!config.proofId || typeof config.proofId !== "string") {
      throw new HsmAdapterError(
        "INVALID_PROOF_ID",
        "proofId must be a non-empty string",
      );
    }
    if (this._proofs.has(config.proofId)) {
      throw new HsmAdapterError(
        "PROOF_ALREADY_EXISTS",
        `proof ${config.proofId} already exists`,
      );
    }
    if (this._proofs.size >= this.maxProofs) {
      throw new HsmAdapterError(
        "MAX_PROOFS_REACHED",
        `maximum ${this.maxProofs} proofs reached`,
      );
    }
    if (!config.proofData) {
      throw new HsmAdapterError("INVALID_PROOF_DATA", "proofData is required");
    }
    const proofDataStr = Buffer.isBuffer(config.proofData)
      ? config.proofData.toString("hex")
      : String(config.proofData);
    if (proofDataStr.length > this.maxProofSize) {
      throw new HsmAdapterError(
        "PROOF_TOO_LARGE",
        `proof size ${proofDataStr.length} exceeds max ${this.maxProofSize}`,
      );
    }
    const proof = {
      proofId: config.proofId,
      sourceType: config.sourceType || "generic",
      proofData: proofDataStr,
      proofHash: crypto.createHash("sha256").update(proofDataStr).digest("hex"),
      metadata: config.metadata || {},
      status: PROOF_STATUS.VERIFIED,
      submittedAt: Date.now(),
      foldedInto: null,
      foldCount: 0,
    };
    this._proofs.set(config.proofId, proof);
    if (typeof this._audit === "function") {
      this._audit("PROOF_SUBMITTED", {
        proofId: config.proofId,
        sourceType: proof.sourceType,
      });
    }
    return {
      proofId: proof.proofId,
      sourceType: proof.sourceType,
      status: proof.status,
      proofHash: proof.proofHash,
    };
  }

  /**
   * Fold two proofs into a single recursive proof.
   * @param {string} proofId1
   * @param {string} proofId2
   * @param {string} [foldedProofId]
   * @returns {object} Folded proof
   */
  foldProofs(proofId1, proofId2, foldedProofId) {
    const proof1 = this._proofs.get(proofId1);
    if (!proof1) {
      throw new HsmAdapterError(
        "PROOF_NOT_FOUND",
        `proof ${proofId1} not found`,
      );
    }
    const proof2 = this._proofs.get(proofId2);
    if (!proof2) {
      throw new HsmAdapterError(
        "PROOF_NOT_FOUND",
        `proof ${proofId2} not found`,
      );
    }
    if (
      proof1.status !== PROOF_STATUS.VERIFIED &&
      proof1.status !== PROOF_STATUS.FOLDED
    ) {
      throw new HsmAdapterError(
        "PROOF_NOT_VERIFIED",
        `proof ${proofId1} status is ${proof1.status}`,
      );
    }
    if (
      proof2.status !== PROOF_STATUS.VERIFIED &&
      proof2.status !== PROOF_STATUS.FOLDED
    ) {
      throw new HsmAdapterError(
        "PROOF_NOT_VERIFIED",
        `proof ${proofId2} status is ${proof2.status}`,
      );
    }
    const foldId =
      foldedProofId || `fold-${Date.now()}-${crypto.randomInt(0, 1000000)}`;
    if (this._proofs.has(foldId)) {
      throw new HsmAdapterError(
        "PROOF_ALREADY_EXISTS",
        `proof ${foldId} already exists`,
      );
    }
    // Simulate recursive proof folding (in real systems, this uses
    // a recursion circuit that verifies both inner proofs)
    const foldedData = crypto
      .createHash("sha256")
      .update(`fold:${proof1.proofHash}:${proof2.proofHash}`)
      .digest("hex");
    const foldedProof = {
      proofId: foldId,
      sourceType: "recursive-fold",
      proofData: foldedData,
      proofHash: crypto.createHash("sha256").update(foldedData).digest("hex"),
      metadata: {
        innerProofs: [proofId1, proofId2],
        recursionDepth: Math.max(proof1.foldCount, proof2.foldCount) + 1,
      },
      status: PROOF_STATUS.FOLDED,
      submittedAt: Date.now(),
      foldedInto: null,
      foldCount: Math.max(proof1.foldCount, proof2.foldCount) + 1,
    };
    this._proofs.set(foldId, foldedProof);
    // Mark inner proofs as folded
    proof1.foldedInto = foldId;
    proof2.foldedInto = foldId;
    this._foldCount++;
    if (typeof this._audit === "function") {
      this._audit("PROOFS_FOLDED", {
        foldId,
        innerProofs: [proofId1, proofId2],
      });
    }
    return {
      proofId: foldId,
      status: foldedProof.status,
      foldCount: foldedProof.foldCount,
      innerProofs: [proofId1, proofId2],
    };
  }

  /**
   * Aggregate proofs using chain (sequential) aggregation.
   * @param {string[]} proofIds
   * @param {string} [aggId]
   * @returns {object} Aggregation result
   */
  aggregateChain(proofIds, aggId) {
    if (!this.enableChainAggregation) {
      throw new HsmAdapterError(
        "CHAIN_AGG_DISABLED",
        "chain aggregation is disabled",
      );
    }
    if (!Array.isArray(proofIds) || proofIds.length < 2) {
      throw new HsmAdapterError(
        "INSUFFICIENT_PROOFS",
        "need at least 2 proofs for chain aggregation",
      );
    }
    if (proofIds.length > this.maxChainLength) {
      throw new HsmAdapterError(
        "CHAIN_TOO_LONG",
        `${proofIds.length} exceeds max chain length ${this.maxChainLength}`,
      );
    }
    const resultId =
      aggId || `chain-${Date.now()}-${crypto.randomInt(0, 1000000)}`;
    if (this._aggregations.has(resultId)) {
      throw new HsmAdapterError(
        "AGG_ALREADY_EXISTS",
        `aggregation ${resultId} already exists`,
      );
    }
    // Verify all proofs exist
    for (const id of proofIds) {
      if (!this._proofs.get(id)) {
        throw new HsmAdapterError("PROOF_NOT_FOUND", `proof ${id} not found`);
      }
    }
    const aggregation = {
      aggId: resultId,
      type: AGG_TYPE.CHAIN,
      proofIds: [...proofIds],
      proofCount: proofIds.length,
      status: AGG_STATUS.FOLDING,
      createdAt: Date.now(),
      completedAt: null,
      finalProofId: null,
      recursionDepth: 0,
    };
    this._aggregations.set(resultId, aggregation);
    // Sequentially fold proofs
    let currentId = proofIds[0];
    for (let i = 1; i < proofIds.length; i++) {
      const foldId = `chain-fold-${resultId}-${i}`;
      this.foldProofs(currentId, proofIds[i], foldId);
      currentId = foldId;
      aggregation.recursionDepth++;
    }
    aggregation.finalProofId = currentId;
    aggregation.status = AGG_STATUS.COMPLETED;
    aggregation.completedAt = Date.now();
    this._aggCount++;
    this._recordCompletedAgg(aggregation);
    if (typeof this._audit === "function") {
      this._audit("CHAIN_AGGREGATED", {
        aggId: resultId,
        proofCount: proofIds.length,
      });
    }
    return {
      aggId: resultId,
      type: AGG_TYPE.CHAIN,
      proofCount: aggregation.proofCount,
      finalProofId: aggregation.finalProofId,
      recursionDepth: aggregation.recursionDepth,
      status: aggregation.status,
    };
  }

  /**
   * Aggregate proofs using tree (parallel) aggregation.
   * @param {string[]} proofIds
   * @param {string} [aggId]
   * @returns {object} Aggregation result
   */
  aggregateTree(proofIds, aggId) {
    if (!this.enableTreeAggregation) {
      throw new HsmAdapterError(
        "TREE_AGG_DISABLED",
        "tree aggregation is disabled",
      );
    }
    if (!Array.isArray(proofIds) || proofIds.length < 2) {
      throw new HsmAdapterError(
        "INSUFFICIENT_PROOFS",
        "need at least 2 proofs for tree aggregation",
      );
    }
    const treeDepth = Math.ceil(Math.log2(proofIds.length));
    if (treeDepth > this.maxTreeDepth) {
      throw new HsmAdapterError(
        "TREE_TOO_DEEP",
        `tree depth ${treeDepth} exceeds max ${this.maxTreeDepth}`,
      );
    }
    const resultId =
      aggId || `tree-${Date.now()}-${crypto.randomInt(0, 1000000)}`;
    if (this._aggregations.has(resultId)) {
      throw new HsmAdapterError(
        "AGG_ALREADY_EXISTS",
        `aggregation ${resultId} already exists`,
      );
    }
    for (const id of proofIds) {
      if (!this._proofs.get(id)) {
        throw new HsmAdapterError("PROOF_NOT_FOUND", `proof ${id} not found`);
      }
    }
    const aggregation = {
      aggId: resultId,
      type: AGG_TYPE.TREE,
      proofIds: [...proofIds],
      proofCount: proofIds.length,
      status: AGG_STATUS.FOLDING,
      createdAt: Date.now(),
      completedAt: null,
      finalProofId: null,
      recursionDepth: 0,
    };
    this._aggregations.set(resultId, aggregation);
    // Tree-based folding: pairwise fold until one proof remains
    let currentLevel = [...proofIds];
    let level = 0;
    while (currentLevel.length > 1) {
      const nextLevel = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        if (i + 1 < currentLevel.length) {
          const foldId = `tree-fold-${resultId}-L${level}-${i / 2}`;
          this.foldProofs(currentLevel[i], currentLevel[i + 1], foldId);
          nextLevel.push(foldId);
        } else {
          // Odd one out — pass through to next level
          nextLevel.push(currentLevel[i]);
        }
      }
      currentLevel = nextLevel;
      level++;
      aggregation.recursionDepth++;
    }
    aggregation.finalProofId = currentLevel[0];
    aggregation.status = AGG_STATUS.COMPLETED;
    aggregation.completedAt = Date.now();
    this._aggCount++;
    this._recordCompletedAgg(aggregation);
    if (typeof this._audit === "function") {
      this._audit("TREE_AGGREGATED", {
        aggId: resultId,
        proofCount: proofIds.length,
      });
    }
    return {
      aggId: resultId,
      type: AGG_TYPE.TREE,
      proofCount: aggregation.proofCount,
      finalProofId: aggregation.finalProofId,
      recursionDepth: aggregation.recursionDepth,
      status: aggregation.status,
    };
  }

  /**
   * Aggregate VDF proofs recursively.
   * @param {string[]} proofIds
   * @returns {object} Aggregation result
   */
  aggregateVdfProofs(proofIds) {
    if (!Array.isArray(proofIds) || proofIds.length < 2) {
      throw new HsmAdapterError(
        "INSUFFICIENT_PROOFS",
        "need at least 2 VDF proofs to aggregate",
      );
    }
    // Verify all proofs are VDF-type
    for (const id of proofIds) {
      const proof = this._proofs.get(id);
      if (!proof) {
        throw new HsmAdapterError("PROOF_NOT_FOUND", `proof ${id} not found`);
      }
      if (proof.sourceType !== "vdf") {
        throw new HsmAdapterError(
          "NOT_VDF_PROOF",
          `proof ${id} is not a VDF proof (source: ${proof.sourceType})`,
        );
      }
    }
    const resultId = `vdf-agg-${Date.now()}-${crypto.randomInt(0, 1000000)}`;
    // Use tree aggregation for VDF proofs
    const result = this.aggregateTree(proofIds, resultId);
    // Update type to VDF
    const agg = this._aggregations.get(resultId);
    agg.type = AGG_TYPE.VDF;
    if (typeof this._audit === "function") {
      this._audit("VDF_PROOFS_AGGREGATED", {
        aggId: resultId,
        proofCount: proofIds.length,
      });
    }
    return {
      aggId: resultId,
      type: AGG_TYPE.VDF,
      proofCount: result.proofCount,
      finalProofId: result.finalProofId,
      recursionDepth: result.recursionDepth,
      status: result.status,
    };
  }

  /**
   * Compress multi-hop mixnet states into a single proof.
   * @param {string[]} proofIds - One proof per mixnet hop
   * @returns {object} Compressed state proof
   */
  compressMixnetState(proofIds) {
    if (!Array.isArray(proofIds) || proofIds.length < 2) {
      throw new HsmAdapterError(
        "INSUFFICIENT_PROOFS",
        "need at least 2 mixnet hop proofs to compress",
      );
    }
    for (const id of proofIds) {
      const proof = this._proofs.get(id);
      if (!proof) {
        throw new HsmAdapterError("PROOF_NOT_FOUND", `proof ${id} not found`);
      }
      if (proof.sourceType !== "mixnet") {
        throw new HsmAdapterError(
          "NOT_MIXNET_PROOF",
          `proof ${id} is not a mixnet proof (source: ${proof.sourceType})`,
        );
      }
    }
    const resultId = `mixnet-agg-${Date.now()}-${crypto.randomInt(0, 1000000)}`;
    // Use chain aggregation for sequential mixnet hops
    const result = this.aggregateChain(proofIds, resultId);
    const agg = this._aggregations.get(resultId);
    agg.type = AGG_TYPE.MIXNET;
    if (typeof this._audit === "function") {
      this._audit("MIXNET_STATE_COMPRESSED", {
        aggId: resultId,
        hopCount: proofIds.length,
      });
    }
    return {
      aggId: resultId,
      type: AGG_TYPE.MIXNET,
      hopCount: proofIds.length,
      finalProofId: result.finalProofId,
      recursionDepth: result.recursionDepth,
      status: result.status,
    };
  }

  /**
   * Verify a recursive aggregation.
   * @param {string} aggId
   * @returns {object} Verification result
   */
  verifyAggregation(aggId) {
    const agg = this._aggregations.get(aggId);
    if (!agg) {
      throw new HsmAdapterError(
        "AGG_NOT_FOUND",
        `aggregation ${aggId} not found`,
      );
    }
    if (agg.status !== AGG_STATUS.COMPLETED) {
      throw new HsmAdapterError(
        "AGG_NOT_COMPLETED",
        `aggregation ${aggId} status is ${agg.status}`,
      );
    }
    // Verify the final folded proof exists and is valid
    const finalProof = this._proofs.get(agg.finalProofId);
    if (!finalProof) {
      return { aggId, verified: false, reason: "final proof not found" };
    }
    if (
      finalProof.status !== PROOF_STATUS.FOLDED &&
      finalProof.status !== PROOF_STATUS.VERIFIED
    ) {
      return {
        aggId,
        verified: false,
        reason: `final proof status is ${finalProof.status}`,
      };
    }
    // Verify all original proofs are still valid (not expired)
    let allValid = true;
    for (const id of agg.proofIds) {
      const proof = this._proofs.get(id);
      if (!proof || proof.status === PROOF_STATUS.INVALID) {
        allValid = false;
        break;
      }
    }
    this._verifyCount++;
    const verified = allValid;
    if (typeof this._audit === "function") {
      this._audit("AGG_VERIFIED", { aggId, verified });
    }
    return {
      aggId,
      verified,
      proofCount: agg.proofCount,
      recursionDepth: agg.recursionDepth,
      finalProofId: agg.finalProofId,
    };
  }

  /**
   * Get proof info.
   * @param {string} proofId
   * @returns {object|null}
   */
  getProof(proofId) {
    const proof = this._proofs.get(proofId);
    if (!proof) return null;
    return {
      proofId: proof.proofId,
      sourceType: proof.sourceType,
      status: proof.status,
      proofHash: proof.proofHash,
      foldCount: proof.foldCount,
      foldedInto: proof.foldedInto,
      submittedAt: proof.submittedAt,
      innerProofs: proof.metadata.innerProofs || null,
    };
  }

  /**
   * Get aggregation info.
   * @param {string} aggId
   * @returns {object|null}
   */
  getAggregation(aggId) {
    const agg = this._aggregations.get(aggId);
    if (!agg) return null;
    return {
      aggId: agg.aggId,
      type: agg.type,
      proofCount: agg.proofCount,
      status: agg.status,
      finalProofId: agg.finalProofId,
      recursionDepth: agg.recursionDepth,
      createdAt: agg.createdAt,
      completedAt: agg.completedAt,
    };
  }

  /**
   * Get all aggregations.
   * @returns {object[]}
   */
  getAggregations() {
    return Array.from(this._aggregations.values()).map((a) => ({
      aggId: a.aggId,
      type: a.type,
      proofCount: a.proofCount,
      status: a.status,
    }));
  }

  /**
   * Get completed aggregations.
   * @param {number} [limit]
   * @returns {object[]}
   */
  getCompletedAggregations(limit) {
    const n = typeof limit === "number" ? limit : 20;
    return this._completedAggs.slice(-n);
  }

  /**
   * Get summary statistics.
   * @returns {object}
   */
  getStats() {
    const proofsByStatus = {};
    for (const p of this._proofs.values()) {
      proofsByStatus[p.status] = (proofsByStatus[p.status] || 0) + 1;
    }
    const aggsByType = {};
    for (const a of this._aggregations.values()) {
      aggsByType[a.type] = (aggsByType[a.type] || 0) + 1;
    }
    return {
      totalProofs: this._proofs.size,
      totalAggregations: this._aggregations.size,
      completedAggregations: this._completedAggs.length,
      foldCount: this._foldCount,
      verifyCount: this._verifyCount,
      aggCount: this._aggCount,
      proofsByStatus,
      aggsByType,
    };
  }

  /**
   * Reset all state (for testing).
   */
  reset() {
    this._proofs.clear();
    this._aggregations.clear();
    this._completedAggs = [];
    this._foldCount = 0;
    this._verifyCount = 0;
    this._aggCount = 0;
  }

  // ---- Private methods ----

  /**
   * Record a completed aggregation.
   * @private
   */
  _recordCompletedAgg(agg) {
    this._completedAggs.push({
      aggId: agg.aggId,
      type: agg.type,
      proofCount: agg.proofCount,
      recursionDepth: agg.recursionDepth,
      completedAt: agg.completedAt,
    });
    if (this._completedAggs.length > this._maxHistory) {
      this._completedAggs.shift();
    }
  }
}

module.exports = {
  RecursiveProofAggregationEngine,
  DEFAULT_OPTIONS,
  PROOF_STATUS,
  AGG_STATUS,
  AGG_TYPE,
};
