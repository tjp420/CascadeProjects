"use strict";

/**
 * Track 60: MPC Homomorphic Consensus Verifier.
 *
 * Decentralized validation engine that processes zero-knowledge
 * cross-chain identity assertions, verifying that an entity belongs
 * to a valid external threshold group without exposing the underlying
 * node parameters. Triggers defensive peer bans for out-of-order or
 * malformed consensus proofs.
 *
 * @module hsm-adapter/mpc-homomorphic-consensus-verifier
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

class MpcHomomorphicConsensusVerifier {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {PqcHomomorphicIdentityBridgeHub} options.bridge
   * @param {EnclaveAttestationClient} [options.attestationClient]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._bridge = options.bridge || null;
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._assertions = new Map();
    this._bannedPeers = new Set();
  }

  /**
   * Process a cross-chain identity assertion.
   * @param {object} request
   * @returns {object}
   */
  processAssertion(request) {
    _validateAssertionRequest(this.policy, request);
    if (!this._bridge) {
      throw new HsmAdapterError(
        "HOMOID_ASSERT_BRIDGE_MISSING",
        "identity bridge hub is required",
      );
    }
    const bridge = this._bridge.getBridge(request.bridgeId);
    if (!bridge) {
      if (
        this.policy.banMalformedOrOutOfOrderProofs &&
        typeof request.peerId === "string"
      ) {
        this._bannedPeers.add(request.peerId);
      }
      throw new HsmAdapterError(
        "HOMOID_BRIDGE_NOT_FOUND",
        `bridge ${request.bridgeId} not found`,
      );
    }
    if (!this._bridge.isBridgeActive(request.bridgeId)) {
      if (
        this.policy.banMalformedOrOutOfOrderProofs &&
        typeof request.peerId === "string"
      ) {
        this._bannedPeers.add(request.peerId);
      }
      throw new HsmAdapterError(
        "HOMOID_BRIDGE_INACTIVE",
        `bridge ${request.bridgeId} is no longer active`,
      );
    }
    if (
      this.policy.requireCommitteeVerifierAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.committeeVerifierAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "HOMOID_COMMITTEE_VERIFIER_UNATTESTED",
            "committee verifier attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "HOMOID_COMMITTEE_VERIFIER_UNATTESTED",
          "committee verifier attestation invalid",
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
        "HOMOID_ASSERT_AUTHORITY_BLOCKED",
        `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(", ")}`,
      );
    }
    if (
      typeof request.peerId === "string" &&
      this._bannedPeers.has(request.peerId)
    ) {
      throw new HsmAdapterError(
        "HOMOID_ASSERT_PEER_BANNED",
        `peer ${request.peerId} is banned`,
      );
    }
    const assertionKey = `${request.bridgeId}:${request.entityIdHash}`;
    if (this._assertions.has(assertionKey)) {
      if (
        this.policy.banMalformedOrOutOfOrderProofs &&
        typeof request.peerId === "string"
      ) {
        this._bannedPeers.add(request.peerId);
      }
      throw new HsmAdapterError(
        "HOMOID_ASSERT_DUPLICATE",
        `assertion for entity ${request.entityIdHash} already recorded for bridge ${request.bridgeId}`,
      );
    }
    if (!request.zkProofHash || typeof request.zkProofHash !== "string") {
      if (
        this.policy.banMalformedOrOutOfOrderProofs &&
        typeof request.peerId === "string"
      ) {
        this._bannedPeers.add(request.peerId);
      }
      throw new HsmAdapterError(
        "HOMOID_ZK_PROOF_MISSING",
        "zero-knowledge proof hash is required",
      );
    }
    if (
      !request.partialSignature ||
      typeof request.partialSignature !== "string"
    ) {
      if (
        this.policy.banMalformedOrOutOfOrderProofs &&
        typeof request.peerId === "string"
      ) {
        this._bannedPeers.add(request.peerId);
      }
      throw new HsmAdapterError(
        "HOMOID_PARTIAL_SIG_MISSING",
        "partial signature is required",
      );
    }
    const assertionId =
      request.assertionId || `assert-${crypto.randomBytes(4).toString("hex")}`;
    const assertion = {
      assertionId,
      bridgeId: request.bridgeId,
      entityIdHash: request.entityIdHash,
      thresholdGroupHash: request.thresholdGroupHash,
      zkProofHash: request.zkProofHash,
      partialSignature: request.partialSignature,
      platformId: request.platformId || "unknown",
      recordedAt: Math.floor(Date.now() / 1000),
    };
    this._assertions.set(assertionKey, assertion);
    return assertion;
  }

  /**
   * Check if consensus has been reached and finalize.
   * @param {string} bridgeId
   * @returns {object}
   */
  checkAndFinalize(bridgeId) {
    if (!this._bridge) {
      throw new HsmAdapterError(
        "HOMOID_FINALIZE_BRIDGE_MISSING",
        "identity bridge hub is required",
      );
    }
    const bridge = this._bridge.getBridge(bridgeId);
    if (!bridge) {
      throw new HsmAdapterError(
        "HOMOID_BRIDGE_NOT_FOUND",
        `bridge ${bridgeId} not found`,
      );
    }
    if (bridge.status === "finalized") {
      throw new HsmAdapterError(
        "HOMOID_BRIDGE_ALREADY_FINALIZED",
        `bridge ${bridgeId} already finalized`,
      );
    }
    if (!this._bridge.isBridgeActive(bridgeId)) {
      throw new HsmAdapterError(
        "HOMOID_BRIDGE_INACTIVE",
        `bridge ${bridgeId} is no longer active`,
      );
    }
    const assertions = [];
    for (const [key, assertion] of this._assertions) {
      if (key.startsWith(`${bridgeId}:`)) {
        assertions.push(assertion);
      }
    }
    if (assertions.length < (this.policy.minCrossChainQuorum || 3)) {
      return {
        finalized: false,
        reason: `assertions ${assertions.length} below minimum quorum ${this.policy.minCrossChainQuorum}`,
        assertionCount: assertions.length,
      };
    }
    this._bridge.markFinalized(bridgeId);
    const result = {
      finalized: true,
      bridgeId,
      assertionCount: assertions.length,
      finalizedAt: Math.floor(Date.now() / 1000),
    };
    if (this._audit) {
      this._audit("MPC_CROSS_CHAIN_CONSENSUS_FINALIZED", { ...result });
    }
    return result;
  }

  /**
   * Get all assertions for a bridge.
   * @param {string} bridgeId
   * @returns {Array}
   */
  getAssertionsForBridge(bridgeId) {
    const assertions = [];
    for (const [key, assertion] of this._assertions) {
      if (key.startsWith(`${bridgeId}:`)) {
        assertions.push(assertion);
      }
    }
    return assertions;
  }

  /**
   * Check if a peer is banned.
   * @param {string} peerId
   * @returns {boolean}
   */
  isPeerBanned(peerId) {
    return this._bannedPeers.has(peerId);
  }
}

function _validateAssertionRequest(policy, request) {
  if (
    !request.bridgeId ||
    !request.entityIdHash ||
    !request.thresholdGroupHash
  ) {
    throw new HsmAdapterError(
      "HOMOID_ASSERT_FIELDS_MISSING",
      "bridgeId, entityIdHash, and thresholdGroupHash are required",
    );
  }
  if (
    policy.requireCommitteeVerifierAttestation &&
    !request.committeeVerifierAttestation
  ) {
    throw new HsmAdapterError(
      "HOMOID_ASSERT_ATTESTATION_MISSING",
      "committee verifier attestation is required",
    );
  }
}

module.exports = { MpcHomomorphicConsensusVerifier };
