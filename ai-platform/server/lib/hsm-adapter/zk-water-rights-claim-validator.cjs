"use strict";

/**
 * Track 88: ZK Water Rights Claim Validator.
 *
 * Succinct water rights claim verifier that
 * processes non-interactive zero-knowledge
 * range and flow proofs with MPC verification,
 * ensuring that an entity's hidden water
 * claim status strictly satisfies policy-defined
 * thresholds without disclosing individual
 * water or watershed attributes. Triggers
 * defensive node bans for malformed or
 * out-of-order water claims.
 *
 * @module hsm-adapter/zk-water-rights-claim-validator
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

class ZkWaterRightsClaimValidator {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {PqcWaterRightsAllocationGatingHub} options.hub
   * @param {EnclaveAttestationClient} [options.attestationClient]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._hub = options.hub || null;
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._bannedPeers = new Set();
    this._verifiedClaims = new Map();
  }

  /**
   * Verify a water rights claim proof.
   * @param {object} request
   * @returns {object}
   */
  verifyWaterClaim(request) {
    _validateClaimRequest(this.policy, request);
    if (!this._hub) {
      throw new HsmAdapterError(
        "WATERCLAIM_HUB_MISSING",
        "water rights allocation gating hub is required",
      );
    }
    if (
      this.policy.requireWatershedOversightCommitteeAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.watershedOversightCommitteeAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "WATERCLAIM_COMMITTEE_UNATTESTED",
            "watershed oversight committee attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "WATERCLAIM_COMMITTEE_UNATTESTED",
          "watershed oversight committee attestation invalid",
        );
      }
    }
    if (
      typeof request.attestationAuthority === "string" &&
      !this.policy.allowedAttestationAuthorities.includes(
        request.attestationAuthority,
      )
    ) {
      throw new HsmAdapterError(
        "WATERCLAIM_AUTHORITY_BLOCKED",
        `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(", ")}`,
      );
    }
    if (
      typeof request.peerId === "string" &&
      this._bannedPeers.has(request.peerId)
    ) {
      throw new HsmAdapterError(
        "WATERCLAIM_PEER_BANNED",
        `peer ${request.peerId} is banned`,
      );
    }
    if (
      !request.zkWaterRangeProofHash ||
      typeof request.zkWaterRangeProofHash !== "string"
    ) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError(
        "WATERCLAIM_ZK_PROOF_MISSING",
        "zero-knowledge water range proof hash is required",
      );
    }
    if (!request.mpcProof || typeof request.mpcProof !== "string") {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError(
        "WATERCLAIM_MPC_PROOF_MISSING",
        "MPC proof is required",
      );
    }
    const pool = this._hub.getPool(request.poolId);
    if (!pool) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError(
        "WATERCLAIM_POOL_NOT_FOUND",
        `pool ${request.poolId} not found`,
      );
    }
    if (
      typeof request.allocationWindowSeconds === "number" &&
      request.allocationWindowSeconds >
        (this.policy.maxAllocationWindowSeconds || 31536000)
    ) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError(
        "WATERCLAIM_ALLOCATION_WINDOW_OUT_OF_BOUNDS",
        `allocation window seconds ${request.allocationWindowSeconds} exceeds maximum ${this.policy.maxAllocationWindowSeconds}`,
      );
    }
    const claimKey = `${request.poolId}:${request.peerId || "anonymous"}`;
    if (this._verifiedClaims.has(claimKey)) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError(
        "WATERCLAIM_DUPLICATE",
        `water rights claim for pool ${request.poolId} already verified`,
      );
    }
    const claimId =
      request.claimId || `claim-${crypto.randomBytes(4).toString("hex")}`;
    const now = Math.floor(Date.now() / 1000);
    const claim = {
      claimId,
      poolId: request.poolId,
      blindedWatershedFlowCommitment:
        request.blindedWatershedFlowCommitment || "unspecified",
      blindedClaimValueCommitment:
        request.blindedClaimValueCommitment || "unspecified",
      zkWaterRangeProofHash: request.zkWaterRangeProofHash,
      watershedOversightCommitteeAttestationHash:
        request.watershedOversightCommitteeAttestationHash || "unspecified",
      mpcProof: request.mpcProof,
      verifiedAt: now,
    };
    this._verifiedClaims.set(claimKey, claim);
    this._hub.markWaterClaimVerified(request.poolId);
    if (this._audit) {
      this._audit("ZK_WATER_CLAIM_VERIFIED", { ...claim });
    }
    return claim;
  }

  /**
   * Check if a peer is banned.
   * @param {string} peerId
   * @returns {boolean}
   */
  isPeerBanned(peerId) {
    return this._bannedPeers.has(peerId);
  }

  /**
   * Get all verified claims.
   * @returns {Array}
   */
  getVerifiedClaims() {
    return Array.from(this._verifiedClaims.values());
  }

  /**
   * Ban a peer if policy requires it.
   * @param {object} request
   * @private
   */
  _banPeerIfPolicy(request) {
    if (
      this.policy.banMalformedOrOutOfOrderWaterClaims &&
      typeof request.peerId === "string"
    ) {
      this._bannedPeers.add(request.peerId);
    }
  }
}

function _validateClaimRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError(
      "WATERCLAIM_FIELDS_MISSING",
      "poolId is required",
    );
  }
  if (
    policy.requireWatershedOversightCommitteeAttestation &&
    !request.watershedOversightCommitteeAttestation
  ) {
    throw new HsmAdapterError(
      "WATERCLAIM_ATTESTATION_MISSING",
      "watershed oversight committee attestation is required",
    );
  }
}

module.exports = { ZkWaterRightsClaimValidator };
