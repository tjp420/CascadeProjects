"use strict";

/**
 * Track 56: MPC search match verifier.
 *
 * Aggregates partial evaluation keys across an administrative
 * committee to safely verify encrypted search lookups without
 * intermediate state visibility. Handles automatic isolation
 * boundaries if directory peers drop below minVerificationQuorum.
 *
 * @module hsm-adapter/mpc-search-match-verifier
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

class MpcSearchMatchVerifier {
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
    this._pending = new Map();
    this._isolatedNodes = new Set();
  }

  /**
   * Initiate a multi-party verification session for a search query.
   * @param {object} request
   * @returns {object}
   */
  initiate(request) {
    if (
      !request.verificationId ||
      !request.query ||
      !Array.isArray(request.committeeNodes)
    ) {
      throw new HsmAdapterError(
        "MPC_SEARCH_FIELDS_MISSING",
        "verificationId, query, and committeeNodes are required",
      );
    }
    if (
      request.committeeNodes.length < (this.policy.minVerificationQuorum || 3)
    ) {
      if (this.policy.isolateLowQuorumIndexNodes) {
        for (const node of request.committeeNodes) {
          this._isolatedNodes.add(node.nodeId);
        }
      }
      throw new HsmAdapterError(
        "MPC_SEARCH_QUORUM_INSUFFICIENT",
        `committee nodes ${request.committeeNodes.length} below minimum ${this.policy.minVerificationQuorum}`,
      );
    }
    if (this.policy.requireIndexNodeAttestation && this._attestationClient) {
      for (const node of request.committeeNodes) {
        if (this._isolatedNodes.has(node.nodeId)) {
          throw new HsmAdapterError(
            "MPC_SEARCH_NODE_ISOLATED",
            `committee node ${node.nodeId} is isolated`,
          );
        }
        try {
          const result = this._attestationClient.verify(node.attestation);
          if (!result.verified) {
            throw new HsmAdapterError(
              "MPC_SEARCH_NODE_UNATTESTED",
              `committee node ${node.nodeId} attestation invalid`,
            );
          }
        } catch (err) {
          if (err instanceof HsmAdapterError) throw err;
          throw new HsmAdapterError(
            "MPC_SEARCH_NODE_UNATTESTED",
            `committee node ${node.nodeId} attestation invalid`,
          );
        }
      }
    }
    const session = {
      verificationId: request.verificationId,
      query: request.query,
      committeeNodeIds: request.committeeNodes.map((n) => n.nodeId),
      evaluations: [],
      status: "pending",
    };
    this._pending.set(request.verificationId, session);
    return session;
  }

  /**
   * Submit a partial evaluation from a committee node.
   * @param {string} verificationId
   * @param {string} nodeId
   * @param {string} evaluationShare
   * @returns {object}
   */
  submit(verificationId, nodeId, evaluationShare) {
    const session = this._pending.get(verificationId);
    if (!session) {
      throw new HsmAdapterError(
        "MPC_SEARCH_SESSION_NOT_FOUND",
        `no pending verification ${verificationId}`,
      );
    }
    if (!session.committeeNodeIds.includes(nodeId)) {
      throw new HsmAdapterError(
        "MPC_SEARCH_NODE_NOT_AUTHORIZED",
        `node ${nodeId} not authorized for verification ${verificationId}`,
      );
    }
    if (this._isolatedNodes.has(nodeId)) {
      throw new HsmAdapterError(
        "MPC_SEARCH_NODE_ISOLATED",
        `node ${nodeId} is isolated`,
      );
    }
    if (!evaluationShare || typeof evaluationShare !== "string") {
      throw new HsmAdapterError(
        "MPC_SEARCH_EVALUATION_MISSING",
        "evaluation share is required",
      );
    }
    session.evaluations.push({ nodeId, evaluationShare });
    if (
      session.evaluations.length >= (this.policy.minVerificationQuorum || 3)
    ) {
      session.status = "verified";
      const verifiedHash = crypto
        .createHash("sha256")
        .update(session.evaluations.map((e) => e.evaluationShare).join(","))
        .digest("hex");
      if (this._audit) {
        this._audit("MPC_INDEX_MATCH_VERIFIED", {
          verificationId,
          queryId: session.query.queryId,
          committeeNodeIds: session.committeeNodeIds,
          evaluations: session.evaluations.length,
          verifiedHash,
        });
      }
      this._pending.delete(verificationId);
    }
    return {
      submitted: true,
      status: session.status,
      evaluations: session.evaluations.length,
    };
  }

  /**
   * Check if a node is isolated.
   * @param {string} nodeId
   * @returns {boolean}
   */
  isNodeIsolated(nodeId) {
    return this._isolatedNodes.has(nodeId);
  }

  /**
   * Get pending session status.
   * @param {string} verificationId
   * @returns {object|null}
   */
  getStatus(verificationId) {
    return this._pending.get(verificationId) || null;
  }
}

module.exports = { MpcSearchMatchVerifier };
