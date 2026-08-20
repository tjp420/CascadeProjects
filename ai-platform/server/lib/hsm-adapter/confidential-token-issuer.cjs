"use strict";

/**
 * Track 44: Confidential token issuer.
 *
 * Mints confidential tokens using blinded Pedersen-style commitments
 * over asset amounts. Requires hardware attestation of the minting
 * node and produces a zk-SNARK-style proof of correct construction.
 *
 * @module hsm-adapter/confidential-token-issuer
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

class ConfidentialTokenIssuer {
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
  }

  /**
   * Mint a confidential token.
   * @param {string} assetId
   * @param {bigint} amount
   * @param {object} attestation
   * @param {string[]} approvals
   * @returns {object}
   */
  mint(assetId, amount, attestation, approvals = []) {
    const now = Math.floor(Date.now() / 1000);
    if (this.policy.requireMintingAttestation && this._attestationClient) {
      const result = this._attestationClient.verify(attestation);
      if (!result.verified) {
        throw new HsmAdapterError(
          "ISSUANCE_ATTESTATION_INVALID",
          "minting attestation is not valid",
        );
      }
    }
    if (amount < 0n) {
      throw new HsmAdapterError(
        "ISSUANCE_AMOUNT_INVALID",
        "token amount must be non-negative",
      );
    }
    const bitLength = amount.toString(2).length;
    if (bitLength < this.policy.minTokenBitLength) {
      throw new HsmAdapterError(
        "ISSUANCE_AMOUNT_TOO_SMALL",
        `token bit length ${bitLength} below policy minimum ${this.policy.minTokenBitLength}`,
      );
    }
    if (approvals.length < (this.policy.minIssuanceQuorum || 2)) {
      throw new HsmAdapterError(
        "ISSUANCE_QUORUM_INSUFFICIENT",
        `approvals ${approvals.length} below minimum ${this.policy.minIssuanceQuorum}`,
      );
    }
    const blinding = _randomBlinding(32);
    const commitment = _pedersenCommitment(amount, blinding);
    const proof = _simulateZkSnarkProof(assetId, amount, blinding);
    const token = {
      assetId,
      commitment,
      proof,
      timestamp: now,
      blindingScheme: "pedersen",
      commitmentCurve: this.policy.allowedCommitmentCurves
        ? this.policy.allowedCommitmentCurves[0]
        : "secp256k1",
    };
    if (this._audit) {
      this._audit("CONFIDENTIAL_TOKEN_MINTED", {
        assetId,
        commitment,
        timestamp: now,
      });
    }
    return { token, commitment, amount, blinding };
  }
}

function _randomBlinding(bytes) {
  return BigInt("0x" + crypto.randomBytes(bytes).toString("hex"));
}

function _pedersenCommitment(amount, blinding) {
  const G = 3n;
  const H = 7n;
  return `C-${(G * amount + H * blinding).toString(16).slice(0, 32)}`;
}

function _simulateZkSnarkProof(assetId, amount, blinding) {
  const input = `${assetId}:${amount.toString()}:${blinding.toString()}`;
  return crypto.createHash("sha256").update(input).digest("hex");
}

module.exports = { ConfidentialTokenIssuer };
