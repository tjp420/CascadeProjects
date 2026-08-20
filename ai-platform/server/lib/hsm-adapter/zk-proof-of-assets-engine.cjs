"use strict";

/**
 * Track 36: ZK Proof-of-Assets.
 *
 * Generates non-interactive zero-knowledge proofs verifying that a
 * tenant's assets are fully backed by committed reserves, without
 * revealing individual asset amounts. Supports multi-tenant proofs
 * with per-tenant commitment trees and Merkle-root compact verification.
 *
 * Components:
 *   - AssetCommitment: Pedersen-style commitment hiding asset amounts
 *   - MerkleCommitmentTree: Merkle tree of asset commitments
 *   - ProofOfAssets: Non-interactive ZK proof of aggregate backing
 *   - Multi-tenant support: per-tenant commitment trees
 *   - BFT quorum gating: proof finalization requires t-of-N signatures
 *   - Anti-inflation: detects double-counted assets across tenants
 *
 * @module hsm-adapter/zk-proof-of-assets-engine
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

// ── Proof states ─────────────────────────────────────────────────
const PROOF_STATE = {
  DRAFT: "draft",
  COMMITTED: "committed",
  PROVEN: "proven",
  VERIFIED: "verified",
  INVALID: "invalid",
};

// ── Valid state transitions ──────────────────────────────────────
const VALID_TRANSITIONS = {
  [PROOF_STATE.DRAFT]: [PROOF_STATE.COMMITTED, PROOF_STATE.INVALID],
  [PROOF_STATE.COMMITTED]: [PROOF_STATE.PROVEN, PROOF_STATE.INVALID],
  [PROOF_STATE.PROVEN]: [PROOF_STATE.VERIFIED, PROOF_STATE.INVALID],
  [PROOF_STATE.VERIFIED]: [],
  [PROOF_STATE.INVALID]: [],
};

/**
 * AssetCommitment — Pedersen-style commitment hiding an asset amount.
 *
 * Computes C = H(amount || blinding) to create a deterministic
 * commitment that hides the amount without revealing it.
 */
class AssetCommitment {
  /**
   * @param {string} assetId
   * @param {number} amount — must be positive
   * @param {string} [blinding] — random blinding factor (auto-generated if omitted)
   */
  constructor(assetId, amount, blinding) {
    if (!assetId || typeof assetId !== "string") {
      throw new HsmAdapterError(
        "INVALID_INPUT",
        "assetId must be a non-empty string",
      );
    }
    if (typeof amount !== "number" || amount <= 0 || !Number.isFinite(amount)) {
      throw new HsmAdapterError(
        "INVALID_INPUT",
        `amount must be a positive finite number, got ${amount}`,
      );
    }
    this.assetId = assetId;
    this.amount = amount;
    this.blinding = blinding || crypto.randomBytes(32).toString("hex");
    this.commitment = this._compute();
  }

  _compute() {
    return crypto
      .createHash("sha256")
      .update(this.assetId)
      .update(this.amount.toString())
      .update(this.blinding)
      .digest("hex");
  }

  /**
   * Verify this commitment against a known amount and blinding.
   * @param {string} assetId
   * @param {number} amount
   * @param {string} blinding
   * @returns {boolean}
   */
  verify(assetId, amount, blinding) {
    const expected = crypto
      .createHash("sha256")
      .update(assetId)
      .update(amount.toString())
      .update(blinding)
      .digest("hex");
    return expected === this.commitment;
  }
}

/**
 * MerkleCommitmentTree — Merkle tree of asset commitments.
 *
 * Aggregates individual asset commitments into a single Merkle root
 * for compact proof verification.
 */
class MerkleCommitmentTree {
  /**
   * @param {AssetCommitment[]} commitments
   */
  constructor(commitments) {
    if (!Array.isArray(commitments) || commitments.length === 0) {
      throw new HsmAdapterError(
        "INVALID_INPUT",
        "commitments must be a non-empty array",
      );
    }
    this.commitments = commitments;
    this.leaves = commitments.map((c) => c.commitment);
    this.root = this._computeRoot(this.leaves);
    this.tree = this._buildTree(this.leaves);
  }

  _computeRoot(leaves) {
    if (leaves.length === 1) return leaves[0];
    const nextLevel = [];
    for (let i = 0; i < leaves.length; i += 2) {
      const left = leaves[i];
      const right = i + 1 < leaves.length ? leaves[i + 1] : leaves[i];
      nextLevel.push(
        crypto.createHash("sha256").update(left).update(right).digest("hex"),
      );
    }
    return this._computeRoot(nextLevel);
  }

  _buildTree(leaves) {
    const tree = [leaves];
    let current = leaves;
    while (current.length > 1) {
      const nextLevel = [];
      for (let i = 0; i < current.length; i += 2) {
        const left = current[i];
        const right = i + 1 < current.length ? current[i + 1] : current[i];
        nextLevel.push(
          crypto.createHash("sha256").update(left).update(right).digest("hex"),
        );
      }
      tree.push(nextLevel);
      current = nextLevel;
    }
    return tree;
  }

  /**
   * Get the Merkle root hash.
   * @returns {string}
   */
  getRoot() {
    return this.root;
  }

  /**
   * Get the number of leaves (commitments).
   * @returns {number}
   */
  leafCount() {
    return this.leaves.length;
  }

  /**
   * Get all leaf commitments.
   * @returns {string[]}
   */
  getLeaves() {
    return [...this.leaves];
  }

  /**
   * Verify that a commitment exists in the tree.
   * @param {string} commitmentHash
   * @returns {boolean}
   */
  contains(commitmentHash) {
    return this.leaves.includes(commitmentHash);
  }
}

/**
 * ZkProofOfAssetsEngine.
 *
 * Manages the full lifecycle of ZK proof-of-assets generation and
 * verification with multi-tenant support and BFT quorum gating.
 */
class ZkProofOfAssetsEngine {
  /**
   * @param {object} options
   * @param {string[]} options.validatorNodes
   * @param {number} [options.minQuorumNodes]
   * @param {number} [options.maxAssetsPerProof]
   * @param {boolean} [options.requireQuorumFinalization]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    if (
      !Array.isArray(options.validatorNodes) ||
      options.validatorNodes.length === 0
    ) {
      throw new HsmAdapterError(
        "INVALID_INPUT",
        "validatorNodes must be a non-empty array",
      );
    }
    this.validatorNodes = new Set(options.validatorNodes);
    this.minQuorumNodes =
      options.minQuorumNodes ||
      Math.floor(options.validatorNodes.length / 2) + 1;
    this.maxAssetsPerProof = options.maxAssetsPerProof || 256;
    this.requireQuorumFinalization =
      options.requireQuorumFinalization !== false;
    this._audit = options.audit || null;

    // Per-tenant state
    this._tenants = new Map(); // tenantId -> { assets: Map<assetId, AssetCommitment>, usedAssetIds: Set }
    // Per-proof state
    this._proofs = new Map(); // proofId -> { tenantId, merkleTree, claimedBacking, state, signatures, proofHash }
    this._nextProofId = 1;
    // Global asset tracking for anti-inflation
    this._globalAssetRegistry = new Map(); // assetId -> tenantId (to detect double-counting)
  }

  /**
   * Register an asset for a tenant.
   * @param {string} tenantId
   * @param {string} assetId
   * @param {number} amount
   * @param {string} [blinding]
   * @returns {AssetCommitment}
   */
  registerAsset(tenantId, assetId, amount, blinding) {
    // Anti-inflation: check if asset is already registered globally
    if (this._globalAssetRegistry.has(assetId)) {
      const existingTenant = this._globalAssetRegistry.get(assetId);
      if (existingTenant !== tenantId) {
        throw new HsmAdapterError(
          "ASSET_DOUBLE_COUNTED",
          `asset ${assetId} is already registered by tenant ${existingTenant}`,
        );
      }
    }

    if (!this._tenants.has(tenantId)) {
      this._tenants.set(tenantId, {
        assets: new Map(),
        usedAssetIds: new Set(),
      });
    }
    const tenant = this._tenants.get(tenantId);
    const commitment = new AssetCommitment(assetId, amount, blinding);
    tenant.assets.set(assetId, commitment);
    this._globalAssetRegistry.set(assetId, tenantId);

    this._emitAudit("ASSET_REGISTERED", {
      tenantId,
      assetId,
      commitment: commitment.commitment,
    });
    return commitment;
  }

  /**
   * Build a commitment tree for a tenant and create a proof draft.
   * @param {string} tenantId
   * @param {number} claimedBacking — the total backing amount being claimed
   * @returns {object} proof draft
   */
  createProof(tenantId, claimedBacking) {
    const tenant = this._tenants.get(tenantId);
    if (!tenant || tenant.assets.size === 0) {
      throw new HsmAdapterError(
        "TENANT_NO_ASSETS",
        `tenant ${tenantId} has no registered assets`,
      );
    }
    if (typeof claimedBacking !== "number" || claimedBacking <= 0) {
      throw new HsmAdapterError(
        "INVALID_INPUT",
        "claimedBacking must be a positive number",
      );
    }
    if (tenant.assets.size > this.maxAssetsPerProof) {
      throw new HsmAdapterError(
        "ASSET_LIMIT_EXCEEDED",
        `tenant ${tenantId} has ${tenant.assets.size} assets, max is ${this.maxAssetsPerProof}`,
      );
    }

    const commitments = Array.from(tenant.assets.values());
    const merkleTree = new MerkleCommitmentTree(commitments);

    // Compute aggregate backing (sum of all asset amounts)
    const aggregateBacking = commitments.reduce((sum, c) => sum + c.amount, 0);

    // Verify that aggregate backing >= claimed backing
    if (aggregateBacking < claimedBacking) {
      throw new HsmAdapterError(
        "BACKING_INSUFFICIENT",
        `aggregate backing ${aggregateBacking} < claimed backing ${claimedBacking}`,
      );
    }

    const proofId = `poa-${this._nextProofId}`;
    this._nextProofId++;

    // Compute proof hash (deterministic)
    const proofPayload = JSON.stringify({
      proofId,
      tenantId,
      merkleRoot: merkleTree.getRoot(),
      claimedBacking,
      aggregateBacking,
      assetCount: commitments.length,
    });
    const proofHash = crypto
      .createHash("sha256")
      .update(proofPayload)
      .digest("hex");

    this._proofs.set(proofId, {
      proofId,
      tenantId,
      merkleTree,
      claimedBacking,
      aggregateBacking,
      assetCount: commitments.length,
      state: PROOF_STATE.DRAFT,
      signatures: new Map(), // nodeId -> signature
      proofHash,
    });

    this._emitAudit("PROOF_DRAFT_CREATED", {
      proofId,
      tenantId,
      claimedBacking,
      aggregateBacking,
      assetCount: commitments.length,
    });
    return {
      proofId,
      tenantId,
      merkleRoot: merkleTree.getRoot(),
      claimedBacking,
      aggregateBacking,
      state: PROOF_STATE.DRAFT,
    };
  }

  /**
   * Commit a proof (transition from DRAFT to COMMITTED).
   * @param {string} proofId
   */
  commitProof(proofId) {
    const proof = this._getProof(proofId);
    this._transition(proofId, PROOF_STATE.COMMITTED);
    this._emitAudit("PROOF_COMMITTED", { proofId, tenantId: proof.tenantId });
    return { proofId, state: PROOF_STATE.COMMITTED };
  }

  /**
   * Generate the ZK proof (transition from COMMITTED to PROVEN).
   * @param {string} proofId
   * @returns {object} proof bundle
   */
  generateProof(proofId) {
    const proof = this._getProof(proofId);
    this._transition(proofId, PROOF_STATE.PROVEN);

    const proofBundle = {
      proofId,
      tenantId: proof.tenantId,
      merkleRoot: proof.merkleTree.getRoot(),
      claimedBacking: proof.claimedBacking,
      aggregateBacking: proof.aggregateBacking,
      assetCount: proof.assetCount,
      proofHash: proof.proofHash,
      // The ZK proof itself: a signature over the proof payload
      // In production this would be a zk-SNARK; here we use a deterministic hash
      zkProof: crypto
        .createHash("sha256")
        .update(proof.proofHash)
        .update("zk-proof-of-assets")
        .digest("hex"),
    };

    this._emitAudit("PROOF_GENERATED", { proofId, tenantId: proof.tenantId });
    return proofBundle;
  }

  /**
   * Verify a proof bundle (transition from PROVEN to VERIFIED).
   * @param {object} proofBundle
   * @returns {object}
   */
  verifyProof(proofBundle) {
    const proof = this._getProof(proofBundle.proofId);
    if (proof.state !== PROOF_STATE.PROVEN) {
      throw new HsmAdapterError(
        "PROOF_NOT_PROVEN",
        `proof ${proofBundle.proofId} is in state ${proof.state}, must be proven`,
      );
    }

    // Verify proof hash integrity
    const expectedHash = proof.proofHash;
    if (proofBundle.proofHash !== expectedHash) {
      this._transition(proofBundle.proofId, PROOF_STATE.INVALID);
      throw new HsmAdapterError(
        "PROOF_HASH_MISMATCH",
        "proof hash does not match — tampering detected",
      );
    }

    // Verify Merkle root
    if (proofBundle.merkleRoot !== proof.merkleTree.getRoot()) {
      this._transition(proofBundle.proofId, PROOF_STATE.INVALID);
      throw new HsmAdapterError(
        "MERKLE_ROOT_MISMATCH",
        "Merkle root does not match",
      );
    }

    // Verify aggregate backing >= claimed backing
    if (proofBundle.aggregateBacking < proofBundle.claimedBacking) {
      this._transition(proofBundle.proofId, PROOF_STATE.INVALID);
      throw new HsmAdapterError(
        "BACKING_INSUFFICIENT",
        "aggregate backing < claimed backing",
      );
    }

    // Verify ZK proof
    const expectedZkProof = crypto
      .createHash("sha256")
      .update(expectedHash)
      .update("zk-proof-of-assets")
      .digest("hex");
    if (proofBundle.zkProof !== expectedZkProof) {
      this._transition(proofBundle.proofId, PROOF_STATE.INVALID);
      throw new HsmAdapterError(
        "ZK_PROOF_INVALID",
        "ZK proof verification failed",
      );
    }

    this._transition(proofBundle.proofId, PROOF_STATE.VERIFIED);
    this._emitAudit("PROOF_VERIFIED", {
      proofId: proofBundle.proofId,
      tenantId: proof.tenantId,
    });
    return {
      verified: true,
      proofId: proofBundle.proofId,
      state: PROOF_STATE.VERIFIED,
    };
  }

  /**
   * Sign a verified proof by a validator node (quorum finalization).
   * @param {string} proofId
   * @param {string} nodeId
   * @param {string} signature
   */
  signProof(proofId, nodeId, signature) {
    this._validateNode(nodeId);
    const proof = this._getProof(proofId);
    if (proof.state !== PROOF_STATE.VERIFIED) {
      throw new HsmAdapterError(
        "PROOF_NOT_VERIFIED",
        `proof ${proofId} must be verified before signing`,
      );
    }
    proof.signatures.set(nodeId, signature);
    this._emitAudit("PROOF_SIGNED", {
      proofId,
      nodeId,
      totalSignatures: proof.signatures.size,
    });
    return {
      proofId,
      nodeId,
      totalSignatures: proof.signatures.size,
      quorumReached: proof.signatures.size >= this.minQuorumNodes,
    };
  }

  /**
   * Check if a proof has reached quorum finalization.
   * @param {string} proofId
   * @returns {boolean}
   */
  isFinalized(proofId) {
    const proof = this._getProof(proofId);
    return (
      proof.state === PROOF_STATE.VERIFIED &&
      proof.signatures.size >= this.minQuorumNodes
    );
  }

  /**
   * Get the state of a proof.
   * @param {string} proofId
   * @returns {object}
   */
  getProofState(proofId) {
    const proof = this._getProof(proofId);
    return {
      proofId,
      tenantId: proof.tenantId,
      state: proof.state,
      claimedBacking: proof.claimedBacking,
      aggregateBacking: proof.aggregateBacking,
      assetCount: proof.assetCount,
      merkleRoot: proof.merkleTree.getRoot(),
      signatures: proof.signatures.size,
      quorumRequired: this.minQuorumNodes,
      finalized: this.isFinalized(proofId),
    };
  }

  /**
   * Get a tenant's registered asset IDs.
   * @param {string} tenantId
   * @returns {string[]}
   */
  getTenantAssets(tenantId) {
    const tenant = this._tenants.get(tenantId);
    if (!tenant) return [];
    return Array.from(tenant.assets.keys());
  }

  /**
   * Get engine telemetry.
   * @returns {object}
   */
  getEngineState() {
    return {
      totalTenants: this._tenants.size,
      totalProofs: this._proofs.size,
      totalAssets: this._globalAssetRegistry.size,
      validatorCount: this.validatorNodes.size,
      minQuorumNodes: this.minQuorumNodes,
    };
  }

  /**
   * Get a proof record or throw.
   * @param {string} proofId
   * @returns {object}
   */
  _getProof(proofId) {
    const proof = this._proofs.get(proofId);
    if (!proof) {
      throw new HsmAdapterError(
        "PROOF_NOT_FOUND",
        `proof ${proofId} not found`,
      );
    }
    return proof;
  }

  /**
   * Validate that a node is a validator.
   * @param {string} nodeId
   */
  _validateNode(nodeId) {
    if (!this.validatorNodes.has(nodeId)) {
      throw new HsmAdapterError(
        "VALIDATOR_UNKNOWN",
        `node ${nodeId} is not a validator`,
      );
    }
  }

  /**
   * Transition a proof to a new state.
   * @param {string} proofId
   * @param {string} newState
   */
  _transition(proofId, newState) {
    const proof = this._getProof(proofId);
    const allowed = VALID_TRANSITIONS[proof.state] || [];
    if (!allowed.includes(newState)) {
      throw new HsmAdapterError(
        "PROOF_INVALID_TRANSITION",
        `cannot transition proof ${proofId} from ${proof.state} to ${newState}`,
      );
    }
    proof.state = newState;
  }

  _emitAudit(event, data) {
    if (this._audit) this._audit(event, { timestamp: Date.now(), ...data });
  }
}

module.exports = {
  ZkProofOfAssetsEngine,
  AssetCommitment,
  MerkleCommitmentTree,
  PROOF_STATE,
  VALID_TRANSITIONS,
};
