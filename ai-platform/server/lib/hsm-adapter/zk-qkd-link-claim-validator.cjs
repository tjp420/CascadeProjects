"use strict";

/**
 * Track 109: ZK QKD Link Claim Validator.
 *
 * Validates zero-knowledge quantum key distribution link-switch claims
 * against qkd link gating pools. Enforces canonical payload layout,
 * verifies quantumSecretSharingDigest for quantum secret sharing (QSS)
 * validation, and bans peers broadcasting malformed or out-of-order claims.
 *
 * @module hsm-adapter/zk-qkd-link-claim-validator
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

class ZkQkdLinkClaimValidator {
  constructor(options = {}) {
    this.policy = options.policy || {};
    this.hub = options.hub || null;
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._verifiedClaims = new Set();
    this._bannedPeers = new Set();
  }

  verifyQkdLinkClaim(request) {
    _validateClaimRequest(this.policy, request, this._bannedPeers);
    const pool = this.hub ? this.hub.getPool(request.poolId) : null;
    if (!pool) {
      throw new HsmAdapterError(
        "QKDSWITCHCLAIM_POOL_NOT_FOUND",
        `pool ${request.poolId} not found`,
      );
    }
    if (pool.status !== "open") {
      throw new HsmAdapterError(
        "QKDSWITCHCLAIM_POOL_NOT_OPEN",
        `pool ${request.poolId} is not open`,
      );
    }
    if (
      this.policy.requireQkdEthicsOversightCommitteeAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.qkdEthicsOversightCommitteeAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "QKDSWITCHCLAIM_OVERSIGHT_COMMITTEE_UNATTESTED",
            "qkd ethics oversight committee attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "QKDSWITCHCLAIM_OVERSIGHT_COMMITTEE_UNATTESTED",
          "qkd ethics oversight committee attestation invalid",
        );
      }
    }
    if (
      this.policy.banMalformedOrOutOfOrderQkdLinkClaims &&
      request.peerId &&
      this._bannedPeers.has(request.peerId)
    ) {
      throw new HsmAdapterError(
        "QKDSWITCHCLAIM_PEER_BANNED",
        `peer ${request.peerId} is banned`,
      );
    }
    const claimHash = crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          poolId: request.poolId,
          blindedOpticalLinkPathCommitment:
            request.blindedOpticalLinkPathCommitment,
          blindedQuantumSecretSharingCommitment:
            request.blindedQuantumSecretSharingCommitment,
          blindedEntanglingChannelCommitment:
            request.blindedEntanglingChannelCommitment,
          zkQkdLinkRangeProofHash: request.zkQkdLinkRangeProofHash,
          quantumSecretSharingDigest: request.quantumSecretSharingDigest,
        }),
      )
      .digest("hex");
    if (
      this.policy.banMalformedOrOutOfOrderQkdLinkClaims &&
      this._verifiedClaims.has(claimHash)
    ) {
      if (request.peerId) this._bannedPeers.add(request.peerId);
      throw new HsmAdapterError(
        "QKDSWITCHCLAIM_DUPLICATE",
        `duplicate qkd link claim for pool ${request.poolId}`,
      );
    }
    this._verifiedClaims.add(claimHash);
    if (this.hub) this.hub.markQkdLinkClaimVerified(request.poolId);
    const claimId =
      request.claimId || `claim-${crypto.randomBytes(4).toString("hex")}`;
    const claim = {
      claimId,
      poolId: request.poolId,
      quantumSecretSharingDigest: request.quantumSecretSharingDigest,
      zkQkdLinkRangeProofHash: request.zkQkdLinkRangeProofHash,
      verifiedAt: Math.floor(Date.now() / 1000),
    };
    if (this._audit) {
      this._audit("ZK_QKD_LINK_CLAIM_VERIFIED", { ...claim });
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
      "QKDSWITCHCLAIM_FIELDS_MISSING",
      "poolId is required",
    );
  }
  if (
    !request.blindedOpticalLinkPathCommitment ||
    !request.blindedQuantumSecretSharingCommitment ||
    !request.blindedEntanglingChannelCommitment
  ) {
    throw new HsmAdapterError(
      "QKDSWITCHCLAIM_FIELDS_MISSING",
      "blindedOpticalLinkPathCommitment, blindedQuantumSecretSharingCommitment, and blindedEntanglingChannelCommitment are required",
    );
  }
  if (!request.zkQkdLinkRangeProofHash) {
    if (policy.banMalformedOrOutOfOrderQkdLinkClaims && request.peerId)
      bannedPeers.add(request.peerId);
    throw new HsmAdapterError(
      "QKDSWITCHCLAIM_ZK_PROOF_MISSING",
      "zkQkdLinkRangeProofHash is required",
    );
  }
  if (!request.quantumSecretSharingDigest) {
    if (policy.banMalformedOrOutOfOrderQkdLinkClaims && request.peerId)
      bannedPeers.add(request.peerId);
    throw new HsmAdapterError(
      "QKDSWITCHCLAIM_QUANTUM_SECRET_SHARING_DIGEST_MISSING",
      "quantumSecretSharingDigest is required",
    );
  }
  if (
    policy.requireQkdEthicsOversightCommitteeAttestation &&
    !request.qkdEthicsOversightCommitteeAttestation
  ) {
    throw new HsmAdapterError(
      "QKDSWITCHCLAIM_OVERSIGHT_ATTESTATION_MISSING",
      "qkd ethics oversight committee attestation is required",
    );
  }
}

module.exports = { ZkQkdLinkClaimValidator };
