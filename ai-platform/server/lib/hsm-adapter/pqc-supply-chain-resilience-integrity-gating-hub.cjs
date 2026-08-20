"use strict";

/**
 * Track 103: PQC Supply Chain Resilience Integrity Gating Hub.
 *
 * Interlocking supply chain resilience authority endpoint coordinator
 * that instantiates multi-party supply chain resilience verification
 * pools using homomorphically split Pedersen commitments over
 * disruption prediction hashes, supplier diversity digests, and supply
 * chain resilience authority identity hashes. Parses RESILIOGATE
 * packets, enforces maxResilienceChainDepth, and tracks state
 * transitions alongside the minResilienceQuorum boundary.
 *
 * @module hsm-adapter/pqc-supply-chain-resilience-integrity-gating-hub
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

class PqcSupplyChainResilienceIntegrityGatingHub {
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._pools = new Map();
  }

  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (
      this.policy.requireSupplyChainResilienceAuthorityInitializerAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.supplyChainResilienceAuthorityInitializerAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "RESILIOGATE_AUTHORITY_INITIALIZER_UNATTESTED",
            "supply chain resilience authority initializer attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "RESILIOGATE_AUTHORITY_INITIALIZER_UNATTESTED",
          "supply chain resilience authority initializer attestation invalid",
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
        "RESILIOGATE_ATTESTATION_AUTHORITY_BLOCKED",
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
        "RESILIOGATE_PQC_SCHEME_BLOCKED",
        `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(", ")}`,
      );
    }
    if (
      typeof request.resilienceWindowSeconds === "number" &&
      request.resilienceWindowSeconds >
        (this.policy.maxResilienceWindowSeconds || 172800)
    ) {
      throw new HsmAdapterError(
        "RESILIOGATE_RESILIENCE_WINDOW_EXCEEDED",
        `resilience window seconds ${request.resilienceWindowSeconds} exceeds maximum ${this.policy.maxResilienceWindowSeconds}`,
      );
    }
    if (
      typeof request.resilienceChainDepth === "number" &&
      request.resilienceChainDepth > (this.policy.maxResilienceChainDepth || 28)
    ) {
      throw new HsmAdapterError(
        "RESILIOGATE_RESILIENCE_DEPTH_EXCEEDED",
        `resilience chain depth ${request.resilienceChainDepth} exceeds maximum ${this.policy.maxResilienceChainDepth}`,
      );
    }
    const poolId =
      request.poolId || `pool-${crypto.randomBytes(4).toString("hex")}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError(
        "RESILIOGATE_DUPLICATE",
        `pool ${poolId} already exists`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedDisruptionPredictionCommitment:
        request.blindedDisruptionPredictionCommitment,
      blindedSupplierDiversityCommitment:
        request.blindedSupplierDiversityCommitment,
      blindedSupplyChainResilienceAuthorityIdentityCommitment:
        request.blindedSupplyChainResilienceAuthorityIdentityCommitment,
      resilienceWindowSeconds: request.resilienceWindowSeconds,
      resilienceChainDepth: request.resilienceChainDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: "open",
      resilienceClaimVerified: false,
      resilienceAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit("SUPPLY_CHAIN_RESILIENCE_POOL_INITIALIZED", { ...pool });
    }
    return pool;
  }

  getPool(poolId) {
    return this._pools.get(poolId) || null;
  }

  markResilienceClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "RESILIOGATE_NOT_FOUND",
        `pool ${poolId} not found`,
      );
    }
    pool.resilienceClaimVerified = true;
    return pool;
  }

  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "RESILIOGATE_NOT_FOUND",
        `pool ${request.poolId} not found`,
      );
    }
    if (!pool.resilienceClaimVerified) {
      throw new HsmAdapterError(
        "RESILIOGATE_RESILIENCE_CLAIM_NOT_VERIFIED",
        `pool ${request.poolId} resilience claim not verified`,
      );
    }
    if (
      this.policy.requireSupplyChainEthicsOversightCommitteeAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.supplyChainEthicsOversightCommitteeAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "RESILIOGATE_OVERSIGHT_COMMITTEE_UNATTESTED",
            "supply chain ethics oversight committee attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "RESILIOGATE_OVERSIGHT_COMMITTEE_UNATTESTED",
          "supply chain ethics oversight committee attestation invalid",
        );
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minResilienceQuorum || 10)) {
      throw new HsmAdapterError(
        "RESILIOGATE_QUORUM_INSUFFICIENT",
        `resilience quorum signatures ${signatures.length} below minimum ${this.policy.minResilienceQuorum}`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = "accredited";
    pool.resilienceAccreditationCompletedAt = now;
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
      this._audit("RESILIENCE_ACCREDITATION_COMPLETED", { ...completion });
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
      "RESILIOGATE_FIELDS_MISSING",
      "sourceTenantId and targetChainId are required",
    );
  }
  if (
    !request.blindedDisruptionPredictionCommitment ||
    !request.blindedSupplierDiversityCommitment ||
    !request.blindedSupplyChainResilienceAuthorityIdentityCommitment
  ) {
    throw new HsmAdapterError(
      "RESILIOGATE_FIELDS_MISSING",
      "blindedDisruptionPredictionCommitment, blindedSupplierDiversityCommitment, and blindedSupplyChainResilienceAuthorityIdentityCommitment are required",
    );
  }
  if (typeof request.resilienceWindowSeconds !== "number") {
    throw new HsmAdapterError(
      "RESILIOGATE_FIELDS_MISSING",
      "resilienceWindowSeconds is required",
    );
  }
  if (typeof request.resilienceChainDepth !== "number") {
    throw new HsmAdapterError(
      "RESILIOGATE_FIELDS_MISSING",
      "resilienceChainDepth is required",
    );
  }
  if (
    policy.requireSupplyChainResilienceAuthorityInitializerAttestation &&
    !request.supplyChainResilienceAuthorityInitializerAttestation
  ) {
    throw new HsmAdapterError(
      "RESILIOGATE_AUTHORITY_ATTESTATION_MISSING",
      "supply chain resilience authority initializer attestation is required",
    );
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError(
      "RESILIOGATE_COMPLETE_FIELDS_MISSING",
      "poolId is required",
    );
  }
  if (
    policy.requireSupplyChainEthicsOversightCommitteeAttestation &&
    !request.supplyChainEthicsOversightCommitteeAttestation
  ) {
    throw new HsmAdapterError(
      "RESILIOGATE_OVERSIGHT_ATTESTATION_MISSING",
      "supply chain ethics oversight committee attestation is required",
    );
  }
}

module.exports = { PqcSupplyChainResilienceIntegrityGatingHub };
