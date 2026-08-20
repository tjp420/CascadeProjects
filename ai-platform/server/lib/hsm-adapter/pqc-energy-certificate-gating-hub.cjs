"use strict";

/**
 * Track 75: PQC Energy Certificate Gating Hub.
 *
 * Interlocking renewable energy grid certificate verification
 * coordinator that instantiates multi-party grid operator
 * verification pools using homomorphically split Pedersen
 * commitments over renewable energy certificates (RECs),
 * grid consumption metrics, and producer identity hashes.
 * Parses ENERGYGATE packets, enforces maxProductionMetricDepth,
 * and tracks state transitions alongside the
 * minGridOperatorQuorum boundary.
 *
 * @module hsm-adapter/pqc-energy-certificate-gating-hub
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

class PqcEnergyCertificateGatingHub {
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
   * Initialize an energy certificate gating pool.
   * @param {object} request
   * @returns {object}
   */
  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (
      this.policy.requireGridOperatorInitializerAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.gridOperatorInitializerAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "ENERGYGATE_GRID_OPERATOR_INITIALIZER_UNATTESTED",
            "grid operator initializer attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "ENERGYGATE_GRID_OPERATOR_INITIALIZER_UNATTESTED",
          "grid operator initializer attestation invalid",
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
        "ENERGYGATE_ATTESTATION_AUTHORITY_BLOCKED",
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
        "ENERGYGATE_PQC_SCHEME_BLOCKED",
        `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(", ")}`,
      );
    }
    if (
      typeof request.certificateExpirationSeconds === "number" &&
      request.certificateExpirationSeconds >
        (this.policy.maxCertificateExpirationSeconds || 63072000)
    ) {
      throw new HsmAdapterError(
        "ENERGYGATE_CERTIFICATE_EXPIRATION_EXCEEDED",
        `certificate expiration seconds ${request.certificateExpirationSeconds} exceeds maximum ${this.policy.maxCertificateExpirationSeconds}`,
      );
    }
    if (
      typeof request.productionMetricDepth === "number" &&
      request.productionMetricDepth >
        (this.policy.maxProductionMetricDepth || 48)
    ) {
      throw new HsmAdapterError(
        "ENERGYGATE_PRODUCTION_METRIC_DEPTH_EXCEEDED",
        `production metric depth ${request.productionMetricDepth} exceeds maximum ${this.policy.maxProductionMetricDepth}`,
      );
    }
    const poolId =
      request.poolId || `pool-${crypto.randomBytes(4).toString("hex")}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError(
        "ENERGYGATE_DUPLICATE",
        `pool ${poolId} already exists`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedCertificateCommitment: request.blindedCertificateCommitment,
      blindedGridMetricCommitment: request.blindedGridMetricCommitment,
      blindedProducerHashCommitment: request.blindedProducerHashCommitment,
      certificateExpirationSeconds: request.certificateExpirationSeconds,
      productionMetricDepth: request.productionMetricDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: "open",
      energyClaimVerified: false,
      tradingAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit("ENERGY_GATING_POOL_INITIALIZED", { ...pool });
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
   * Mark a pool as energy-claim-verified.
   * @param {string} poolId
   * @returns {object}
   */
  markEnergyClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "ENERGYGATE_NOT_FOUND",
        `pool ${poolId} not found`,
      );
    }
    pool.energyClaimVerified = true;
    return pool;
  }

  /**
   * Complete certificate trading accreditation after quorum.
   * @param {object} request
   * @returns {object}
   */
  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "ENERGYGATE_NOT_FOUND",
        `pool ${request.poolId} not found`,
      );
    }
    if (!pool.energyClaimVerified) {
      throw new HsmAdapterError(
        "ENERGYGATE_ENERGY_CLAIM_NOT_VERIFIED",
        `pool ${request.poolId} energy claim not verified`,
      );
    }
    if (
      this.policy.requireClearingCommitteeAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.clearingCommitteeAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "ENERGYGATE_CLEARING_COMMITTEE_UNATTESTED",
            "clearing committee attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "ENERGYGATE_CLEARING_COMMITTEE_UNATTESTED",
          "clearing committee attestation invalid",
        );
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minGridOperatorQuorum || 3)) {
      throw new HsmAdapterError(
        "ENERGYGATE_GRID_OPERATOR_QUORUM_INSUFFICIENT",
        `grid operator signatures ${signatures.length} below minimum ${this.policy.minGridOperatorQuorum}`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = "accredited";
    pool.tradingAccreditationCompletedAt = now;
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
      this._audit("CERTIFICATE_TRADING_ACCREDITATION_COMPLETED", {
        ...completion,
      });
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
      "ENERGYGATE_FIELDS_MISSING",
      "sourceTenantId and targetChainId are required",
    );
  }
  if (
    !request.blindedCertificateCommitment ||
    !request.blindedGridMetricCommitment ||
    !request.blindedProducerHashCommitment
  ) {
    throw new HsmAdapterError(
      "ENERGYGATE_FIELDS_MISSING",
      "blindedCertificateCommitment, blindedGridMetricCommitment, and blindedProducerHashCommitment are required",
    );
  }
  if (typeof request.certificateExpirationSeconds !== "number") {
    throw new HsmAdapterError(
      "ENERGYGATE_FIELDS_MISSING",
      "certificateExpirationSeconds is required",
    );
  }
  if (typeof request.productionMetricDepth !== "number") {
    throw new HsmAdapterError(
      "ENERGYGATE_FIELDS_MISSING",
      "productionMetricDepth is required",
    );
  }
  if (
    policy.requireGridOperatorInitializerAttestation &&
    !request.gridOperatorInitializerAttestation
  ) {
    throw new HsmAdapterError(
      "ENERGYGATE_GRID_OPERATOR_INITIALIZER_ATTESTATION_MISSING",
      "grid operator initializer attestation is required",
    );
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError(
      "ENERGYGATE_COMPLETE_FIELDS_MISSING",
      "poolId is required",
    );
  }
  if (
    policy.requireClearingCommitteeAttestation &&
    !request.clearingCommitteeAttestation
  ) {
    throw new HsmAdapterError(
      "ENERGYGATE_CLEARING_ATTESTATION_MISSING",
      "clearing committee attestation is required",
    );
  }
}

module.exports = { PqcEnergyCertificateGatingHub };
