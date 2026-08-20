"use strict";

/**
 * Track 115: Zero-Knowledge Mesh Claim Validator.
 *
 * Validates zero-knowledge multi-enclave confidential mesh state-reconciliation
 * claims. Enforces the strict 10-second maxEpochFinalityWindowSeconds boundary
 * using high-resolution millisecond offsets against the current system time,
 * mesh reconciliation chain depth, mesh quorum, and PQC signature allow-lists.
 *
 * @module hsm-adapter/zk-mesh-claim-validator
 */

const { HsmAdapterError } = require("./base-adapter.cjs");
const hsmMetrics = require("./hsm-metrics.cjs");

class ZkMeshClaimValidator {
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._bannedPeers = new Set();
    this._verifiedClaims = new Set();
  }

  /**
   * Validate a zero-knowledge mesh state-reconciliation claim.
   * @param {object} claim
   * @returns {object} validation result
   */
  validateClaim(claim) {
    _validateClaimShape(claim);

    const nowMs = Date.now();
    const maxWindowMs =
      (this.policy.maxEpochFinalityWindowSeconds || 10) * 1000;
    const elapsedMs = nowMs - claim.timestampMs;

    if (elapsedMs > maxWindowMs) {
      this._issueChallenge(claim.poolId, "epoch_finality_window_out_of_bounds");
      throw new HsmAdapterError(
        "MESHCLAIM_EPOCH_FINALITY_WINDOW_EXCEEDED",
        `mesh state-reconciliation claim is ${elapsedMs}ms old; maximum window is ${maxWindowMs}ms`,
      );
    }

    if (
      typeof claim.epochFinalityWindowSeconds === "number" &&
      this.policy.maxEpochFinalityWindowSeconds !== undefined &&
      claim.epochFinalityWindowSeconds >
        this.policy.maxEpochFinalityWindowSeconds
    ) {
      this._issueChallenge(claim.poolId, "epoch_finality_window_exceeded");
      throw new HsmAdapterError(
        "MESHCLAIM_EPOCH_FINALITY_WINDOW_EXCEEDED",
        `epoch finality window seconds ${claim.epochFinalityWindowSeconds} exceeds maximum ${this.policy.maxEpochFinalityWindowSeconds}`,
      );
    }

    if (
      typeof claim.reconciliationChainDepth === "number" &&
      this.policy.maxReconciliationChainDepth !== undefined &&
      claim.reconciliationChainDepth > this.policy.maxReconciliationChainDepth
    ) {
      this._issueChallenge(claim.poolId, "reconciliation_chain_depth_exceeded");
      throw new HsmAdapterError(
        "MESHCLAIM_RECONCILIATION_CHAIN_DEPTH_EXCEEDED",
        `reconciliation chain depth ${claim.reconciliationChainDepth} exceeds maximum ${this.policy.maxReconciliationChainDepth}`,
      );
    }

    if (
      typeof claim.meshQuorum === "number" &&
      this.policy.minMeshQuorum !== undefined &&
      claim.meshQuorum < this.policy.minMeshQuorum
    ) {
      this._issueChallenge(claim.poolId, "mesh_quorum_insufficient");
      throw new HsmAdapterError(
        "MESHCLAIM_QUORUM_INSUFFICIENT",
        `mesh quorum ${claim.meshQuorum} below minimum ${this.policy.minMeshQuorum}`,
      );
    }

    if (
      typeof claim.pqcSignatureScheme === "string" &&
      this.policy.allowedPqcSignatureSchemes &&
      !this.policy.allowedPqcSignatureSchemes.includes(claim.pqcSignatureScheme)
    ) {
      this._issueChallenge(claim.poolId, "pqc_signature_scheme_blocked");
      throw new HsmAdapterError(
        "MESHCLAIM_PQC_SCHEME_BLOCKED",
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
        "MESHCLAIM_ATTESTATION_AUTHORITY_BLOCKED",
        `attestation authority ${claim.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(", ")}`,
      );
    }

    if (claim.proofValid === false) {
      this._issueChallenge(claim.poolId, "proof_invalid");
      throw new HsmAdapterError(
        "MESHCLAIM_PROOF_INVALID",
        `mesh state-reconciliation proof for pool ${claim.poolId} is invalid`,
      );
    }

    if (this.policy.banMalformedOrOutOfOrderMeshStateReconciliationClaims) {
      const claimHash = `${claim.poolId}:${claim.confidentialStateReconciliationDigest}:${claim.timestampMs}`;
      if (this._verifiedClaims.has(claimHash)) {
        if (claim.peerId) this._bannedPeers.add(claim.peerId);
        throw new HsmAdapterError(
          "MESHCLAIM_DUPLICATE",
          `duplicate mesh reconciliation claim for pool ${claim.poolId}`,
        );
      }
      this._verifiedClaims.add(claimHash);
    }

    hsmMetrics.incrementCounter("hsm_zk_mesh_state_reconciled_total", 1);
    return {
      poolId: claim.poolId,
      valid: true,
      verifiedAt: nowMs,
      elapsedMs,
    };
  }

  _issueChallenge(poolId, challengeType) {
    hsmMetrics.incrementCounter("hsm_meshgate_challenge_issued_total", 1);
  }
}

function _validateClaimShape(claim) {
  if (!claim || typeof claim !== "object") {
    throw new HsmAdapterError(
      "MESHCLAIM_CLAIM_SHAPE_INVALID",
      "claim must be an object",
    );
  }
  if (!claim.poolId) {
    throw new HsmAdapterError(
      "MESHCLAIM_CLAIM_SHAPE_INVALID",
      "poolId is required",
    );
  }
  if (!claim.confidentialStateReconciliationDigest) {
    throw new HsmAdapterError(
      "MESHCLAIM_CLAIM_SHAPE_INVALID",
      "confidentialStateReconciliationDigest is required",
    );
  }
  if (typeof claim.timestampMs !== "number") {
    throw new HsmAdapterError(
      "MESHCLAIM_CLAIM_SHAPE_INVALID",
      "timestampMs must be a number",
    );
  }
}

module.exports = { ZkMeshClaimValidator };
