"use strict";

/**
 * Track 98: PQC Orbital Debris Tracking Gating Hub.
 *
 * Interlocking space surveillance authority endpoint coordinator
 * that instantiates multi-party orbital debris tracking verification
 * pools using homomorphically split Pedersen commitments over
 * debris trajectory hashes, collision probability digests, and
 * space surveillance authority identity hashes. Parses ORBIGATE
 * packets, enforces maxTrackingChainDepth, and tracks state
 * transitions alongside the minOrbitalQuorum boundary.
 *
 * @module hsm-adapter/pqc-orbital-debris-tracking-gating-hub
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

class PqcOrbitalDebrisTrackingGatingHub {
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
    this._pools = new Map();
  }

  /**
   * Initialize an orbital debris tracking gating pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (
      this.policy.requireSpaceSurveillanceAuthorityInitializerAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.spaceSurveillanceAuthorityInitializerAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "ORBIGATE_AUTHORITY_INITIALIZER_UNATTESTED",
            "space surveillance authority initializer attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "ORBIGATE_AUTHORITY_INITIALIZER_UNATTESTED",
          "space surveillance authority initializer attestation invalid",
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
        "ORBIGATE_ATTESTATION_AUTHORITY_BLOCKED",
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
        "ORBIGATE_PQC_SCHEME_BLOCKED",
        `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(", ")}`,
      );
    }
    if (
      typeof request.collisionWindowSeconds === "number" &&
      request.collisionWindowSeconds >
        (this.policy.maxCollisionWindowSeconds || 15768000)
    ) {
      throw new HsmAdapterError(
        "ORBIGATE_COLLISION_WINDOW_EXCEEDED",
        `collision window seconds ${request.collisionWindowSeconds} exceeds maximum ${this.policy.maxCollisionWindowSeconds}`,
      );
    }
    if (
      typeof request.trackingChainDepth === "number" &&
      request.trackingChainDepth > (this.policy.maxTrackingChainDepth || 18)
    ) {
      throw new HsmAdapterError(
        "ORBIGATE_TRACKING_DEPTH_EXCEEDED",
        `tracking chain depth ${request.trackingChainDepth} exceeds maximum ${this.policy.maxTrackingChainDepth}`,
      );
    }
    const poolId =
      request.poolId || `pool-${crypto.randomBytes(4).toString("hex")}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError(
        "ORBIGATE_DUPLICATE",
        `pool ${poolId} already exists`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedDebrisTrajectoryCommitment:
        request.blindedDebrisTrajectoryCommitment,
      blindedCollisionProbabilityCommitment:
        request.blindedCollisionProbabilityCommitment,
      blindedSurveillanceAuthorityIdentityCommitment:
        request.blindedSurveillanceAuthorityIdentityCommitment,
      collisionWindowSeconds: request.collisionWindowSeconds,
      trackingChainDepth: request.trackingChainDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: "open",
      debrisClaimVerified: false,
      collisionAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit("ORBITAL_DEBRIS_POOL_INITIALIZED", { ...pool });
    }
    return pool;
  }

  /**
   * Get a pool by id.
   * @param {string} poolId
   * @returns {object|null}
   */
  getPool(poolId) {
    return this._pools.get(poolId) || null;
  }

  /**
   * Mark a pool as debris-claim-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markDebrisClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "ORBIGATE_NOT_FOUND",
        `pool ${poolId} not found`,
      );
    }
    pool.debrisClaimVerified = true;
    return pool;
  }

  /**
   * Complete collision accreditation after quorum.
   * @param {object} request
   * @returns {object}
   */
  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "ORBIGATE_NOT_FOUND",
        `pool ${request.poolId} not found`,
      );
    }
    if (!pool.debrisClaimVerified) {
      throw new HsmAdapterError(
        "ORBIGATE_DEBRIS_CLAIM_NOT_VERIFIED",
        `pool ${request.poolId} debris claim not verified`,
      );
    }
    if (
      this.policy.requireOrbitalDebrisOversightCommitteeAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.orbitalDebrisOversightCommitteeAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "ORBIGATE_OVERSIGHT_COMMITTEE_UNATTESTED",
            "orbital debris oversight committee attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "ORBIGATE_OVERSIGHT_COMMITTEE_UNATTESTED",
          "orbital debris oversight committee attestation invalid",
        );
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minOrbitalQuorum || 5)) {
      throw new HsmAdapterError(
        "ORBIGATE_QUORUM_INSUFFICIENT",
        `orbital quorum signatures ${signatures.length} below minimum ${this.policy.minOrbitalQuorum}`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = "accredited";
    pool.collisionAccreditationCompletedAt = now;
    const completionId =
      request.completionId ||
      `completion-${crypto.randomBytes(4).toString("hex")}`;
    const completion = {
      completionId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      completedAt: now,
    };
    if (this._audit) {
      this._audit("COLLISION_ACCREDITATION_COMPLETED", { ...completion });
    }
    return completion;
  }

  /**
   * Get the current pool count.
   * @returns {number}
   */
  getPoolCount() {
    return this._pools.size;
  }
}

function _validateInitRequest(policy, request) {
  if (!request.sourceTenantId || !request.targetChainId) {
    throw new HsmAdapterError(
      "ORBIGATE_FIELDS_MISSING",
      "sourceTenantId and targetChainId are required",
    );
  }
  if (
    !request.blindedDebrisTrajectoryCommitment ||
    !request.blindedCollisionProbabilityCommitment ||
    !request.blindedSurveillanceAuthorityIdentityCommitment
  ) {
    throw new HsmAdapterError(
      "ORBIGATE_FIELDS_MISSING",
      "blindedDebrisTrajectoryCommitment, blindedCollisionProbabilityCommitment, and blindedSurveillanceAuthorityIdentityCommitment are required",
    );
  }
  if (typeof request.collisionWindowSeconds !== "number") {
    throw new HsmAdapterError(
      "ORBIGATE_FIELDS_MISSING",
      "collisionWindowSeconds is required",
    );
  }
  if (typeof request.trackingChainDepth !== "number") {
    throw new HsmAdapterError(
      "ORBIGATE_FIELDS_MISSING",
      "trackingChainDepth is required",
    );
  }
  if (
    policy.requireSpaceSurveillanceAuthorityInitializerAttestation &&
    !request.spaceSurveillanceAuthorityInitializerAttestation
  ) {
    throw new HsmAdapterError(
      "ORBIGATE_AUTHORITY_ATTESTATION_MISSING",
      "space surveillance authority initializer attestation is required",
    );
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError(
      "ORBIGATE_COMPLETE_FIELDS_MISSING",
      "poolId is required",
    );
  }
  if (
    policy.requireOrbitalDebrisOversightCommitteeAttestation &&
    !request.orbitalDebrisOversightCommitteeAttestation
  ) {
    throw new HsmAdapterError(
      "ORBIGATE_OVERSIGHT_ATTESTATION_MISSING",
      "orbital debris oversight committee attestation is required",
    );
  }
}

module.exports = { PqcOrbitalDebrisTrackingGatingHub };
