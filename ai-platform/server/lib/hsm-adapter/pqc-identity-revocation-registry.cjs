"use strict";

/**
 * Track 61: Post-Quantum Identity Revocation Registry.
 *
 * Cross-network revocation manager that tracks blacklisted identities
 * via blinded cryptographic accumulation hashes. Parses REVOKPUB
 * packets, enforces maxRevocationListCapacity, and applies the
 * minRevocationCommitteeQuorum criteria.
 *
 * @module hsm-adapter/pqc-identity-revocation-registry
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

class PqcIdentityRevocationRegistry {
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
    this._revocations = new Map();
    this._blindedSet = new Set();
    this._accumulatorRoot = crypto.createHash("sha256").digest("hex");
  }

  /**
   * Publish a revocation.
   * @param {object} request
   * @returns {object}
   */
  publishRevocation(request) {
    _validatePublishRequest(this.policy, request);
    if (this.policy.requirePublisherAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(
          request.publisherAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "REVOK_PUBLISHER_UNATTESTED",
            "publisher attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "REVOK_PUBLISHER_UNATTESTED",
          "publisher attestation invalid",
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
        "REVOK_ATTESTATION_AUTHORITY_BLOCKED",
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
        "REVOK_PQC_SCHEME_BLOCKED",
        `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(", ")}`,
      );
    }
    if (
      this._revocations.size >=
      (this.policy.maxRevocationListCapacity || 100000)
    ) {
      throw new HsmAdapterError(
        "REVOK_LIST_CAPACITY_EXCEEDED",
        `revocation list capacity ${this._revocations.size} exceeds maximum ${this.policy.maxRevocationListCapacity}`,
      );
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minRevocationCommitteeQuorum || 3)) {
      throw new HsmAdapterError(
        "REVOK_QUORUM_INSUFFICIENT",
        `committee signatures ${signatures.length} below minimum ${this.policy.minRevocationCommitteeQuorum}`,
      );
    }
    const revocationId =
      request.revocationId || `revok-${crypto.randomBytes(4).toString("hex")}`;
    if (this._revocations.has(revocationId)) {
      throw new HsmAdapterError(
        "REVOK_DUPLICATE",
        `revocation ${revocationId} already exists`,
      );
    }
    const blindedHash = request.blindedIdentityHash;
    if (this._blindedSet.has(blindedHash)) {
      throw new HsmAdapterError(
        "REVOK_IDENTITY_DUPLICATE",
        `blinded identity ${blindedHash} already revoked`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    const revocation = {
      revocationId,
      sourceTenantId: request.sourceTenantId,
      blindedIdentityHash: blindedHash,
      accumulatorRootHash: request.accumulatorRootHash || this._accumulatorRoot,
      pqcSignatureScheme: request.pqcSignatureScheme,
      committeeSignatureCount: signatures.length,
      publishedAt: now,
      status: "active",
    };
    this._revocations.set(revocationId, revocation);
    this._blindedSet.add(blindedHash);
    this._accumulatorRoot = crypto
      .createHash("sha256")
      .update(this._accumulatorRoot + blindedHash)
      .digest("hex");
    revocation.accumulatorRootHash = this._accumulatorRoot;
    if (this._audit) {
      this._audit("IDENTITY_REVOCATION_PUBLISHED", { ...revocation });
    }
    return revocation;
  }

  /**
   * Check if a blinded identity hash is revoked.
   * @param {string} blindedIdentityHash
   * @returns {boolean}
   */
  isRevoked(blindedIdentityHash) {
    return this._blindedSet.has(blindedIdentityHash);
  }

  /**
   * Get a revocation by id.
   * @param {string} revocationId
   * @returns {object|null}
   */
  getRevocation(revocationId) {
    return this._revocations.get(revocationId) || null;
  }

  /**
   * Get the current accumulator root hash.
   * @returns {string}
   */
  getAccumulatorRoot() {
    return this._accumulatorRoot;
  }

  /**
   * Get the current revocation list size.
   * @returns {number}
   */
  getRevocationCount() {
    return this._revocations.size;
  }
}

function _validatePublishRequest(policy, request) {
  if (!request.sourceTenantId || !request.blindedIdentityHash) {
    throw new HsmAdapterError(
      "REVOK_FIELDS_MISSING",
      "sourceTenantId and blindedIdentityHash are required",
    );
  }
  if (policy.requirePublisherAttestation && !request.publisherAttestation) {
    throw new HsmAdapterError(
      "REVOK_PUBLISHER_ATTESTATION_MISSING",
      "publisher attestation is required",
    );
  }
}

module.exports = { PqcIdentityRevocationRegistry };
