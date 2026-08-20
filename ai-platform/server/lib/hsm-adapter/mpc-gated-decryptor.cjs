"use strict";

/**
 * Track 54: MPC gated decryptor.
 *
 * Intercepts the Track 41 HardwareEnclaveAdapter unsealing loop and
 * blocks decryption unless a valid, committee-verified circuit
 * satisfaction proof is presented.
 *
 * @module hsm-adapter/mpc-gated-decryptor
 */

const { HsmAdapterError } = require("./base-adapter.cjs");

class MpcGatedDecryptor {
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
  }

  /**
   * Attempt to unseal a key, gated by circuit satisfaction proof.
   * @param {object} request
   * @returns {object}
   */
  unseal(request) {
    _validateUnsealRequest(this.policy, request);
    if (this.policy.requireEnclaveAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(
          request.enclaveAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "MPC_ENCLAVE_UNATTESTED",
            "enclave attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "MPC_ENCLAVE_UNATTESTED",
          "enclave attestation invalid",
        );
      }
    }
    if (
      this.policy.requireCircuitSatisfactionProof &&
      !request.circuitSatisfactionProof
    ) {
      throw new HsmAdapterError(
        "MPC_PROOF_MISSING",
        "circuit satisfaction proof is required",
      );
    }
    if (!request.circuit || request.circuit.status !== "satisfied") {
      throw new HsmAdapterError(
        "MPC_CIRCUIT_NOT_SATISFIED",
        "circuit evaluation has not reached satisfaction",
      );
    }
    const now = Math.floor(Date.now() / 1000);
    const age = now - (request.circuit.initiatedAt || now);
    if (age > (this.policy.transactionTimeoutSeconds || 300)) {
      throw new HsmAdapterError(
        "MPC_TRANSACTION_EXPIRED",
        `transaction age ${age}s exceeds timeout ${this.policy.transactionTimeoutSeconds}s`,
      );
    }
    if (request.circuit.nodeIds.length < (this.policy.minCircuitNodes || 3)) {
      throw new HsmAdapterError(
        "MPC_QUORUM_INSUFFICIENT",
        `circuit nodes ${request.circuit.nodeIds.length} below minimum ${this.policy.minCircuitNodes}`,
      );
    }
    if (this._audit) {
      this._audit("MPC_DECRYPTION_GATE_UNLOCKED", {
        circuitId: request.circuit.circuitId,
        nodeIds: request.circuit.nodeIds,
        satisfactionProofHash: request.circuit.satisfactionProofHash,
        unsealedAt: now,
      });
    }
    return { unsealed: true, circuitId: request.circuit.circuitId };
  }
}

function _validateUnsealRequest(policy, request) {
  if (!request.circuit) {
    throw new HsmAdapterError("MPC_FIELDS_MISSING", "circuit is required");
  }
  if (policy.requireEnclaveAttestation && !request.enclaveAttestation) {
    throw new HsmAdapterError(
      "MPC_ENCLAVE_ATTESTATION_MISSING",
      "enclave attestation is required",
    );
  }
}

module.exports = { MpcGatedDecryptor };
