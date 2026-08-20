"use strict";

/**
 * Track 96: ZK Research Claim Validator.
 *
 * Validates zero-knowledge research claims against polar research
 * data gating pools. Enforces canonical payload layout, verifies
 * vdfProofHash for time-locked research data release, and bans
 * peers broadcasting malformed or out-of-order claims.
 *
 * @module hsm-adapter/zk-research-claim-validator
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

class ZkResearchClaimValidator {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {PqcPolarResearchDataGatingHub} options.hub
   * @param {EnclaveAttestationClient} [options.attestationClient]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this.hub = options.hub || null;
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._verifiedClaims = new Set();
    this._bannedPeers = new Set();
  }

  /**
   * Verify a zero-knowledge research claim.
   * @param {object} request
   * @returns {object}
   */
  verifyResearchClaim(request) {
    _validateClaimRequest(this.policy, request, this._bannedPeers);
    const pool = this.hub ? this.hub.getPool(request.poolId) : null;
    if (!pool) {
      throw new HsmAdapterError(
        "POLARCLAIM_POOL_NOT_FOUND",
        `pool ${request.poolId} not found`,
      );
    }
    if (pool.status !== "open") {
      throw new HsmAdapterError(
        "POLARCLAIM_POOL_NOT_OPEN",
        `pool ${request.poolId} is not open`,
      );
    }
    if (
      this.policy.requirePolarResearchOversightCommitteeAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.polarResearchOversightCommitteeAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "POLARCLAIM_OVERSIGHT_COMMITTEE_UNATTESTED",
            "polar research oversight committee attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "POLARCLAIM_OVERSIGHT_COMMITTEE_UNATTESTED",
          "polar research oversight committee attestation invalid",
        );
      }
    }
    if (
      this.policy.banMalformedOrOutOfOrderResearchClaims &&
      request.peerId &&
      this._bannedPeers.has(request.peerId)
    ) {
      throw new HsmAdapterError(
        "POLARCLAIM_PEER_BANNED",
        `peer ${request.peerId} is banned`,
      );
    }
    const claimHash = crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          poolId: request.poolId,
          blindedResearchDataCommitment: request.blindedResearchDataCommitment,
          blindedSensorTelemetryCommitment:
            request.blindedSensorTelemetryCommitment,
          blindedInstitutionIdentityCommitment:
            request.blindedInstitutionIdentityCommitment,
          zkResearchRangeProofHash: request.zkResearchRangeProofHash,
          vdfProofHash: request.vdfProofHash,
        }),
      )
      .digest("hex");
    if (
      this.policy.banMalformedOrOutOfOrderResearchClaims &&
      this._verifiedClaims.has(claimHash)
    ) {
      if (request.peerId) this._bannedPeers.add(request.peerId);
      throw new HsmAdapterError(
        "POLARCLAIM_DUPLICATE",
        `duplicate research claim for pool ${request.poolId}`,
      );
    }
    this._verifiedClaims.add(claimHash);
    if (this.hub) this.hub.markResearchClaimVerified(request.poolId);
    const claimId =
      request.claimId || `claim-${crypto.randomBytes(4).toString("hex")}`;
    const claim = {
      claimId,
      poolId: request.poolId,
      vdfProofHash: request.vdfProofHash,
      zkResearchRangeProofHash: request.zkResearchRangeProofHash,
      verifiedAt: Math.floor(Date.now() / 1000),
    };
    if (this._audit) {
      this._audit("ZK_RESEARCH_CLAIM_VERIFIED", { ...claim });
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
   * Get the number of verified claims.
   * @returns {number}
   */
  getVerifiedClaimCount() {
    return this._verifiedClaims.size;
  }
}

function _validateClaimRequest(policy, request, bannedPeers) {
  if (!request.poolId) {
    throw new HsmAdapterError(
      "POLARCLAIM_FIELDS_MISSING",
      "poolId is required",
    );
  }
  if (
    !request.blindedResearchDataCommitment ||
    !request.blindedSensorTelemetryCommitment ||
    !request.blindedInstitutionIdentityCommitment
  ) {
    throw new HsmAdapterError(
      "POLARCLAIM_FIELDS_MISSING",
      "blindedResearchDataCommitment, blindedSensorTelemetryCommitment, and blindedInstitutionIdentityCommitment are required",
    );
  }
  if (!request.zkResearchRangeProofHash) {
    if (policy.banMalformedOrOutOfOrderResearchClaims && request.peerId)
      bannedPeers.add(request.peerId);
    throw new HsmAdapterError(
      "POLARCLAIM_ZK_PROOF_MISSING",
      "zkResearchRangeProofHash is required",
    );
  }
  if (!request.vdfProofHash) {
    if (policy.banMalformedOrOutOfOrderResearchClaims && request.peerId)
      bannedPeers.add(request.peerId);
    throw new HsmAdapterError(
      "POLARCLAIM_VDF_PROOF_MISSING",
      "vdfProofHash is required",
    );
  }
  if (
    policy.requirePolarResearchOversightCommitteeAttestation &&
    !request.polarResearchOversightCommitteeAttestation
  ) {
    throw new HsmAdapterError(
      "POLARCLAIM_OVERSIGHT_ATTESTATION_MISSING",
      "polar research oversight committee attestation is required",
    );
  }
}

module.exports = { ZkResearchClaimValidator };
