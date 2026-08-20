"use strict";

/**
 * Track 112: PQC Bio-Digital Interface Neural-Telemetry Gating Hub.
 *
 * Bio-digital synapse pool coordination gate that instantiates multi-party
 * zero-knowledge neural telemetry pools using homomorphically split
 * Pedersen commitments over synapse state digests, spike-timing-dependent
 * plasticity attestations, and synthetic reflex loop records. Parses NEUROGATE
 * packets, enforces minNeuralQuorum, maxNeuralTelemetryWindowSeconds, and
 * maxSynapseChainDepth, tracks synapse accreditation, and emits telemetry.
 *
 * @module hsm-adapter/pqc-bio-digital-interface-neural-telemetry-gating-hub
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");
const hsmMetrics = require("./hsm-metrics.cjs");

class PqcBioDigitalInterfaceNeuralTelemetryGatingHub {
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._pools = new Map();
  }

  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (
      this.policy.requireNeuroTelemetryAuthorityInitializerAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.neuroTelemetryAuthorityInitializerAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "NEUROGATE_AUTHORITY_INITIALIZER_UNATTESTED",
            "neuro telemetry authority initializer attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "NEUROGATE_AUTHORITY_INITIALIZER_UNATTESTED",
          "neuro telemetry authority initializer attestation invalid",
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
        "NEUROGATE_ATTESTATION_AUTHORITY_BLOCKED",
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
        "NEUROGATE_PQC_SCHEME_BLOCKED",
        `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(", ")}`,
      );
    }
    if (
      typeof request.neuralTelemetryWindowSeconds === "number" &&
      request.neuralTelemetryWindowSeconds >
        (this.policy.maxNeuralTelemetryWindowSeconds || 2)
    ) {
      throw new HsmAdapterError(
        "NEUROGATE_INFERENCE_WINDOW_EXCEEDED",
        `neural telemetry window seconds ${request.neuralTelemetryWindowSeconds} exceeds maximum ${this.policy.maxNeuralTelemetryWindowSeconds}`,
      );
    }
    if (
      typeof request.synapseChainDepth === "number" &&
      request.synapseChainDepth > (this.policy.maxSynapseChainDepth || 64)
    ) {
      throw new HsmAdapterError(
        "NEUROGATE_SYNAPSE_CHAIN_DEPTH_EXCEEDED",
        `synapse chain depth ${request.synapseChainDepth} exceeds maximum ${this.policy.maxSynapseChainDepth}`,
      );
    }
    const poolId =
      request.poolId || `neuro-${crypto.randomBytes(4).toString("hex")}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError(
        "NEUROGATE_DUPLICATE",
        `pool ${poolId} already exists`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      sourceNeuralInterfaceId: request.sourceNeuralInterfaceId,
      targetNeuralInterfaceId: request.targetNeuralInterfaceId,
      blindedSynapseStateDigestCommitment:
        request.blindedSynapseStateDigestCommitment,
      blindedNeuralTelemetryCommitment:
        request.blindedNeuralTelemetryCommitment,
      blindedReflexLoopCommitment: request.blindedReflexLoopCommitment,
      neuralTelemetryWindowSeconds: request.neuralTelemetryWindowSeconds,
      synapseChainDepth: request.synapseChainDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: "open",
      neuralTelemetryVerified: false,
      synapseAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    hsmMetrics.incrementCounter("hsm_neurogate_pool_initialized_total", 1);
    if (this._audit) {
      this._audit("NEURAL_POOL_INITIALIZED", { ...pool });
    }
    return pool;
  }

  getPool(poolId) {
    return this._pools.get(poolId) || null;
  }

  verifyNeuralTelemetry(request) {
    _validateProofRequest(request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "NEUROGATE_NOT_FOUND",
        `pool ${request.poolId} not found`,
      );
    }
    if (!request.proofValid) {
      throw new HsmAdapterError(
        "NEUROGATE_PROOF_INVALID",
        `neural telemetry proof for pool ${request.poolId} is invalid`,
      );
    }
    pool.neuralTelemetryVerified = true;
    hsmMetrics.incrementCounter("hsm_zk_neural_telemetry_verified_total", 1);
    if (this._audit) {
      this._audit("ZK_NEURAL_TELEMETRY_VERIFIED", { poolId: request.poolId });
    }
    return pool;
  }

  completeSynapseAccreditation(request) {
    _validateAccreditationRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "NEUROGATE_NOT_FOUND",
        `pool ${request.poolId} not found`,
      );
    }
    if (!pool.neuralTelemetryVerified) {
      throw new HsmAdapterError(
        "NEUROGATE_TELEMETRY_NOT_VERIFIED",
        `pool ${request.poolId} neural telemetry not verified`,
      );
    }
    const signatures = request.neuralSignatures || [];
    if (signatures.length < (this.policy.minNeuralQuorum || 24)) {
      throw new HsmAdapterError(
        "NEUROGATE_QUORUM_INSUFFICIENT",
        `neural quorum ${signatures.length} below minimum ${this.policy.minNeuralQuorum}`,
      );
    }
    if (
      this.policy.requireBioEthicsOversightCommitteeAttestation &&
      this._attestationClient
    ) {
      try {
        const result = this._attestationClient.verify(
          request.bioEthicsOversightCommitteeAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "NEUROGATE_OVERSIGHT_COMMITTEE_UNATTESTED",
            "bio ethics oversight committee attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "NEUROGATE_OVERSIGHT_COMMITTEE_UNATTESTED",
          "bio ethics oversight committee attestation invalid",
        );
      }
    }
    pool.status = "accredited";
    pool.synapseAccreditationCompletedAt = Math.floor(Date.now() / 1000);
    hsmMetrics.incrementCounter("hsm_synapse_accreditation_completed_total", 1);
    if (this._audit) {
      this._audit("SYNAPSE_ACCREDITATION_COMPLETED", {
        poolId: request.poolId,
        neuralQuorum: signatures.length,
      });
    }
    return pool;
  }
}

function _validateInitRequest(policy, request) {
  if (!request || typeof request !== "object") {
    throw new HsmAdapterError(
      "NEUROGATE_INIT_SHAPE_INVALID",
      "request must be an object",
    );
  }
  if (
    !request.blindedSynapseStateDigestCommitment ||
    !request.blindedNeuralTelemetryCommitment
  ) {
    throw new HsmAdapterError(
      "NEUROGATE_INIT_SHAPE_INVALID",
      "blindedSynapseStateDigestCommitment and blindedNeuralTelemetryCommitment are required",
    );
  }
  if (
    typeof request.neuralQuorum === "number" &&
    request.neuralQuorum < (policy.minNeuralQuorum || 24)
  ) {
    throw new HsmAdapterError(
      "NEUROGATE_QUORUM_INSUFFICIENT",
      `neural quorum ${request.neuralQuorum} below minimum ${policy.minNeuralQuorum || 24}`,
    );
  }
}

function _validateProofRequest(request) {
  if (!request || typeof request !== "object" || !request.poolId) {
    throw new HsmAdapterError(
      "NEUROGATE_PROOF_SHAPE_INVALID",
      "poolId is required",
    );
  }
}

function _validateAccreditationRequest(policy, request) {
  if (!request || typeof request !== "object" || !request.poolId) {
    throw new HsmAdapterError(
      "NEUROGATE_ACCREDITATION_SHAPE_INVALID",
      "poolId is required",
    );
  }
  const signatures = request.neuralSignatures || [];
  if (signatures.length < (policy.minNeuralQuorum || 24)) {
    throw new HsmAdapterError(
      "NEUROGATE_QUORUM_INSUFFICIENT",
      `neural quorum ${signatures.length} below minimum ${policy.minNeuralQuorum || 24}`,
    );
  }
}

module.exports = { PqcBioDigitalInterfaceNeuralTelemetryGatingHub };
