"use strict";

/**
 * Track 114: Zero-Knowledge Kinetic Claim Validator.
 *
 * Validates zero-knowledge swarm robotics kinetic assembly claims for
 * attestation pools. Enforces the strict 1-second
 * maxKineticValidationWindowSeconds boundary using high-resolution millisecond
 * offsets against the current system time, kinetic assembly chain depth,
 * robotic quorum, and PQC signature allow-lists.
 *
 * @module hsm-adapter/zk-kinetic-claim-validator
 */

const { HsmAdapterError } = require("./base-adapter.cjs");
const hsmMetrics = require("./hsm-metrics.cjs");

class ZkKineticClaimValidator {
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
  }

  /**
   * Validate a zero-knowledge kinetic assembly claim.
   * @param {object} claim
   * @param {string} claim.poolId
   * @param {string} claim.isogenyKeyExchangeDigest
   * @param {number} claim.timestampMs — high-resolution posture confirmation timestamp in milliseconds
   * @param {number} claim.kineticValidationWindowSeconds
   * @param {number} claim.kineticAssemblyChainDepth
   * @param {number} [claim.roboticQuorum]
   * @param {string} [claim.pqcSignatureScheme]
   * @param {string} [claim.attestationAuthority]
   * @param {boolean} [claim.proofValid]
   * @returns {object} validation result
   */
  validateClaim(claim) {
    _validateClaimShape(claim);

    const nowMs = Date.now();
    const maxWindowMs =
      (this.policy.maxKineticValidationWindowSeconds || 1) * 1000;
    const elapsedMs = nowMs - claim.timestampMs;

    if (elapsedMs > maxWindowMs) {
      this._issueChallenge(
        claim.poolId,
        "posture_validation_window_out_of_bounds",
      );
      throw new HsmAdapterError(
        "KINETICCLAIM_POSTURE_VALIDATION_WINDOW_EXCEEDED",
        `kinetic posture confirmation is ${elapsedMs}ms old; maximum window is ${maxWindowMs}ms`,
      );
    }

    if (
      typeof claim.kineticValidationWindowSeconds === "number" &&
      this.policy.maxKineticValidationWindowSeconds !== undefined &&
      claim.kineticValidationWindowSeconds >
        this.policy.maxKineticValidationWindowSeconds
    ) {
      this._issueChallenge(claim.poolId, "kinetic_validation_window_exceeded");
      throw new HsmAdapterError(
        "KINETICCLAIM_POSTURE_VALIDATION_WINDOW_EXCEEDED",
        `kinetic validation window seconds ${claim.kineticValidationWindowSeconds} exceeds maximum ${this.policy.maxKineticValidationWindowSeconds}`,
      );
    }

    if (
      typeof claim.kineticAssemblyChainDepth === "number" &&
      this.policy.maxKineticAssemblyChainDepth !== undefined &&
      claim.kineticAssemblyChainDepth > this.policy.maxKineticAssemblyChainDepth
    ) {
      this._issueChallenge(
        claim.poolId,
        "kinetic_assembly_chain_depth_exceeded",
      );
      throw new HsmAdapterError(
        "KINETICCLAIM_ASSEMBLY_CHAIN_DEPTH_EXCEEDED",
        `kinetic assembly chain depth ${claim.kineticAssemblyChainDepth} exceeds maximum ${this.policy.maxKineticAssemblyChainDepth}`,
      );
    }

    if (
      typeof claim.roboticQuorum === "number" &&
      this.policy.minRoboticQuorum !== undefined &&
      claim.roboticQuorum < this.policy.minRoboticQuorum
    ) {
      this._issueChallenge(claim.poolId, "robotic_quorum_insufficient");
      throw new HsmAdapterError(
        "KINETICCLAIM_QUORUM_INSUFFICIENT",
        `robotic quorum ${claim.roboticQuorum} below minimum ${this.policy.minRoboticQuorum}`,
      );
    }

    if (
      typeof claim.pqcSignatureScheme === "string" &&
      this.policy.allowedPqcSignatureSchemes &&
      !this.policy.allowedPqcSignatureSchemes.includes(claim.pqcSignatureScheme)
    ) {
      this._issueChallenge(claim.poolId, "pqc_signature_scheme_blocked");
      throw new HsmAdapterError(
        "KINETICCLAIM_PQC_SCHEME_BLOCKED",
        `PQC signature scheme ${claim.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(", ")}`,
      );
    }

    if (
      typeof claim.attestationAuthority === "string" &&
      this.policy.allowedAttestationAuthorities &&
      !this.policy.allowedAttestationAuthorities.includes(
        claim.attestationAuthority,
      )
    ) {
      this._issueChallenge(claim.poolId, "attestation_authority_blocked");
      throw new HsmAdapterError(
        "KINETICCLAIM_ATTESTATION_AUTHORITY_BLOCKED",
        `attestation authority ${claim.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(", ")}`,
      );
    }

    if (claim.proofValid === false) {
      this._issueChallenge(claim.poolId, "proof_invalid");
      throw new HsmAdapterError(
        "KINETICCLAIM_PROOF_INVALID",
        `kinetic posture proof for pool ${claim.poolId} is invalid`,
      );
    }

    hsmMetrics.incrementCounter("hsm_zk_kinetic_posture_verified_total", 1);
    return {
      poolId: claim.poolId,
      valid: true,
      verifiedAt: nowMs,
      elapsedMs,
    };
  }

  _issueChallenge(poolId, challengeType) {
    hsmMetrics.incrementCounter("hsm_kineticgate_challenge_issued_total", 1);
  }
}

function _validateClaimShape(claim) {
  if (!claim || typeof claim !== "object") {
    throw new HsmAdapterError(
      "KINETICCLAIM_CLAIM_SHAPE_INVALID",
      "claim must be an object",
    );
  }
  if (!claim.poolId) {
    throw new HsmAdapterError(
      "KINETICCLAIM_CLAIM_SHAPE_INVALID",
      "poolId is required",
    );
  }
  if (!claim.isogenyKeyExchangeDigest) {
    throw new HsmAdapterError(
      "KINETICCLAIM_CLAIM_SHAPE_INVALID",
      "isogenyKeyExchangeDigest is required",
    );
  }
  if (typeof claim.timestampMs !== "number") {
    throw new HsmAdapterError(
      "KINETICCLAIM_CLAIM_SHAPE_INVALID",
      "timestampMs must be a number",
    );
  }
}

module.exports = { ZkKineticClaimValidator };
