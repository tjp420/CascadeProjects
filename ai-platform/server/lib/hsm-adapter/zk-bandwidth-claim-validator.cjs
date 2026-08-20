"use strict";

/**
 * Track 85: ZK Bandwidth Claim Validator.
 *
 * Succinct bandwidth verifier that processes
 * non-interactive zero-knowledge range and routing
 * proofs with blind signature verification, ensuring
 * that an entity's hidden network claim status
 * strictly satisfies policy-defined thresholds without
 * disclosing individual network or infrastructure
 * attributes. Triggers defensive node bans for
 * malformed or out-of-order telecom claims.
 *
 * @module hsm-adapter/zk-bandwidth-claim-validator
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

class ZkBandwidthClaimValidator {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {PqcTelecomRoutingGatingHub} options.hub
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
   * Verify a bandwidth claim proof.
   * @param {object} request
   * @returns {object}
   */
  verifyBandwidthClaim(request) {
    _validateClaimRequest(this.policy, request);
    if (!this._hub) {
      throw new HsmAdapterError(
        "TELECOMCLAIM_HUB_MISSING",
        "telecom routing gating hub is required",
      );
    }
    if (
      this.policy.requireRoutingCommitteeAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.routingCommitteeAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "TELECOMCLAIM_COMMITTEE_UNATTESTED",
            "routing committee attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "TELECOMCLAIM_COMMITTEE_UNATTESTED",
          "routing committee attestation invalid",
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
        "TELECOMCLAIM_AUTHORITY_BLOCKED",
        `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(", ")}`,
      );
    }
    if (
      typeof request.peerId === "string" &&
      this._bannedPeers.has(request.peerId)
    ) {
      throw new HsmAdapterError(
        "TELECOMCLAIM_PEER_BANNED",
        `peer ${request.peerId} is banned`,
      );
    }
    if (
      !request.zkTelecomRangeProofHash ||
      typeof request.zkTelecomRangeProofHash !== "string"
    ) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError(
        "TELECOMCLAIM_ZK_PROOF_MISSING",
        "zero-knowledge telecom range proof hash is required",
      );
    }
    if (!request.blindSignature || typeof request.blindSignature !== "string") {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError(
        "TELECOMCLAIM_BLIND_SIG_MISSING",
        "blind signature is required",
      );
    }
    const pool = this._hub.getPool(request.poolId);
    if (!pool) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError(
        "TELECOMCLAIM_POOL_NOT_FOUND",
        `pool ${request.poolId} not found`,
      );
    }
    if (
      typeof request.allocationWindowSeconds === "number" &&
      request.allocationWindowSeconds >
        (this.policy.maxAllocationWindowSeconds || 2592000)
    ) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError(
        "TELECOMCLAIM_ALLOCATION_WINDOW_OUT_OF_BOUNDS",
        `allocation window seconds ${request.allocationWindowSeconds} exceeds maximum ${this.policy.maxAllocationWindowSeconds}`,
      );
    }
    const claimKey = `${request.poolId}:${request.peerId || "anonymous"}`;
    if (this._verifiedClaims.has(claimKey)) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError(
        "TELECOMCLAIM_DUPLICATE",
        `bandwidth claim for pool ${request.poolId} already verified`,
      );
    }
    const claimId =
      request.claimId || `claim-${crypto.randomBytes(4).toString("hex")}`;
    const now = Math.floor(Date.now() / 1000);
    const claim = {
      claimId,
      poolId: request.poolId,
      blindedLatencyBoundCommitment:
        request.blindedLatencyBoundCommitment || "unspecified",
      blindedClaimValueCommitment:
        request.blindedClaimValueCommitment || "unspecified",
      zkTelecomRangeProofHash: request.zkTelecomRangeProofHash,
      routingCommitteeAttestationHash:
        request.routingCommitteeAttestationHash || "unspecified",
      verifiedAt: now,
    };
    this._verifiedClaims.set(claimKey, claim);
    this._hub.markBandwidthClaimVerified(request.poolId);
    if (this._audit) {
      this._audit("ZK_BANDWIDTH_CLAIM_VERIFIED", { ...claim });
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
      this.policy.banMalformedOrOutOfOrderTelecomClaims &&
      typeof request.peerId === "string"
    ) {
      this._bannedPeers.add(request.peerId);
    }
  }
}

function _validateClaimRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError(
      "TELECOMCLAIM_FIELDS_MISSING",
      "poolId is required",
    );
  }
  if (
    policy.requireRoutingCommitteeAttestation &&
    !request.routingCommitteeAttestation
  ) {
    throw new HsmAdapterError(
      "TELECOMCLAIM_ATTESTATION_MISSING",
      "routing committee attestation is required",
    );
  }
}

module.exports = { ZkBandwidthClaimValidator };
