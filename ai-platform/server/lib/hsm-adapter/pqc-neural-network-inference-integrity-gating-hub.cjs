"use strict";

/**
 * Track 101: PQC Neural Network Inference Integrity Gating Hub.
 *
 * Interlocking neural network authority endpoint coordinator
 * that instantiates multi-party neural network inference verification
 * pools using homomorphically split Pedersen commitments over
 * neural measurement hashes, inference probability digests, and
 * neural network authority identity hashes. Parses NEURGATE
 * packets, enforces maxInferenceChainDepth, and tracks state
 * transitions alongside the minNeuralQuorum boundary.
 *
 * @module hsm-adapter/pqc-neural-network-inference-integrity-gating-hub
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

class PqcNeuralNetworkInferenceIntegrityGatingHub {
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._pools = new Map();
  }

  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (
      this.policy.requireNeuralNetworkAuthorityInitializerAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.neuralNetworkAuthorityInitializerAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "NEURGATE_AUTHORITY_INITIALIZER_UNATTESTED",
            "neural network authority initializer attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "NEURGATE_AUTHORITY_INITIALIZER_UNATTESTED",
          "neural network authority initializer attestation invalid",
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
        "NEURGATE_ATTESTATION_AUTHORITY_BLOCKED",
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
        "NEURGATE_PQC_SCHEME_BLOCKED",
        `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(", ")}`,
      );
    }
    if (
      typeof request.inferenceWindowSeconds === "number" &&
      request.inferenceWindowSeconds >
        (this.policy.maxInferenceWindowSeconds || 604800)
    ) {
      throw new HsmAdapterError(
        "NEURGATE_INFERENCE_WINDOW_EXCEEDED",
        `inference window seconds ${request.inferenceWindowSeconds} exceeds maximum ${this.policy.maxInferenceWindowSeconds}`,
      );
    }
    if (
      typeof request.inferenceChainDepth === "number" &&
      request.inferenceChainDepth > (this.policy.maxInferenceChainDepth || 24)
    ) {
      throw new HsmAdapterError(
        "NEURGATE_INFERENCE_DEPTH_EXCEEDED",
        `inference chain depth ${request.inferenceChainDepth} exceeds maximum ${this.policy.maxInferenceChainDepth}`,
      );
    }
    const poolId =
      request.poolId || `pool-${crypto.randomBytes(4).toString("hex")}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError(
        "NEURGATE_DUPLICATE",
        `pool ${poolId} already exists`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedNeuralMeasurementCommitment:
        request.blindedNeuralMeasurementCommitment,
      blindedInferenceProbabilityCommitment:
        request.blindedInferenceProbabilityCommitment,
      blindedNeuralNetworkAuthorityIdentityCommitment:
        request.blindedNeuralNetworkAuthorityIdentityCommitment,
      inferenceWindowSeconds: request.inferenceWindowSeconds,
      inferenceChainDepth: request.inferenceChainDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: "open",
      neuralClaimVerified: false,
      inferenceAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit("NEURAL_INFERENCE_POOL_INITIALIZED", { ...pool });
    }
    return pool;
  }

  getPool(poolId) {
    return this._pools.get(poolId) || null;
  }

  markNeuralClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "NEURGATE_NOT_FOUND",
        `pool ${poolId} not found`,
      );
    }
    pool.neuralClaimVerified = true;
    return pool;
  }

  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "NEURGATE_NOT_FOUND",
        `pool ${request.poolId} not found`,
      );
    }
    if (!pool.neuralClaimVerified) {
      throw new HsmAdapterError(
        "NEURGATE_NEURAL_CLAIM_NOT_VERIFIED",
        `pool ${request.poolId} neural claim not verified`,
      );
    }
    if (
      this.policy.requireNeuralEthicsOversightCommitteeAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.neuralEthicsOversightCommitteeAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "NEURGATE_OVERSIGHT_COMMITTEE_UNATTESTED",
            "neural ethics oversight committee attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "NEURGATE_OVERSIGHT_COMMITTEE_UNATTESTED",
          "neural ethics oversight committee attestation invalid",
        );
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minNeuralQuorum || 8)) {
      throw new HsmAdapterError(
        "NEURGATE_QUORUM_INSUFFICIENT",
        `neural quorum signatures ${signatures.length} below minimum ${this.policy.minNeuralQuorum}`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = "accredited";
    pool.inferenceAccreditationCompletedAt = now;
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
      this._audit("INFERENCE_ACCREDITATION_COMPLETED", { ...completion });
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
      "NEURGATE_FIELDS_MISSING",
      "sourceTenantId and targetChainId are required",
    );
  }
  if (
    !request.blindedNeuralMeasurementCommitment ||
    !request.blindedInferenceProbabilityCommitment ||
    !request.blindedNeuralNetworkAuthorityIdentityCommitment
  ) {
    throw new HsmAdapterError(
      "NEURGATE_FIELDS_MISSING",
      "blindedNeuralMeasurementCommitment, blindedInferenceProbabilityCommitment, and blindedNeuralNetworkAuthorityIdentityCommitment are required",
    );
  }
  if (typeof request.inferenceWindowSeconds !== "number") {
    throw new HsmAdapterError(
      "NEURGATE_FIELDS_MISSING",
      "inferenceWindowSeconds is required",
    );
  }
  if (typeof request.inferenceChainDepth !== "number") {
    throw new HsmAdapterError(
      "NEURGATE_FIELDS_MISSING",
      "inferenceChainDepth is required",
    );
  }
  if (
    policy.requireNeuralNetworkAuthorityInitializerAttestation &&
    !request.neuralNetworkAuthorityInitializerAttestation
  ) {
    throw new HsmAdapterError(
      "NEURGATE_AUTHORITY_ATTESTATION_MISSING",
      "neural network authority initializer attestation is required",
    );
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError(
      "NEURGATE_COMPLETE_FIELDS_MISSING",
      "poolId is required",
    );
  }
  if (
    policy.requireNeuralEthicsOversightCommitteeAttestation &&
    !request.neuralEthicsOversightCommitteeAttestation
  ) {
    throw new HsmAdapterError(
      "NEURGATE_OVERSIGHT_ATTESTATION_MISSING",
      "neural ethics oversight committee attestation is required",
    );
  }
}

module.exports = { PqcNeuralNetworkInferenceIntegrityGatingHub };
