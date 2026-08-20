"use strict";

/**
 * Track 31: ZK lookup claim validator.
 *
 * Validates the homomorphic lookup digest, quorum, depth, and attestation
 * requirements for Track 31 gating.
 *
 * @module hsm-adapter/zk-lookup-claim-validator
 */

const { HsmAdapterError } = require("./base-adapter.cjs");

class ZkLookupClaimValidator {
  constructor(policy = {}) {
    this._minLookupQuorum = policy.minLookupQuorum || 12;
    this._maxLookupDepth = policy.maxLookupDepth || 32;
    this._requireEncryptedQueryAttestation =
      policy.requireEncryptedQueryAttestation !== false;
  }

  /**
   * Validate a lookup claim.
   * @param {{voters?: string[], queryTree?: object, digest?: string, attestation?: boolean}} claim
   */
  validate(claim) {
    if (!claim || typeof claim !== "object") {
      throw new HsmAdapterError(
        "LOOKUPCLAIM_INVALID_INPUT",
        "claim must be an object",
      );
    }

    const voters = Array.isArray(claim.voters) ? claim.voters : [];
    if (voters.length < this._minLookupQuorum) {
      throw new HsmAdapterError(
        "LOOKUPCLAIM_QUORUM_TOO_LOW",
        `voters ${voters.length} below minimum ${this._minLookupQuorum}`,
      );
    }

    if (this._requireEncryptedQueryAttestation && claim.attestation !== true) {
      throw new HsmAdapterError(
        "LOOKUPCLAIM_UNATTESTED_QUERY",
        "encrypted query attestation is required",
      );
    }

    const depth = this._measureDepth(claim.queryTree);
    if (depth > this._maxLookupDepth) {
      throw new HsmAdapterError(
        "LOOKUPCLAIM_MAX_DEPTH_EXCEEDED",
        `query tree depth ${depth} exceeds maximum ${this._maxLookupDepth}`,
      );
    }

    if (typeof claim.digest !== "string" || claim.digest.length === 0) {
      throw new HsmAdapterError(
        "LOOKUPCLAIM_MISSING_DIGEST",
        "homomorphicLookupDigest is required",
      );
    }
  }

  _measureDepth(node, current = 0) {
    if (node == null || typeof node !== "object") return current;
    if (Array.isArray(node)) {
      if (node.length === 0) return current;
      return Math.max(
        ...node.map((child) => this._measureDepth(child, current + 1)),
      );
    }
    const children = Object.values(node);
    if (children.length === 0) return current;
    return Math.max(
      ...children.map((child) => this._measureDepth(child, current + 1)),
    );
  }
}

module.exports = { ZkLookupClaimValidator };
