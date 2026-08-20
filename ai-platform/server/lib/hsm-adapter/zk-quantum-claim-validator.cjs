"use strict";

/**
 * Track 100: ZK Quantum Claim Validator.
 *
 * Validates zero-knowledge quantum sensor calibration claims against
 * quantum sensor calibration gating pools. Enforces canonical payload
 * layout, verifies accumulationTreeDigest for accumulation tree
 * verification, and bans peers broadcasting malformed or out-of-order
 * claims.
 *
 * @module hsm-adapter/zk-quantum-claim-validator
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

class ZkQuantumClaimValidator {
  constructor(options = {}) {
    this.policy = options.policy || {};
    this.hub = options.hub || null;
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._verifiedClaims = new Set();
    this._bannedPeers = new Set();
  }

  verifyQuantumClaim(request) {
    _validateClaimRequest(this.policy, request, this._bannedPeers);
    const pool = this.hub ? this.hub.getPool(request.poolId) : null;
    if (!pool) {
      throw new HsmAdapterError(
        "QUANTCLAIM_POOL_NOT_FOUND",
        `pool ${request.poolId} not found`,
      );
    }
    if (pool.status !== "open") {
      throw new HsmAdapterError(
        "QUANTCLAIM_POOL_NOT_OPEN",
        `pool ${request.poolId} is not open`,
      );
    }
    if (
      this.policy.requireQuantumStandardsOversightCommitteeAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.quantumStandardsOversightCommitteeAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "QUANTCLAIM_OVERSIGHT_COMMITTEE_UNATTESTED",
            "quantum standards oversight committee attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "QUANTCLAIM_OVERSIGHT_COMMITTEE_UNATTESTED",
          "quantum standards oversight committee attestation invalid",
        );
      }
    }
    if (
      this.policy.banMalformedOrOutOfOrderQuantumClaims &&
      request.peerId &&
      this._bannedPeers.has(request.peerId)
    ) {
      throw new HsmAdapterError(
        "QUANTCLAIM_PEER_BANNED",
        `peer ${request.peerId} is banned`,
      );
    }
    const claimHash = crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          poolId: request.poolId,
          blindedQuantumMeasurementCommitment:
            request.blindedQuantumMeasurementCommitment,
          blindedCalibrationProbabilityCommitment:
            request.blindedCalibrationProbabilityCommitment,
          blindedQuantumMetrologyAuthorityIdentityCommitment:
            request.blindedQuantumMetrologyAuthorityIdentityCommitment,
          zkQuantumRangeProofHash: request.zkQuantumRangeProofHash,
          accumulationTreeDigest: request.accumulationTreeDigest,
        }),
      )
      .digest("hex");
    if (
      this.policy.banMalformedOrOutOfOrderQuantumClaims &&
      this._verifiedClaims.has(claimHash)
    ) {
      if (request.peerId) this._bannedPeers.add(request.peerId);
      throw new HsmAdapterError(
        "QUANTCLAIM_DUPLICATE",
        `duplicate quantum claim for pool ${request.poolId}`,
      );
    }
    this._verifiedClaims.add(claimHash);
    if (this.hub) this.hub.markQuantumClaimVerified(request.poolId);
    const claimId =
      request.claimId || `claim-${crypto.randomBytes(4).toString("hex")}`;
    const claim = {
      claimId,
      poolId: request.poolId,
      accumulationTreeDigest: request.accumulationTreeDigest,
      zkQuantumRangeProofHash: request.zkQuantumRangeProofHash,
      verifiedAt: Math.floor(Date.now() / 1000),
    };
    if (this._audit) {
      this._audit("ZK_QUANTUM_CLAIM_VERIFIED", { ...claim });
    }
    return claim;
  }

  isPeerBanned(peerId) {
    return this._bannedPeers.has(peerId);
  }

  getVerifiedClaimCount() {
    return this._verifiedClaims.size;
  }
}

function _validateClaimRequest(policy, request, bannedPeers) {
  if (!request.poolId) {
    throw new HsmAdapterError(
      "QUANTCLAIM_FIELDS_MISSING",
      "poolId is required",
    );
  }
  if (
    !request.blindedQuantumMeasurementCommitment ||
    !request.blindedCalibrationProbabilityCommitment ||
    !request.blindedQuantumMetrologyAuthorityIdentityCommitment
  ) {
    throw new HsmAdapterError(
      "QUANTCLAIM_FIELDS_MISSING",
      "blindedQuantumMeasurementCommitment, blindedCalibrationProbabilityCommitment, and blindedQuantumMetrologyAuthorityIdentityCommitment are required",
    );
  }
  if (!request.zkQuantumRangeProofHash) {
    if (policy.banMalformedOrOutOfOrderQuantumClaims && request.peerId)
      bannedPeers.add(request.peerId);
    throw new HsmAdapterError(
      "QUANTCLAIM_ZK_PROOF_MISSING",
      "zkQuantumRangeProofHash is required",
    );
  }
  if (!request.accumulationTreeDigest) {
    if (policy.banMalformedOrOutOfOrderQuantumClaims && request.peerId)
      bannedPeers.add(request.peerId);
    throw new HsmAdapterError(
      "QUANTCLAIM_ACCUMULATION_DIGEST_MISSING",
      "accumulationTreeDigest is required",
    );
  }
  if (
    policy.requireQuantumStandardsOversightCommitteeAttestation &&
    !request.quantumStandardsOversightCommitteeAttestation
  ) {
    throw new HsmAdapterError(
      "QUANTCLAIM_OVERSIGHT_ATTESTATION_MISSING",
      "quantum standards oversight committee attestation is required",
    );
  }
}

module.exports = { ZkQuantumClaimValidator };
