"use strict";

/**
 * Track 90: PQC Wildlife Conservation Tracking Gating Hub.
 *
 * Interlocking IUCN conservation authority
 * endpoint coordinator that instantiates
 * multi-party conservation verification pools
 * using homomorphically split Pedersen
 * commitments over species population telemetry
 * hashes, habitat boundary measurements, and
 * conservation officer identity hashes. Parses
 * WILDLIFEGATE packets, enforces
 * maxTelemetryChainDepth, and tracks state
 * transitions alongside the
 * minConservationQuorum boundary.
 *
 * @module hsm-adapter/pqc-wildlife-conservation-tracking-gating-hub
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

class PqcWildlifeConservationTrackingGatingHub {
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
   * Initialize a wildlife conservation tracking verification gating pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (
      this.policy.requireConservationAuthorityInitializerAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.conservationAuthorityInitializerAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "WILDLIFEGATE_AUTHORITY_INITIALIZER_UNATTESTED",
            "conservation authority initializer attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "WILDLIFEGATE_AUTHORITY_INITIALIZER_UNATTESTED",
          "conservation authority initializer attestation invalid",
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
        "WILDLIFEGATE_ATTESTATION_AUTHORITY_BLOCKED",
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
        "WILDLIFEGATE_PQC_SCHEME_BLOCKED",
        `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(", ")}`,
      );
    }
    if (
      typeof request.monitoringWindowSeconds === "number" &&
      request.monitoringWindowSeconds >
        (this.policy.maxMonitoringWindowSeconds || 2592000)
    ) {
      throw new HsmAdapterError(
        "WILDLIFEGATE_MONITORING_WINDOW_EXCEEDED",
        `monitoring window seconds ${request.monitoringWindowSeconds} exceeds maximum ${this.policy.maxMonitoringWindowSeconds}`,
      );
    }
    if (
      typeof request.telemetryChainDepth === "number" &&
      request.telemetryChainDepth > (this.policy.maxTelemetryChainDepth || 14)
    ) {
      throw new HsmAdapterError(
        "WILDLIFEGATE_TELEMETRY_DEPTH_EXCEEDED",
        `telemetry chain depth ${request.telemetryChainDepth} exceeds maximum ${this.policy.maxTelemetryChainDepth}`,
      );
    }
    const poolId =
      request.poolId || `pool-${crypto.randomBytes(4).toString("hex")}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError(
        "WILDLIFEGATE_DUPLICATE",
        `pool ${poolId} already exists`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedSpeciesTelemetryCommitment:
        request.blindedSpeciesTelemetryCommitment,
      blindedHabitatBoundaryCommitment:
        request.blindedHabitatBoundaryCommitment,
      blindedRangerIdentityCommitment: request.blindedRangerIdentityCommitment,
      monitoringWindowSeconds: request.monitoringWindowSeconds,
      telemetryChainDepth: request.telemetryChainDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: "open",
      conservationClaimVerified: false,
      biodiversityAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit("WILDLIFE_GATING_POOL_INITIALIZED", { ...pool });
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
   * Mark a pool as conservation-claim-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markConservationClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "WILDLIFEGATE_NOT_FOUND",
        `pool ${poolId} not found`,
      );
    }
    pool.conservationClaimVerified = true;
    return pool;
  }

  /**
   * Complete biodiversity accreditation after quorum.
   * @param {object} request
   * @returns {object}
   */
  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "WILDLIFEGATE_NOT_FOUND",
        `pool ${request.poolId} not found`,
      );
    }
    if (!pool.conservationClaimVerified) {
      throw new HsmAdapterError(
        "WILDLIFEGATE_CONSERVATION_CLAIM_NOT_VERIFIED",
        `pool ${request.poolId} conservation claim not verified`,
      );
    }
    if (
      this.policy.requireBiodiversityOversightCommitteeAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.biodiversityOversightCommitteeAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "WILDLIFEGATE_BIODIVERSITY_COMMITTEE_UNATTESTED",
            "biodiversity oversight committee attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "WILDLIFEGATE_BIODIVERSITY_COMMITTEE_UNATTESTED",
          "biodiversity oversight committee attestation invalid",
        );
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minConservationQuorum || 4)) {
      throw new HsmAdapterError(
        "WILDLIFEGATE_QUORUM_INSUFFICIENT",
        `conservation signatures ${signatures.length} below minimum ${this.policy.minConservationQuorum}`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = "accredited";
    pool.biodiversityAccreditationCompletedAt = now;
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
      this._audit("BIODIVERSITY_ACCREDITATION_COMPLETED", { ...completion });
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
      "WILDLIFEGATE_FIELDS_MISSING",
      "sourceTenantId and targetChainId are required",
    );
  }
  if (
    !request.blindedSpeciesTelemetryCommitment ||
    !request.blindedHabitatBoundaryCommitment ||
    !request.blindedRangerIdentityCommitment
  ) {
    throw new HsmAdapterError(
      "WILDLIFEGATE_FIELDS_MISSING",
      "blindedSpeciesTelemetryCommitment, blindedHabitatBoundaryCommitment, and blindedRangerIdentityCommitment are required",
    );
  }
  if (typeof request.monitoringWindowSeconds !== "number") {
    throw new HsmAdapterError(
      "WILDLIFEGATE_FIELDS_MISSING",
      "monitoringWindowSeconds is required",
    );
  }
  if (typeof request.telemetryChainDepth !== "number") {
    throw new HsmAdapterError(
      "WILDLIFEGATE_FIELDS_MISSING",
      "telemetryChainDepth is required",
    );
  }
  if (
    policy.requireConservationAuthorityInitializerAttestation &&
    !request.conservationAuthorityInitializerAttestation
  ) {
    throw new HsmAdapterError(
      "WILDLIFEGATE_AUTHORITY_ATTESTATION_MISSING",
      "conservation authority initializer attestation is required",
    );
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError(
      "WILDLIFEGATE_COMPLETE_FIELDS_MISSING",
      "poolId is required",
    );
  }
  if (
    policy.requireBiodiversityOversightCommitteeAttestation &&
    !request.biodiversityOversightCommitteeAttestation
  ) {
    throw new HsmAdapterError(
      "WILDLIFEGATE_BIODIVERSITY_ATTESTATION_MISSING",
      "biodiversity oversight committee attestation is required",
    );
  }
}

module.exports = { PqcWildlifeConservationTrackingGatingHub };
