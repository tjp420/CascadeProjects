"use strict";

/**
 * Track 113: Zero-Knowledge Drone Claim Validator.
 *
 * Validates zero-knowledge drone swarm mesh-routing claims for autonomous
 * drone swarm attestation pools. Enforces the strict 5-second
 * maxTrajectoryValidationWindowSeconds boundary using high-resolution
 * millisecond offsets against the current system time, swarm topological chain
 * depth, swarm quorum, and PQC signature allow-lists.
 *
 * @module hsm-adapter/zk-drone-claim-validator
 */

const { HsmAdapterError } = require("./base-adapter.cjs");
const hsmMetrics = require("./hsm-metrics.cjs");

class ZkDroneClaimValidator {
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
  }

  /**
   * Validate a zero-knowledge drone swarm mesh-routing claim.
   * @param {object} claim
   * @param {string} claim.poolId
   * @param {string} claim.multivariateQuadraticSignatureDigest
   * @param {number} claim.timestampMs — high-resolution packet trajectory confirmation timestamp in milliseconds
   * @param {number} claim.trajectoryValidationWindowSeconds
   * @param {number} claim.swarmTopologicalChainDepth
   * @param {number} [claim.swarmQuorum]
   * @param {string} [claim.pqcSignatureScheme]
   * @param {string} [claim.attestationAuthority]
   * @param {boolean} [claim.proofValid]
   * @returns {object} validation result
   */
  validateClaim(claim) {
    _validateClaimShape(claim);

    const nowMs = Date.now();
    const maxWindowMs =
      (this.policy.maxTrajectoryValidationWindowSeconds || 5) * 1000;
    const elapsedMs = nowMs - claim.timestampMs;

    if (elapsedMs > maxWindowMs) {
      this._issueChallenge(
        claim.poolId,
        "trajectory_validation_window_out_of_bounds",
      );
      throw new HsmAdapterError(
        "DRONECLAIM_TRAJECTORY_VALIDATION_WINDOW_EXCEEDED",
        `drone trajectory confirmation is ${elapsedMs}ms old; maximum window is ${maxWindowMs}ms`,
      );
    }

    if (
      typeof claim.trajectoryValidationWindowSeconds === "number" &&
      this.policy.maxTrajectoryValidationWindowSeconds !== undefined &&
      claim.trajectoryValidationWindowSeconds >
        this.policy.maxTrajectoryValidationWindowSeconds
    ) {
      this._issueChallenge(
        claim.poolId,
        "trajectory_validation_window_exceeded",
      );
      throw new HsmAdapterError(
        "DRONECLAIM_TRAJECTORY_VALIDATION_WINDOW_EXCEEDED",
        `trajectory validation window seconds ${claim.trajectoryValidationWindowSeconds} exceeds maximum ${this.policy.maxTrajectoryValidationWindowSeconds}`,
      );
    }

    if (
      typeof claim.swarmTopologicalChainDepth === "number" &&
      this.policy.maxSwarmTopologicalChainDepth !== undefined &&
      claim.swarmTopologicalChainDepth >
        this.policy.maxSwarmTopologicalChainDepth
    ) {
      this._issueChallenge(
        claim.poolId,
        "swarm_topological_chain_depth_exceeded",
      );
      throw new HsmAdapterError(
        "DRONECLAIM_TOPOLOGICAL_CHAIN_DEPTH_EXCEEDED",
        `swarm topological chain depth ${claim.swarmTopologicalChainDepth} exceeds maximum ${this.policy.maxSwarmTopologicalChainDepth}`,
      );
    }

    if (
      typeof claim.swarmQuorum === "number" &&
      this.policy.minSwarmQuorum !== undefined &&
      claim.swarmQuorum < this.policy.minSwarmQuorum
    ) {
      this._issueChallenge(claim.poolId, "swarm_quorum_insufficient");
      throw new HsmAdapterError(
        "DRONECLAIM_QUORUM_INSUFFICIENT",
        `swarm quorum ${claim.swarmQuorum} below minimum ${this.policy.minSwarmQuorum}`,
      );
    }

    if (
      typeof claim.pqcSignatureScheme === "string" &&
      this.policy.allowedPqcSignatureSchemes &&
      !this.policy.allowedPqcSignatureSchemes.includes(claim.pqcSignatureScheme)
    ) {
      this._issueChallenge(claim.poolId, "pqc_signature_scheme_blocked");
      throw new HsmAdapterError(
        "DRONECLAIM_PQC_SCHEME_BLOCKED",
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
        "DRONECLAIM_ATTESTATION_AUTHORITY_BLOCKED",
        `attestation authority ${claim.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(", ")}`,
      );
    }

    if (claim.proofValid === false) {
      this._issueChallenge(claim.poolId, "proof_invalid");
      throw new HsmAdapterError(
        "DRONECLAIM_PROOF_INVALID",
        `drone swarm routing proof for pool ${claim.poolId} is invalid`,
      );
    }

    hsmMetrics.incrementCounter("hsm_zk_swarm_routing_verified_total", 1);
    return {
      poolId: claim.poolId,
      valid: true,
      verifiedAt: nowMs,
      elapsedMs,
    };
  }

  _issueChallenge(poolId, challengeType) {
    hsmMetrics.incrementCounter("hsm_dronegate_challenge_issued_total", 1);
  }
}

function _validateClaimShape(claim) {
  if (!claim || typeof claim !== "object") {
    throw new HsmAdapterError(
      "DRONECLAIM_CLAIM_SHAPE_INVALID",
      "claim must be an object",
    );
  }
  if (!claim.poolId) {
    throw new HsmAdapterError(
      "DRONECLAIM_CLAIM_SHAPE_INVALID",
      "poolId is required",
    );
  }
  if (!claim.multivariateQuadraticSignatureDigest) {
    throw new HsmAdapterError(
      "DRONECLAIM_CLAIM_SHAPE_INVALID",
      "multivariateQuadraticSignatureDigest is required",
    );
  }
  if (typeof claim.timestampMs !== "number") {
    throw new HsmAdapterError(
      "DRONECLAIM_CLAIM_SHAPE_INVALID",
      "timestampMs must be a number",
    );
  }
}

module.exports = { ZkDroneClaimValidator };
