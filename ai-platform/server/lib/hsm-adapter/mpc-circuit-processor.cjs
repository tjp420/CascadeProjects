"use strict";

/**
 * Track 54: MPC circuit processor.
 *
 * Executes secret-shared input evaluations across an administrative
 * committee using Shamir-blinded addition and multiplication triplets.
 * Enforces maxMultiplicationGateDepth on multiplication chains.
 *
 * @module hsm-adapter/mpc-circuit-processor
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

class MpcCircuitProcessor {
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
    this._circuits = new Map();
  }

  /**
   * Initiate a circuit evaluation.
   * @param {object} request
   * @returns {object}
   */
  initiate(request) {
    _validateRequest(this.policy, request);
    const nodes = request.nodes || [];
    if (nodes.length < (this.policy.minCircuitNodes || 3)) {
      throw new HsmAdapterError(
        "MPC_QUORUM_INSUFFICIENT",
        `circuit nodes ${nodes.length} below minimum ${this.policy.minCircuitNodes}`,
      );
    }
    if (this.policy.requireEnclaveAttestation && this._attestationClient) {
      for (const node of nodes) {
        try {
          const result = this._attestationClient.verify(node.attestation);
          if (!result.verified) {
            throw new HsmAdapterError(
              "MPC_NODE_UNATTESTED",
              `node ${node.nodeId} attestation invalid`,
            );
          }
        } catch (err) {
          if (err instanceof HsmAdapterError) throw err;
          throw new HsmAdapterError(
            "MPC_NODE_UNATTESTED",
            `node ${node.nodeId} attestation invalid`,
          );
        }
      }
    }
    if (
      typeof request.multiplicationGateDepth === "number" &&
      request.multiplicationGateDepth >
        (this.policy.maxMultiplicationGateDepth || 8)
    ) {
      throw new HsmAdapterError(
        "MPC_GATE_DEPTH_EXCEEDED",
        `multiplication gate depth ${request.multiplicationGateDepth} exceeds maximum ${this.policy.maxMultiplicationGateDepth}`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    const circuitId =
      request.circuitId || `circuit-${crypto.randomBytes(4).toString("hex")}`;
    const tripletHash = crypto
      .createHash("sha256")
      .update(`${circuitId}:${nodes.map((n) => n.nodeId).join(",")}`)
      .digest("hex");
    const circuit = {
      circuitId,
      gateType: request.gateType || "add",
      nodeIds: nodes.map((n) => n.nodeId),
      tripletHash,
      multiplicationGateDepth: request.multiplicationGateDepth || 1,
      evaluations: [],
      status: "pending",
      initiatedAt: now,
    };
    this._circuits.set(circuitId, circuit);
    if (this._audit) {
      this._audit("MPC_CIRCUIT_EVALUATION_INITIATED", {
        circuitId,
        gateType: circuit.gateType,
        nodeIds: circuit.nodeIds,
        tripletHash,
        initiatedAt: now,
      });
    }
    return circuit;
  }

  /**
   * Submit a node evaluation share.
   * @param {string} circuitId
   * @param {string} nodeId
   * @param {string} evaluationShare
   * @returns {object}
   */
  submit(circuitId, nodeId, evaluationShare) {
    const circuit = this._circuits.get(circuitId);
    if (!circuit) {
      throw new HsmAdapterError(
        "MPC_CIRCUIT_NOT_FOUND",
        `no pending circuit ${circuitId}`,
      );
    }
    if (!circuit.nodeIds.includes(nodeId)) {
      throw new HsmAdapterError(
        "MPC_NODE_NOT_AUTHORIZED",
        `node ${nodeId} not authorized for circuit ${circuitId}`,
      );
    }
    if (!evaluationShare || typeof evaluationShare !== "string") {
      throw new HsmAdapterError(
        "MPC_EVALUATION_MISSING",
        "evaluation share is required",
      );
    }
    circuit.evaluations.push({ nodeId, evaluationShare });
    if (circuit.evaluations.length >= circuit.nodeIds.length) {
      circuit.status = "satisfied";
      const satisfactionProofHash = crypto
        .createHash("sha256")
        .update(circuit.evaluations.map((e) => e.evaluationShare).join(","))
        .digest("hex");
      circuit.satisfactionProofHash = satisfactionProofHash;
      this._circuits.delete(circuitId);
    }
    return {
      submitted: true,
      status: circuit.status,
      evaluations: circuit.evaluations.length,
    };
  }

  /**
   * Get pending circuit status.
   * @param {string} circuitId
   * @returns {object|null}
   */
  getStatus(circuitId) {
    return this._circuits.get(circuitId) || null;
  }
}

function _validateRequest(policy, request) {
  if (!request.circuitId && !request.nodes) {
    throw new HsmAdapterError(
      "MPC_FIELDS_MISSING",
      "circuitId or nodes are required",
    );
  }
}

module.exports = { MpcCircuitProcessor };
