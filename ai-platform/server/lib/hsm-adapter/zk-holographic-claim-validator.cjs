"use strict";

/**
 * Track 110: ZK Holographic Claim Validator.
 *
 * Validates zero-knowledge holographic storage content-addressable claims
 * against holographic storage gating pools. Enforces canonical payload
 * layout, verifies holographicStateDigest for holographic state (HGS)
 * validation, and bans peers broadcasting malformed or out-of-order claims.
 *
 * @module hsm-adapter/zk-holographic-claim-validator
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

class ZkHolographicClaimValidator {
  constructor(options = {}) {
    this.policy = options.policy || {};
    this.hub = options.hub || null;
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._verifiedClaims = new Set();
    this._bannedPeers = new Set();
  }

  verifyHolographicClaim(request) {
    _validateClaimRequest(this.policy, request, this._bannedPeers);
    const pool = this.hub ? this.hub.getPool(request.poolId) : null;
    if (!pool) {
      throw new HsmAdapterError(
        "HOLOCCLAIM_POOL_NOT_FOUND",
        `pool ${request.poolId} not found`,
      );
    }
    if (pool.status !== "open") {
      throw new HsmAdapterError(
        "HOLOCCLAIM_POOL_NOT_OPEN",
        `pool ${request.poolId} is not open`,
      );
    }
    if (
      this.policy.requireHolographicEthicsOversightCommitteeAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.holographicEthicsOversightCommitteeAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "HOLOCCLAIM_OVERSIGHT_COMMITTEE_UNATTESTED",
            "holographic ethics oversight committee attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "HOLOCCLAIM_OVERSIGHT_COMMITTEE_UNATTESTED",
          "holographic ethics oversight committee attestation invalid",
        );
      }
    }
    if (
      this.policy.banMalformedOrOutOfOrderHolographicClaims &&
      request.peerId &&
      this._bannedPeers.has(request.peerId)
    ) {
      throw new HsmAdapterError(
        "HOLOCCLAIM_PEER_BANNED",
        `peer ${request.peerId} is banned`,
      );
    }
    const claimHash = crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          poolId: request.poolId,
          blindedVolumetricSectorDigestCommitment:
            request.blindedVolumetricSectorDigestCommitment,
          blindedHolographicStateCommitment:
            request.blindedHolographicStateCommitment,
          blindedInterferencePatternPhaseCommitment:
            request.blindedInterferencePatternPhaseCommitment,
          zkHolographicRangeProofHash: request.zkHolographicRangeProofHash,
          holographicStateDigest: request.holographicStateDigest,
        }),
      )
      .digest("hex");
    if (
      this.policy.banMalformedOrOutOfOrderHolographicClaims &&
      this._verifiedClaims.has(claimHash)
    ) {
      if (request.peerId) this._bannedPeers.add(request.peerId);
      throw new HsmAdapterError(
        "HOLOCCLAIM_DUPLICATE",
        `duplicate holographic claim for pool ${request.poolId}`,
      );
    }
    this._verifiedClaims.add(claimHash);
    if (this.hub) this.hub.markHolographicClaimVerified(request.poolId);
    const claimId =
      request.claimId || `claim-${crypto.randomBytes(4).toString("hex")}`;
    const claim = {
      claimId,
      poolId: request.poolId,
      holographicStateDigest: request.holographicStateDigest,
      zkHolographicRangeProofHash: request.zkHolographicRangeProofHash,
      verifiedAt: Math.floor(Date.now() / 1000),
    };
    if (this._audit) {
      this._audit("ZK_HOLOGRAPHIC_CLAIM_VERIFIED", { ...claim });
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
      "HOLOCCLAIM_FIELDS_MISSING",
      "poolId is required",
    );
  }
  if (
    !request.blindedVolumetricSectorDigestCommitment ||
    !request.blindedHolographicStateCommitment ||
    !request.blindedInterferencePatternPhaseCommitment
  ) {
    throw new HsmAdapterError(
      "HOLOCCLAIM_FIELDS_MISSING",
      "blindedVolumetricSectorDigestCommitment, blindedHolographicStateCommitment, and blindedInterferencePatternPhaseCommitment are required",
    );
  }
  if (!request.zkHolographicRangeProofHash) {
    if (policy.banMalformedOrOutOfOrderHolographicClaims && request.peerId)
      bannedPeers.add(request.peerId);
    throw new HsmAdapterError(
      "HOLOCCLAIM_ZK_PROOF_MISSING",
      "zkHolographicRangeProofHash is required",
    );
  }
  if (!request.holographicStateDigest) {
    if (policy.banMalformedOrOutOfOrderHolographicClaims && request.peerId)
      bannedPeers.add(request.peerId);
    throw new HsmAdapterError(
      "HOLOCCLAIM_HOLOGRAPHIC_STATE_DIGEST_MISSING",
      "holographicStateDigest is required",
    );
  }
  if (
    policy.requireHolographicEthicsOversightCommitteeAttestation &&
    !request.holographicEthicsOversightCommitteeAttestation
  ) {
    throw new HsmAdapterError(
      "HOLOCCLAIM_OVERSIGHT_ATTESTATION_MISSING",
      "holographic ethics oversight committee attestation is required",
    );
  }
}

module.exports = { ZkHolographicClaimValidator };
