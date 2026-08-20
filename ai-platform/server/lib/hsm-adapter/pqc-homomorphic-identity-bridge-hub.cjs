"use strict";

/**
 * Track 60: Post-Quantum Homomorphic Identity Bridge Hub.
 *
 * Multi-platform identity manager that aggregates encrypted node
 * registry updates from independent networks, running dot-product
 * evaluation matrix math directly over ciphertexts.
 *
 * @module hsm-adapter/pqc-homomorphic-identity-bridge-hub
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

class PqcHomomorphicIdentityBridgeHub {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {EnclaveAttestationClient} [options.attestationClient]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._bridges = new Map();
  }

  /**
   * Initialize a homomorphic identity bridge.
   * @param {object} request
   * @returns {object}
   */
  initializeBridge(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireRouterAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(
          request.routerAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "HOMOID_ROUTER_UNATTESTED",
            "router attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "HOMOID_ROUTER_UNATTESTED",
          "router attestation invalid",
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
        "HOMOID_ATTESTATION_AUTHORITY_BLOCKED",
        `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(", ")}`,
      );
    }
    if (
      typeof request.pqcSignatureScheme === "string" &&
      !this.policy.allowedPqcSignatureSchemes.includes(
        request.pqcSignatureScheme,
      )
    ) {
      throw new HsmAdapterError(
        "HOMOID_PQC_SCHEME_BLOCKED",
        `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(", ")}`,
      );
    }
    if (
      typeof request.matrixDepth === "number" &&
      request.matrixDepth > (this.policy.maxHomomorphicMatrixDepth || 32)
    ) {
      throw new HsmAdapterError(
        "HOMOID_MATRIX_DEPTH_EXCEEDED",
        `homomorphic matrix depth ${request.matrixDepth} exceeds maximum ${this.policy.maxHomomorphicMatrixDepth}`,
      );
    }
    const bridgeId =
      request.bridgeId || `bridge-${crypto.randomBytes(4).toString("hex")}`;
    if (this._bridges.has(bridgeId)) {
      throw new HsmAdapterError(
        "HOMOID_BRIDGE_DUPLICATE",
        `bridge ${bridgeId} already exists`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    const proofWindow =
      request.identityProofWindowSeconds ||
      this.policy.maxIdentityProofWindowSeconds ||
      86400;
    if (proofWindow > (this.policy.maxIdentityProofWindowSeconds || 86400)) {
      throw new HsmAdapterError(
        "HOMOID_PROOF_WINDOW_EXCEEDED",
        `identity proof window ${proofWindow}s exceeds maximum ${this.policy.maxIdentityProofWindowSeconds}s`,
      );
    }
    const bridge = {
      bridgeId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      matrixDepth: request.matrixDepth || 8,
      pqcSignatureScheme: request.pqcSignatureScheme,
      identityProofWindowSeconds: proofWindow,
      status: "active",
      initializedAt: now,
      expiresAt: now + proofWindow,
      encryptedMatrix: request.encryptedMatrix || null,
    };
    this._bridges.set(bridgeId, bridge);
    if (this._audit) {
      this._audit("HOMOMORPHIC_IDENTITY_BRIDGE_INITIALIZED", { ...bridge });
    }
    return bridge;
  }

  /**
   * Get a bridge by id.
   * @param {string} bridgeId
   * @returns {object|null}
   */
  getBridge(bridgeId) {
    return this._bridges.get(bridgeId) || null;
  }

  /**
   * Check if a bridge is still within its proof window.
   * @param {string} bridgeId
   * @returns {boolean}
   */
  isBridgeActive(bridgeId) {
    const bridge = this._bridges.get(bridgeId);
    if (!bridge) return false;
    const now = Math.floor(Date.now() / 1000);
    return now <= bridge.expiresAt && bridge.status === "active";
  }

  /**
   * Mark a bridge as finalized.
   * @param {string} bridgeId
   */
  markFinalized(bridgeId) {
    const bridge = this._bridges.get(bridgeId);
    if (!bridge) {
      throw new HsmAdapterError(
        "HOMOID_BRIDGE_NOT_FOUND",
        `bridge ${bridgeId} not found`,
      );
    }
    bridge.status = "finalized";
  }

  /**
   * Evaluate a dot-product over encrypted matrix vectors (simulated).
   * @param {Array} vectorA
   * @param {Array} vectorB
   * @returns {number}
   */
  evaluateEncryptedDotProduct(vectorA, vectorB) {
    if (!Array.isArray(vectorA) || !Array.isArray(vectorB)) {
      throw new HsmAdapterError(
        "HOMOID_MATRIX_INVALID",
        "dot product requires two arrays",
      );
    }
    if (vectorA.length !== vectorB.length) {
      throw new HsmAdapterError(
        "HOMOID_MATRIX_MISMATCH",
        `vector length mismatch: ${vectorA.length} vs ${vectorB.length}`,
      );
    }
    if (vectorA.length > (this.policy.maxHomomorphicMatrixDepth || 32)) {
      throw new HsmAdapterError(
        "HOMOID_MATRIX_DEPTH_EXCEEDED",
        `vector length ${vectorA.length} exceeds maximum depth ${this.policy.maxHomomorphicMatrixDepth}`,
      );
    }
    let product = 0;
    for (let i = 0; i < vectorA.length; i++) {
      product += (vectorA[i] || 0) * (vectorB[i] || 0);
    }
    return product;
  }
}

function _validateInitRequest(policy, request) {
  if (!request.sourceTenantId || !request.targetChainId) {
    throw new HsmAdapterError(
      "HOMOID_FIELDS_MISSING",
      "sourceTenantId and targetChainId are required",
    );
  }
  if (policy.requireRouterAttestation && !request.routerAttestation) {
    throw new HsmAdapterError(
      "HOMOID_ROUTER_ATTESTATION_MISSING",
      "router attestation is required",
    );
  }
}

module.exports = { PqcHomomorphicIdentityBridgeHub };
