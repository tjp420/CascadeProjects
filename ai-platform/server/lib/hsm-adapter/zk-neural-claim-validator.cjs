"use strict";

/**
 * Track 101: Zero-Knowledge Neural Claim Validator.
 *
 * Validates zero-knowledge neural inference claims for neural network
 * inference integrity gating pools. Enforces attestation verification,
 * PQC signature allow-lists, peer banning for malformed/duplicate claims,
 * and marks pools as claim-verified for downstream accreditation.
 *
 * Also supports the legacy validateClaim() API for neural telemetry
 * window enforcement (Track 112).
 *
 * @module hsm-adapter/zk-neural-claim-validator
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");
const hsmMetrics = require("./hsm-metrics.cjs");

class ZkNeuralClaimValidator {
  constructor(options = {}) {
    this.policy = options.policy || {};
    this.hub = options.hub || null;
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._verifiedClaims = new Set();
    this._bannedPeers = new Set();
  }

  /**
   * Verify a zero-knowledge neural inference claim for a gating pool.
   * @param {object} request
   * @param {string} request.poolId
   * @param {string} request.blindedNeuralMeasurementCommitment
   * @param {string} request.blindedInferenceProbabilityCommitment
   * @param {string} request.blindedNeuralNetworkAuthorityIdentityCommitment
   * @param {string} request.zkNeuralRangeProofHash
   * @param {string} request.merkleMountainRangeDigest
   * @param {object} [request.neuralEthicsOversightCommitteeAttestation]
   * @param {string} [request.attestationAuthority]
   * @param {string} [request.peerId]
   * @param {string} [request.claimId]
   * @returns {object} verified claim
   */
  verifyNeuralClaim(request) {
    _validateNeuralClaimRequest(this.policy, request, this._bannedPeers);
    const pool = this.hub ? this.hub.getPool(request.poolId) : null;
    if (!pool) {
      throw new HsmAdapterError(
        "NEURGATECLAIM_POOL_NOT_FOUND",
        `pool ${request.poolId} not found`,
      );
    }
    if (pool.status !== "open") {
      throw new HsmAdapterError(
        "NEURGATECLAIM_POOL_NOT_OPEN",
        `pool ${request.poolId} is not open`,
      );
    }
    if (
      this.policy.requireNeuralEthicsOversightCommitteeAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.neuralEthicsOversightCommitteeAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "NEURGATECLAIM_OVERSIGHT_COMMITTEE_UNATTESTED",
            "neural ethics oversight committee attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "NEURGATECLAIM_OVERSIGHT_COMMITTEE_UNATTESTED",
          "neural ethics oversight committee attestation invalid",
        );
      }
    }
    if (
      typeof request.attestationAuthority === "string" &&
      this.policy.allowedAttestationAuthorities &&
      !this.policy.allowedAttestationAuthorities.includes(
        request.attestationAuthority,
      )
    ) {
      throw new HsmAdapterError(
        "NEURGATECLAIM_ATTESTATION_AUTHORITY_BLOCKED",
        `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(", ")}`,
      );
    }
    if (
      this.policy.banMalformedOrOutOfOrderNeuralClaims &&
      request.peerId &&
      this._bannedPeers.has(request.peerId)
    ) {
      throw new HsmAdapterError(
        "NEURGATECLAIM_PEER_BANNED",
        `peer ${request.peerId} is banned`,
      );
    }
    const claimHash = crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          poolId: request.poolId,
          blindedNeuralMeasurementCommitment:
            request.blindedNeuralMeasurementCommitment,
          blindedInferenceProbabilityCommitment:
            request.blindedInferenceProbabilityCommitment,
          blindedNeuralNetworkAuthorityIdentityCommitment:
            request.blindedNeuralNetworkAuthorityIdentityCommitment,
          zkNeuralRangeProofHash: request.zkNeuralRangeProofHash,
          merkleMountainRangeDigest: request.merkleMountainRangeDigest,
        }),
      )
      .digest("hex");
    if (
      this.policy.banMalformedOrOutOfOrderNeuralClaims &&
      this._verifiedClaims.has(claimHash)
    ) {
      if (request.peerId) this._bannedPeers.add(request.peerId);
      throw new HsmAdapterError(
        "NEURGATECLAIM_DUPLICATE",
        `duplicate neural claim for pool ${request.poolId}`,
      );
    }
    this._verifiedClaims.add(claimHash);
    if (this.hub && typeof this.hub.markNeuralClaimVerified === "function") {
      this.hub.markNeuralClaimVerified(request.poolId);
    }
    const claimId =
      request.claimId || `claim-${crypto.randomBytes(4).toString("hex")}`;
    const claim = {
      claimId,
      poolId: request.poolId,
      merkleMountainRangeDigest: request.merkleMountainRangeDigest,
      zkNeuralRangeProofHash: request.zkNeuralRangeProofHash,
      verifiedAt: Math.floor(Date.now() / 1000),
    };
    hsmMetrics.incrementCounter("hsm_zk_neural_claim_verified_total", 1);
    if (this._audit) {
      this._audit("ZK_NEURAL_CLAIM_VERIFIED", { ...claim });
    }
    return claim;
  }

  isPeerBanned(peerId) {
    return this._bannedPeers.has(peerId);
  }

  getVerifiedClaimCount() {
    return this._verifiedClaims.size;
  }

  /**
   * Validate a zero-knowledge neural telemetry claim (legacy Track 112 API).
   * @param {object} claim
   * @param {string} claim.poolId
   * @param {string} claim.neuralSynapseStateDigest
   * @param {number} claim.timestampMs — high-resolution claim timestamp in milliseconds
   * @param {number} claim.neuralTelemetryWindowSeconds
   * @param {number} claim.synapseChainDepth
   * @param {number} [claim.neuralQuorum]
   * @param {string} [claim.pqcSignatureScheme]
   * @param {string} [claim.attestationAuthority]
   * @param {boolean} [claim.proofValid]
   * @returns {object} validation result
   */
  validateClaim(claim) {
    _validateClaimShape(claim);

    const nowMs = Date.now();
    const maxWindowMs =
      (this.policy.maxNeuralTelemetryWindowSeconds || 2) * 1000;
    const elapsedMs = nowMs - claim.timestampMs;

    if (elapsedMs > maxWindowMs) {
      this._issueChallenge(claim.poolId, "inference_window_out_of_bounds");
      throw new HsmAdapterError(
        "NEUROCLAIM_INFERENCE_WINDOW_OUT_OF_BOUNDS",
        `neural telemetry timestamp is ${elapsedMs}ms old; maximum window is ${maxWindowMs}ms`,
      );
    }

    if (
      typeof claim.neuralTelemetryWindowSeconds === "number" &&
      this.policy.maxNeuralTelemetryWindowSeconds !== undefined &&
      claim.neuralTelemetryWindowSeconds >
        this.policy.maxNeuralTelemetryWindowSeconds
    ) {
      this._issueChallenge(claim.poolId, "neural_telemetry_window_exceeded");
      throw new HsmAdapterError(
        "NEUROCLAIM_INFERENCE_WINDOW_OUT_OF_BOUNDS",
        `neural telemetry window seconds ${claim.neuralTelemetryWindowSeconds} exceeds maximum ${this.policy.maxNeuralTelemetryWindowSeconds}`,
      );
    }

    if (
      typeof claim.synapseChainDepth === "number" &&
      this.policy.maxSynapseChainDepth !== undefined &&
      claim.synapseChainDepth > this.policy.maxSynapseChainDepth
    ) {
      this._issueChallenge(claim.poolId, "synapse_chain_depth_exceeded");
      throw new HsmAdapterError(
        "NEUROCLAIM_SYNAPSE_CHAIN_DEPTH_EXCEEDED",
        `synapse chain depth ${claim.synapseChainDepth} exceeds maximum ${this.policy.maxSynapseChainDepth}`,
      );
    }

    if (
      typeof claim.neuralQuorum === "number" &&
      this.policy.minNeuralQuorum !== undefined &&
      claim.neuralQuorum < this.policy.minNeuralQuorum
    ) {
      this._issueChallenge(claim.poolId, "neural_quorum_insufficient");
      throw new HsmAdapterError(
        "NEUROCLAIM_QUORUM_INSUFFICIENT",
        `neural quorum ${claim.neuralQuorum} below minimum ${this.policy.minNeuralQuorum}`,
      );
    }

    if (
      typeof claim.pqcSignatureScheme === "string" &&
      this.policy.allowedPqcSignatureSchemes &&
      !this.policy.allowedPqcSignatureSchemes.includes(claim.pqcSignatureScheme)
    ) {
      this._issueChallenge(claim.poolId, "pqc_signature_scheme_blocked");
      throw new HsmAdapterError(
        "NEUROCLAIM_PQC_SCHEME_BLOCKED",
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
        "NEUROCLAIM_ATTESTATION_AUTHORITY_BLOCKED",
        `attestation authority ${claim.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(", ")}`,
      );
    }

    if (claim.proofValid === false) {
      this._issueChallenge(claim.poolId, "proof_invalid");
      throw new HsmAdapterError(
        "NEUROCLAIM_PROOF_INVALID",
        `neural telemetry proof for pool ${claim.poolId} is invalid`,
      );
    }

    hsmMetrics.incrementCounter("hsm_zk_neural_telemetry_verified_total", 1);
    return {
      poolId: claim.poolId,
      valid: true,
      verifiedAt: nowMs,
      elapsedMs,
    };
  }

  _issueChallenge(poolId, challengeType) {
    hsmMetrics.incrementCounter("hsm_neurogate_challenge_issued_total", 1);
  }
}

function _validateNeuralClaimRequest(policy, request, bannedPeers) {
  if (!request || typeof request !== "object") {
    throw new HsmAdapterError(
      "NEURGATECLAIM_FIELDS_MISSING",
      "request must be an object",
    );
  }
  if (!request.poolId) {
    throw new HsmAdapterError(
      "NEURGATECLAIM_FIELDS_MISSING",
      "poolId is required",
    );
  }
  if (
    !request.blindedNeuralMeasurementCommitment ||
    !request.blindedInferenceProbabilityCommitment ||
    !request.blindedNeuralNetworkAuthorityIdentityCommitment
  ) {
    throw new HsmAdapterError(
      "NEURGATECLAIM_FIELDS_MISSING",
      "blindedNeuralMeasurementCommitment, blindedInferenceProbabilityCommitment, and blindedNeuralNetworkAuthorityIdentityCommitment are required",
    );
  }
  if (!request.zkNeuralRangeProofHash) {
    if (policy.banMalformedOrOutOfOrderNeuralClaims && request.peerId)
      bannedPeers.add(request.peerId);
    throw new HsmAdapterError(
      "NEURGATECLAIM_ZK_PROOF_MISSING",
      "zkNeuralRangeProofHash is required",
    );
  }
  if (!request.merkleMountainRangeDigest) {
    if (policy.banMalformedOrOutOfOrderNeuralClaims && request.peerId)
      bannedPeers.add(request.peerId);
    throw new HsmAdapterError(
      "NEURGATECLAIM_MMR_DIGEST_MISSING",
      "merkleMountainRangeDigest is required",
    );
  }
  if (
    policy.requireNeuralEthicsOversightCommitteeAttestation &&
    !request.neuralEthicsOversightCommitteeAttestation
  ) {
    throw new HsmAdapterError(
      "NEURGATECLAIM_OVERSIGHT_ATTESTATION_MISSING",
      "neuralEthicsOversightCommitteeAttestation is required",
    );
  }
}

function _validateClaimShape(claim) {
  if (!claim || typeof claim !== "object") {
    throw new HsmAdapterError(
      "NEUROCLAIM_CLAIM_SHAPE_INVALID",
      "claim must be an object",
    );
  }
  if (!claim.poolId) {
    throw new HsmAdapterError(
      "NEUROCLAIM_CLAIM_SHAPE_INVALID",
      "poolId is required",
    );
  }
  if (!claim.neuralSynapseStateDigest) {
    throw new HsmAdapterError(
      "NEUROCLAIM_CLAIM_SHAPE_INVALID",
      "neuralSynapseStateDigest is required",
    );
  }
  if (typeof claim.timestampMs !== "number") {
    throw new HsmAdapterError(
      "NEUROCLAIM_CLAIM_SHAPE_INVALID",
      "timestampMs must be a number",
    );
  }
}

module.exports = { ZkNeuralClaimValidator };
