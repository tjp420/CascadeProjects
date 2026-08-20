"use strict";

/**
 * Track 96: PQC Polar Research Data Gating Hub.
 *
 * Interlocking Antarctic Treaty Secretariat authority endpoint
 * coordinator that instantiates multi-party polar research
 * verification pools using homomorphically split Pedersen commitments
 * over research data hashes, sensor telemetry digests, and
 * institution identity hashes. Parses POLARGATE packets, enforces
 * maxResearchChainDepth, and tracks state transitions alongside the
 * minPolarQuorum boundary.
 *
 * @module hsm-adapter/pqc-polar-research-data-gating-hub
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

class PqcPolarResearchDataGatingHub {
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
   * Initialize a polar research data verification gating pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (
      this.policy.requireAntarcticTreatySecretariatInitializerAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.antarcticTreatySecretariatInitializerAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "POLARGATE_AUTHORITY_INITIALIZER_UNATTESTED",
            "Antarctic Treaty Secretariat initializer attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "POLARGATE_AUTHORITY_INITIALIZER_UNATTESTED",
          "Antarctic Treaty Secretariat initializer attestation invalid",
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
        "POLARGATE_ATTESTATION_AUTHORITY_BLOCKED",
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
        "POLARGATE_PQC_SCHEME_BLOCKED",
        `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(", ")}`,
      );
    }
    if (
      typeof request.dataRetentionWindowSeconds === "number" &&
      request.dataRetentionWindowSeconds >
        (this.policy.maxDataRetentionWindowSeconds || 7776000)
    ) {
      throw new HsmAdapterError(
        "POLARGATE_DATA_WINDOW_EXCEEDED",
        `data retention window seconds ${request.dataRetentionWindowSeconds} exceeds maximum ${this.policy.maxDataRetentionWindowSeconds}`,
      );
    }
    if (
      typeof request.researchChainDepth === "number" &&
      request.researchChainDepth > (this.policy.maxResearchChainDepth || 14)
    ) {
      throw new HsmAdapterError(
        "POLARGATE_RESEARCH_DEPTH_EXCEEDED",
        `research chain depth ${request.researchChainDepth} exceeds maximum ${this.policy.maxResearchChainDepth}`,
      );
    }
    const poolId =
      request.poolId || `pool-${crypto.randomBytes(4).toString("hex")}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError(
        "POLARGATE_DUPLICATE",
        `pool ${poolId} already exists`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedResearchDataCommitment: request.blindedResearchDataCommitment,
      blindedSensorTelemetryCommitment:
        request.blindedSensorTelemetryCommitment,
      blindedInstitutionIdentityCommitment:
        request.blindedInstitutionIdentityCommitment,
      dataRetentionWindowSeconds: request.dataRetentionWindowSeconds,
      researchChainDepth: request.researchChainDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: "open",
      researchClaimVerified: false,
      dataAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit("POLAR_RESEARCH_POOL_INITIALIZED", { ...pool });
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
   * Mark a pool as research-claim-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markResearchClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "POLARGATE_NOT_FOUND",
        `pool ${poolId} not found`,
      );
    }
    pool.researchClaimVerified = true;
    return pool;
  }

  /**
   * Complete data accreditation after quorum.
   * @param {object} request
   * @returns {object}
   */
  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "POLARGATE_NOT_FOUND",
        `pool ${request.poolId} not found`,
      );
    }
    if (!pool.researchClaimVerified) {
      throw new HsmAdapterError(
        "POLARGATE_RESEARCH_CLAIM_NOT_VERIFIED",
        `pool ${request.poolId} research claim not verified`,
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
            "POLARGATE_OVERSIGHT_COMMITTEE_UNATTESTED",
            "polar research oversight committee attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "POLARGATE_OVERSIGHT_COMMITTEE_UNATTESTED",
          "polar research oversight committee attestation invalid",
        );
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minPolarQuorum || 5)) {
      throw new HsmAdapterError(
        "POLARGATE_QUORUM_INSUFFICIENT",
        `polar quorum signatures ${signatures.length} below minimum ${this.policy.minPolarQuorum}`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = "accredited";
    pool.dataAccreditationCompletedAt = now;
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
      this._audit("DATA_ACCREDITATION_COMPLETED", { ...completion });
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
      "POLARGATE_FIELDS_MISSING",
      "sourceTenantId and targetChainId are required",
    );
  }
  if (
    !request.blindedResearchDataCommitment ||
    !request.blindedSensorTelemetryCommitment ||
    !request.blindedInstitutionIdentityCommitment
  ) {
    throw new HsmAdapterError(
      "POLARGATE_FIELDS_MISSING",
      "blindedResearchDataCommitment, blindedSensorTelemetryCommitment, and blindedInstitutionIdentityCommitment are required",
    );
  }
  if (typeof request.dataRetentionWindowSeconds !== "number") {
    throw new HsmAdapterError(
      "POLARGATE_FIELDS_MISSING",
      "dataRetentionWindowSeconds is required",
    );
  }
  if (typeof request.researchChainDepth !== "number") {
    throw new HsmAdapterError(
      "POLARGATE_FIELDS_MISSING",
      "researchChainDepth is required",
    );
  }
  if (
    policy.requireAntarcticTreatySecretariatInitializerAttestation &&
    !request.antarcticTreatySecretariatInitializerAttestation
  ) {
    throw new HsmAdapterError(
      "POLARGATE_AUTHORITY_ATTESTATION_MISSING",
      "Antarctic Treaty Secretariat initializer attestation is required",
    );
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError(
      "POLARGATE_COMPLETE_FIELDS_MISSING",
      "poolId is required",
    );
  }
  if (
    policy.requirePolarResearchOversightCommitteeAttestation &&
    !request.polarResearchOversightCommitteeAttestation
  ) {
    throw new HsmAdapterError(
      "POLARGATE_OVERSIGHT_ATTESTATION_MISSING",
      "polar research oversight committee attestation is required",
    );
  }
}

module.exports = { PqcPolarResearchDataGatingHub };
