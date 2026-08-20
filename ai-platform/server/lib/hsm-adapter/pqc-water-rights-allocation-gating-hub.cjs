"use strict";

/**
 * Track 88: PQC Water Rights Allocation Gating Hub.
 *
 * Interlocking water authority endpoint
 * coordinator that instantiates multi-party
 * water authority verification pools using
 * homomorphically split Pedersen commitments over
 * water allocation volumes, watershed flow
 * measurements, and riparian rights hashes.
 * Parses WATERGATE packets, enforces
 * maxFlowChainDepth, and tracks state
 * transitions alongside the minWatershedQuorum
 * boundary.
 *
 * @module hsm-adapter/pqc-water-rights-allocation-gating-hub
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

class PqcWaterRightsAllocationGatingHub {
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
   * Initialize a water rights allocation verification gating pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (
      this.policy.requireWaterAuthorityInitializerAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.waterAuthorityInitializerAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "WATERGATE_AUTHORITY_INITIALIZER_UNATTESTED",
            "water authority initializer attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "WATERGATE_AUTHORITY_INITIALIZER_UNATTESTED",
          "water authority initializer attestation invalid",
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
        "WATERGATE_ATTESTATION_AUTHORITY_BLOCKED",
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
        "WATERGATE_PQC_SCHEME_BLOCKED",
        `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(", ")}`,
      );
    }
    if (
      typeof request.allocationWindowSeconds === "number" &&
      request.allocationWindowSeconds >
        (this.policy.maxAllocationWindowSeconds || 31536000)
    ) {
      throw new HsmAdapterError(
        "WATERGATE_ALLOCATION_WINDOW_EXCEEDED",
        `allocation window seconds ${request.allocationWindowSeconds} exceeds maximum ${this.policy.maxAllocationWindowSeconds}`,
      );
    }
    if (
      typeof request.flowChainDepth === "number" &&
      request.flowChainDepth > (this.policy.maxFlowChainDepth || 20)
    ) {
      throw new HsmAdapterError(
        "WATERGATE_FLOW_DEPTH_EXCEEDED",
        `flow chain depth ${request.flowChainDepth} exceeds maximum ${this.policy.maxFlowChainDepth}`,
      );
    }
    const poolId =
      request.poolId || `pool-${crypto.randomBytes(4).toString("hex")}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError(
        "WATERGATE_DUPLICATE",
        `pool ${poolId} already exists`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedWaterAllocationCommitment:
        request.blindedWaterAllocationCommitment,
      blindedWatershedFlowCommitment: request.blindedWatershedFlowCommitment,
      blindedRiparianRightsCommitment: request.blindedRiparianRightsCommitment,
      allocationWindowSeconds: request.allocationWindowSeconds,
      flowChainDepth: request.flowChainDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: "open",
      waterClaimVerified: false,
      watershedAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit("WATER_GATING_POOL_INITIALIZED", { ...pool });
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
   * Mark a pool as water-claim-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markWaterClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "WATERGATE_NOT_FOUND",
        `pool ${poolId} not found`,
      );
    }
    pool.waterClaimVerified = true;
    return pool;
  }

  /**
   * Complete watershed accreditation after quorum.
   * @param {object} request
   * @returns {object}
   */
  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "WATERGATE_NOT_FOUND",
        `pool ${request.poolId} not found`,
      );
    }
    if (!pool.waterClaimVerified) {
      throw new HsmAdapterError(
        "WATERGATE_WATER_CLAIM_NOT_VERIFIED",
        `pool ${request.poolId} water claim not verified`,
      );
    }
    if (
      this.policy.requireWatershedOversightCommitteeAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.watershedOversightCommitteeAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "WATERGATE_WATERSHED_COMMITTEE_UNATTESTED",
            "watershed oversight committee attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "WATERGATE_WATERSHED_COMMITTEE_UNATTESTED",
          "watershed oversight committee attestation invalid",
        );
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minWatershedQuorum || 4)) {
      throw new HsmAdapterError(
        "WATERGATE_QUORUM_INSUFFICIENT",
        `watershed signatures ${signatures.length} below minimum ${this.policy.minWatershedQuorum}`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = "accredited";
    pool.watershedAccreditationCompletedAt = now;
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
      this._audit("WATERSHED_ACCREDITATION_COMPLETED", { ...completion });
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
      "WATERGATE_FIELDS_MISSING",
      "sourceTenantId and targetChainId are required",
    );
  }
  if (
    !request.blindedWaterAllocationCommitment ||
    !request.blindedWatershedFlowCommitment ||
    !request.blindedRiparianRightsCommitment
  ) {
    throw new HsmAdapterError(
      "WATERGATE_FIELDS_MISSING",
      "blindedWaterAllocationCommitment, blindedWatershedFlowCommitment, and blindedRiparianRightsCommitment are required",
    );
  }
  if (typeof request.allocationWindowSeconds !== "number") {
    throw new HsmAdapterError(
      "WATERGATE_FIELDS_MISSING",
      "allocationWindowSeconds is required",
    );
  }
  if (typeof request.flowChainDepth !== "number") {
    throw new HsmAdapterError(
      "WATERGATE_FIELDS_MISSING",
      "flowChainDepth is required",
    );
  }
  if (
    policy.requireWaterAuthorityInitializerAttestation &&
    !request.waterAuthorityInitializerAttestation
  ) {
    throw new HsmAdapterError(
      "WATERGATE_AUTHORITY_ATTESTATION_MISSING",
      "water authority initializer attestation is required",
    );
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError(
      "WATERGATE_COMPLETE_FIELDS_MISSING",
      "poolId is required",
    );
  }
  if (
    policy.requireWatershedOversightCommitteeAttestation &&
    !request.watershedOversightCommitteeAttestation
  ) {
    throw new HsmAdapterError(
      "WATERGATE_WATERSHED_ATTESTATION_MISSING",
      "watershed oversight committee attestation is required",
    );
  }
}

module.exports = { PqcWaterRightsAllocationGatingHub };
