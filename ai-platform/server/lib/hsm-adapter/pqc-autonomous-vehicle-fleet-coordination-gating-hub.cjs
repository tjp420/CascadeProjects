"use strict";

/**
 * Track 102: PQC Autonomous Vehicle Fleet Coordination Gating Hub.
 *
 * Interlocking autonomous mobility authority endpoint coordinator
 * that instantiates multi-party autonomous vehicle fleet coordination
 * verification pools using homomorphically split Pedersen commitments
 * over trajectory measurement hashes, coordination probability digests,
 * and autonomous mobility authority identity hashes. Parses AUTOGATE
 * packets, enforces maxCoordinationChainDepth, and tracks state
 * transitions alongside the minAutonomousQuorum boundary.
 *
 * @module hsm-adapter/pqc-autonomous-vehicle-fleet-coordination-gating-hub
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

class PqcAutonomousVehicleFleetCoordinationGatingHub {
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._pools = new Map();
  }

  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (
      this.policy.requireAutonomousMobilityAuthorityInitializerAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.autonomousMobilityAuthorityInitializerAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "AUTOGATE_AUTHORITY_INITIALIZER_UNATTESTED",
            "autonomous mobility authority initializer attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "AUTOGATE_AUTHORITY_INITIALIZER_UNATTESTED",
          "autonomous mobility authority initializer attestation invalid",
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
        "AUTOGATE_ATTESTATION_AUTHORITY_BLOCKED",
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
        "AUTOGATE_PQC_SCHEME_BLOCKED",
        `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(", ")}`,
      );
    }
    if (
      typeof request.coordinationWindowSeconds === "number" &&
      request.coordinationWindowSeconds >
        (this.policy.maxCoordinationWindowSeconds || 86400)
    ) {
      throw new HsmAdapterError(
        "AUTOGATE_COORDINATION_WINDOW_EXCEEDED",
        `coordination window seconds ${request.coordinationWindowSeconds} exceeds maximum ${this.policy.maxCoordinationWindowSeconds}`,
      );
    }
    if (
      typeof request.coordinationChainDepth === "number" &&
      request.coordinationChainDepth >
        (this.policy.maxCoordinationChainDepth || 26)
    ) {
      throw new HsmAdapterError(
        "AUTOGATE_COORDINATION_DEPTH_EXCEEDED",
        `coordination chain depth ${request.coordinationChainDepth} exceeds maximum ${this.policy.maxCoordinationChainDepth}`,
      );
    }
    const poolId =
      request.poolId || `pool-${crypto.randomBytes(4).toString("hex")}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError(
        "AUTOGATE_DUPLICATE",
        `pool ${poolId} already exists`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedTrajectoryMeasurementCommitment:
        request.blindedTrajectoryMeasurementCommitment,
      blindedCoordinationProbabilityCommitment:
        request.blindedCoordinationProbabilityCommitment,
      blindedAutonomousMobilityAuthorityIdentityCommitment:
        request.blindedAutonomousMobilityAuthorityIdentityCommitment,
      coordinationWindowSeconds: request.coordinationWindowSeconds,
      coordinationChainDepth: request.coordinationChainDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: "open",
      autonomousClaimVerified: false,
      coordinationAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit("AUTONOMOUS_COORDINATION_POOL_INITIALIZED", { ...pool });
    }
    return pool;
  }

  getPool(poolId) {
    return this._pools.get(poolId) || null;
  }

  markAutonomousClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "AUTOGATE_NOT_FOUND",
        `pool ${poolId} not found`,
      );
    }
    pool.autonomousClaimVerified = true;
    return pool;
  }

  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "AUTOGATE_NOT_FOUND",
        `pool ${request.poolId} not found`,
      );
    }
    if (!pool.autonomousClaimVerified) {
      throw new HsmAdapterError(
        "AUTOGATE_AUTONOMOUS_CLAIM_NOT_VERIFIED",
        `pool ${request.poolId} autonomous claim not verified`,
      );
    }
    if (
      this.policy.requireAutonomousEthicsOversightCommitteeAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.autonomousEthicsOversightCommitteeAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "AUTOGATE_OVERSIGHT_COMMITTEE_UNATTESTED",
            "autonomous ethics oversight committee attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "AUTOGATE_OVERSIGHT_COMMITTEE_UNATTESTED",
          "autonomous ethics oversight committee attestation invalid",
        );
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minAutonomousQuorum || 9)) {
      throw new HsmAdapterError(
        "AUTOGATE_QUORUM_INSUFFICIENT",
        `autonomous quorum signatures ${signatures.length} below minimum ${this.policy.minAutonomousQuorum}`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = "accredited";
    pool.coordinationAccreditationCompletedAt = now;
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
      this._audit("COORDINATION_ACCREDITATION_COMPLETED", { ...completion });
    }
    return completion;
  }

  getPoolCount() {
    return this._pools.size;
  }
}

function _validateInitRequest(policy, request) {
  if (!request.sourceTenantId || !request.targetChainId) {
    throw new HsmAdapterError(
      "AUTOGATE_FIELDS_MISSING",
      "sourceTenantId and targetChainId are required",
    );
  }
  if (
    !request.blindedTrajectoryMeasurementCommitment ||
    !request.blindedCoordinationProbabilityCommitment ||
    !request.blindedAutonomousMobilityAuthorityIdentityCommitment
  ) {
    throw new HsmAdapterError(
      "AUTOGATE_FIELDS_MISSING",
      "blindedTrajectoryMeasurementCommitment, blindedCoordinationProbabilityCommitment, and blindedAutonomousMobilityAuthorityIdentityCommitment are required",
    );
  }
  if (typeof request.coordinationWindowSeconds !== "number") {
    throw new HsmAdapterError(
      "AUTOGATE_FIELDS_MISSING",
      "coordinationWindowSeconds is required",
    );
  }
  if (typeof request.coordinationChainDepth !== "number") {
    throw new HsmAdapterError(
      "AUTOGATE_FIELDS_MISSING",
      "coordinationChainDepth is required",
    );
  }
  if (
    policy.requireAutonomousMobilityAuthorityInitializerAttestation &&
    !request.autonomousMobilityAuthorityInitializerAttestation
  ) {
    throw new HsmAdapterError(
      "AUTOGATE_AUTHORITY_ATTESTATION_MISSING",
      "autonomous mobility authority initializer attestation is required",
    );
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError(
      "AUTOGATE_COMPLETE_FIELDS_MISSING",
      "poolId is required",
    );
  }
  if (
    policy.requireAutonomousEthicsOversightCommitteeAttestation &&
    !request.autonomousEthicsOversightCommitteeAttestation
  ) {
    throw new HsmAdapterError(
      "AUTOGATE_OVERSIGHT_ATTESTATION_MISSING",
      "autonomous ethics oversight committee attestation is required",
    );
  }
}

module.exports = { PqcAutonomousVehicleFleetCoordinationGatingHub };
