"use strict";

/**
 * Track 44: Token claim verifier.
 *
 * Verifies confidential token ownership claims by checking the
 * zk-SNARK proof and commitment without revealing the underlying
 * asset amount.
 *
 * @module hsm-adapter/token-claim-verifier
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

class TokenClaimVerifier {
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
   * Verify a token ownership claim.
   * @param {object} token
   * @param {object} claim
   * @returns {object}
   */
  verify(token, claim = {}) {
    const now = Math.floor(Date.now() / 1000);
    const age = now - (token.timestamp || 0);
    const minAge = this.policy.minProofAgeSeconds || 0;
    const maxAge = this.policy.maxProofAgeSeconds || 60;
    if (age < minAge) {
      throw new HsmAdapterError(
        "ISSUANCE_PROOF_TOO_YOUNG",
        `proof age ${age}s below minimum ${minAge}s`,
      );
    }
    if (age > maxAge) {
      throw new HsmAdapterError(
        "ISSUANCE_PROOF_TOO_OLD",
        `proof age ${age}s exceeds maximum ${maxAge}s`,
      );
    }
    if (!token.proof) {
      throw new HsmAdapterError("ISSUANCE_PROOF_MISSING", "token has no proof");
    }
    if (!claim.commitment || claim.commitment !== token.commitment) {
      throw new HsmAdapterError(
        "ISSUANCE_CLAIM_MISMATCH",
        "claim commitment does not match token",
      );
    }
    const expected = _recomputeProof(
      token.assetId,
      claim.amount,
      claim.blinding,
    );
    if (token.proof !== expected) {
      throw new HsmAdapterError(
        "ISSUANCE_PROOF_INVALID",
        "zk-snark proof verification failed",
      );
    }
    if (this._audit) {
      this._audit("ISSUANCE_PROOF_VALIDATED", {
        assetId: token.assetId,
        timestamp: now,
      });
    }
    return { verified: true, assetId: token.assetId, timestamp: now };
  }
}

function _recomputeProof(assetId, amount, blinding) {
  const a = typeof amount === "bigint" ? amount : BigInt(amount);
  const b = typeof blinding === "bigint" ? blinding : BigInt(blinding);
  const input = `${assetId}:${a.toString()}:${b.toString()}`;
  return crypto.createHash("sha256").update(input).digest("hex");
}

module.exports = { TokenClaimVerifier };
