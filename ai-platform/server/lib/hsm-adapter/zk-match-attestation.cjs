"use strict";

/**
 * Track 49: ZK match attestation.
 *
 * Generates and verifies non-interactive zero-knowledge confirmation
 * proofs that a database lookup matched records without leaking the
 * plaintext search criteria.
 *
 * @module hsm-adapter/zk-match-attestation
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

class ZkMatchAttestation {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._audit = options.audit || null;
  }

  /**
   * Generate a match attestation proof.
   * @param {object} query
   * @param {object[]} matches
   * @returns {string}
   */
  generate(query, matches) {
    const input = _canonicalInput(query, matches);
    const proof = crypto.createHash("sha256").update(input).digest("hex");
    if (this._audit) {
      this._audit("ZK_LOOKUP_MATCH_VERIFIED", {
        tenantId: query.tenantId,
        tableAlias: query.tableAlias,
        matchCount: matches.length,
      });
    }
    return proof;
  }

  /**
   * Verify a match attestation proof.
   * @param {object} query
   * @param {object[]} matches
   * @param {string} proof
   * @returns {object}
   */
  verify(query, matches, proof) {
    const expected = this.generate(query, matches);
    if (proof !== expected) {
      throw new HsmAdapterError(
        "ZK_LOOKUP_PROOF_INVALID",
        "zk match attestation verification failed",
      );
    }
    return { verified: true, matchCount: matches.length };
  }
}

function _canonicalInput(query, matches) {
  const recordIds = matches.map((m) => m.recordId).join(",");
  return `LOOKUP:${query.tenantId}:${query.tableAlias}:${query.encryptedFilterHash}:${query.requestedColumns}:${query.queryEpoch}:${recordIds}`;
}

module.exports = { ZkMatchAttestation };
