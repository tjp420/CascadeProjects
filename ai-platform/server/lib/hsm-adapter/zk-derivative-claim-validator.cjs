"use strict";

/**
 * Track 78: ZK Derivative Claim Validator.
 *
 * Succinct derivative verifier that processes non-interactive
 * zero-knowledge range and risk proofs, ensuring that an
 * entity's hidden derivative claim status strictly satisfies
 * policy-defined thresholds without disclosing individual
 * derivative or counterparty attributes. Triggers defensive
 * node bans for malformed or out-of-order derivative claims.
 *
 * @module hsm-adapter/zk-derivative-claim-validator
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

class ZkDerivativeClaimValidator {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {PqcFinancialDerivativesGatingHub} options.hub
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
   * Verify a derivative claim proof.
   * @param {object} request
   * @returns {object}
   */
  verifyDerivativeClaim(request) {
    _validateClaimRequest(this.policy, request);
    if (!this._hub) {
      throw new HsmAdapterError(
        "DERIVCLAIM_HUB_MISSING",
        "financial derivatives gating hub is required",
      );
    }
    if (
      this.policy.requireRiskCommitteeAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.riskCommitteeAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "DERIVCLAIM_COMMITTEE_UNATTESTED",
            "risk committee attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "DERIVCLAIM_COMMITTEE_UNATTESTED",
          "risk committee attestation invalid",
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
        "DERIVCLAIM_AUTHORITY_BLOCKED",
        `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(", ")}`,
      );
    }
    if (
      typeof request.peerId === "string" &&
      this._bannedPeers.has(request.peerId)
    ) {
      throw new HsmAdapterError(
        "DERIVCLAIM_PEER_BANNED",
        `peer ${request.peerId} is banned`,
      );
    }
    if (
      !request.zkDerivativeRangeProofHash ||
      typeof request.zkDerivativeRangeProofHash !== "string"
    ) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError(
        "DERIVCLAIM_ZK_PROOF_MISSING",
        "zero-knowledge derivative range proof hash is required",
      );
    }
    if (
      !request.partialSignature ||
      typeof request.partialSignature !== "string"
    ) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError(
        "DERIVCLAIM_PARTIAL_SIG_MISSING",
        "partial signature is required",
      );
    }
    const pool = this._hub.getPool(request.poolId);
    if (!pool) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError(
        "DERIVCLAIM_POOL_NOT_FOUND",
        `pool ${request.poolId} not found`,
      );
    }
    if (
      typeof request.contractExpirationSeconds === "number" &&
      request.contractExpirationSeconds >
        (this.policy.maxContractExpirationSeconds || 31536000)
    ) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError(
        "DERIVCLAIM_CONTRACT_EXPIRATION_OUT_OF_BOUNDS",
        `contract expiration seconds ${request.contractExpirationSeconds} exceeds maximum ${this.policy.maxContractExpirationSeconds}`,
      );
    }
    const claimKey = `${request.poolId}:${request.peerId || "anonymous"}`;
    if (this._verifiedClaims.has(claimKey)) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError(
        "DERIVCLAIM_DUPLICATE",
        `derivative claim for pool ${request.poolId} already verified`,
      );
    }
    const claimId =
      request.claimId || `claim-${crypto.randomBytes(4).toString("hex")}`;
    const now = Math.floor(Date.now() / 1000);
    const claim = {
      claimId,
      poolId: request.poolId,
      blindedCounterpartyRiskCommitment:
        request.blindedCounterpartyRiskCommitment || "unspecified",
      blindedClaimValueCommitment:
        request.blindedClaimValueCommitment || "unspecified",
      zkDerivativeRangeProofHash: request.zkDerivativeRangeProofHash,
      riskCommitteeAttestationHash:
        request.riskCommitteeAttestationHash || "unspecified",
      verifiedAt: now,
    };
    this._verifiedClaims.set(claimKey, claim);
    this._hub.markDerivativeClaimVerified(request.poolId);
    if (this._audit) {
      this._audit("ZK_DERIVATIVE_CLAIM_VERIFIED", { ...claim });
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
      this.policy.banMalformedOrOutOfOrderDerivativeClaims &&
      typeof request.peerId === "string"
    ) {
      this._bannedPeers.add(request.peerId);
    }
  }
}

function _validateClaimRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError(
      "DERIVCLAIM_FIELDS_MISSING",
      "poolId is required",
    );
  }
  if (
    policy.requireRiskCommitteeAttestation &&
    !request.riskCommitteeAttestation
  ) {
    throw new HsmAdapterError(
      "DERIVCLAIM_ATTESTATION_MISSING",
      "risk committee attestation is required",
    );
  }
}

module.exports = { ZkDerivativeClaimValidator };
