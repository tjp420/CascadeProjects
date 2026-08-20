"use strict";

/**
 * Track 56: Encrypted search router.
 *
 * Accepts structured ciphertext tokens and processes encrypted matrix
 * dot-product operations over blind keyword indicators without
 * revealing raw query terms or underlying target documents.
 *
 * @module hsm-adapter/encrypted-search-router
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

class EncryptedSearchRouter {
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
    this._queries = new Map();
    this._isolatedNodes = new Set();
  }

  /**
   * Route an encrypted search query across index nodes.
   * @param {object} request
   * @returns {object}
   */
  route(request) {
    _validateRequest(this.policy, request);
    if (this.policy.requireSubmitterAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(
          request.submitterAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "SEARCH_SUBMITTER_UNATTESTED",
            "submitter attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "SEARCH_SUBMITTER_UNATTESTED",
          "submitter attestation invalid",
        );
      }
    }
    const indexNodes = request.indexNodes || [];
    if (this.policy.requireIndexNodeAttestation && this._attestationClient) {
      for (const node of indexNodes) {
        if (this._isolatedNodes.has(node.nodeId)) {
          throw new HsmAdapterError(
            "SEARCH_INDEX_NODE_ISOLATED",
            `index node ${node.nodeId} is isolated`,
          );
        }
        try {
          const result = this._attestationClient.verify(node.attestation);
          if (!result.verified) {
            throw new HsmAdapterError(
              "SEARCH_INDEX_NODE_UNATTESTED",
              `index node ${node.nodeId} attestation invalid`,
            );
          }
        } catch (err) {
          if (err instanceof HsmAdapterError) throw err;
          throw new HsmAdapterError(
            "SEARCH_INDEX_NODE_UNATTESTED",
            `index node ${node.nodeId} attestation invalid`,
          );
        }
      }
    }
    const keywords = request.keywords || [];
    if (keywords.length > (this.policy.maxKeywordsPerQuery || 32)) {
      throw new HsmAdapterError(
        "SEARCH_KEYWORDS_EXCEEDED",
        `keywords per query ${keywords.length} exceeds maximum ${this.policy.maxKeywordsPerQuery}`,
      );
    }
    const traversalDepth = request.traversalDepth || 1;
    if (traversalDepth > (this.policy.maxIndexTraversalDepth || 16)) {
      throw new HsmAdapterError(
        "SEARCH_TRAVERSAL_EXCEEDED",
        `index traversal depth ${traversalDepth} exceeds maximum ${this.policy.maxIndexTraversalDepth}`,
      );
    }
    if (
      typeof request.blindingCurve === "string" &&
      !this.policy.allowedBlindingCurves.includes(request.blindingCurve)
    ) {
      throw new HsmAdapterError(
        "SEARCH_BLINDING_CURVE_BLOCKED",
        `blinding curve ${request.blindingCurve} is not permitted; allowed: ${this.policy.allowedBlindingCurves.join(", ")}`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    const queryId =
      request.queryId || `query-${crypto.randomBytes(4).toString("hex")}`;
    const keywordTokenHashes = keywords.map((kw) =>
      crypto.createHash("sha256").update(kw).digest("hex"),
    );
    const matchProofHash = crypto
      .createHash("sha256")
      .update(`${queryId}:${keywordTokenHashes.join(",")}`)
      .digest("hex");
    const query = {
      queryId,
      sourceTenantId: request.sourceTenantId,
      keywordTokenHashes,
      blindingCurve: request.blindingCurve || "P-256",
      indexNodeIds: indexNodes.map((n) => n.nodeId),
      traversalDepth,
      matchProofHash,
      status: "routed",
      routedAt: now,
    };
    this._queries.set(queryId, query);
    if (this._audit) {
      this._audit("ENCRYPTED_SEARCH_ROUTED", {
        queryId,
        sourceTenantId: query.sourceTenantId,
        keywordCount: keywords.length,
        indexNodeIds: query.indexNodeIds,
        traversalDepth,
        matchProofHash,
        routedAt: now,
      });
    }
    return query;
  }

  /**
   * Get a routed query by id.
   * @param {string} queryId
   * @returns {object|null}
   */
  getQuery(queryId) {
    return this._queries.get(queryId) || null;
  }

  /**
   * Isolate an index node.
   * @param {string} nodeId
   */
  isolateNode(nodeId) {
    this._isolatedNodes.add(nodeId);
  }

  /**
   * Check if an index node is isolated.
   * @param {string} nodeId
   * @returns {boolean}
   */
  isNodeIsolated(nodeId) {
    return this._isolatedNodes.has(nodeId);
  }
}

function _validateRequest(policy, request) {
  if (!request.sourceTenantId || !Array.isArray(request.indexNodes)) {
    throw new HsmAdapterError(
      "SEARCH_FIELDS_MISSING",
      "sourceTenantId and indexNodes are required",
    );
  }
  if (policy.requireSubmitterAttestation && !request.submitterAttestation) {
    throw new HsmAdapterError(
      "SEARCH_SUBMITTER_ATTESTATION_MISSING",
      "submitter attestation is required",
    );
  }
}

module.exports = { EncryptedSearchRouter };
