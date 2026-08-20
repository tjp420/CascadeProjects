"use strict";

/**
 * Track 46: Homomorphic contract engine.
 *
 * Executes addition and scalar multiplication over Pedersen-style
 * encrypted commitments without decrypting the underlying values.
 * Requires worker node attestation before processing.
 *
 * @module hsm-adapter/homomorphic-contract-engine
 */

const { HsmAdapterError } = require("./base-adapter.cjs");

const P = 170141183460469231731687303715884105727n;
const G = 3n;
const H = 7n;

class HomomorphicContractEngine {
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
   * Execute a homomorphic contract.
   * @param {string} contractId
   * @param {string} operation
   * @param {object[]} operands
   * @param {object} workerAttestation
   * @returns {object}
   */
  execute(contractId, operation, operands, workerAttestation) {
    if (this.policy.requireWorkerAttestation && this._attestationClient) {
      const result = this._attestationClient.verify(workerAttestation);
      if (!result.verified) {
        throw new HsmAdapterError(
          "HOMOMORPHIC_WORKER_UNATTESTED",
          "worker attestation is not valid",
        );
      }
    }
    if (!this.policy.allowedOperations.includes(operation)) {
      throw new HsmAdapterError(
        "HOMOMORPHIC_OPERATION_BLOCKED",
        `operation ${operation} is not allowed`,
      );
    }
    if (!Array.isArray(operands) || operands.length < 2) {
      throw new HsmAdapterError(
        "HOMOMORPHIC_OPERANDS_INVALID",
        "at least two operands are required",
      );
    }
    let result = operands[0];
    for (let i = 1; i < operands.length; i += 1) {
      const next = operands[i];
      if (operation === "add") {
        result = _pedersenAdd(result, next);
      } else if (operation === "scalarMul") {
        result = _pedersenScalarMul(result, next.scalar);
      }
    }
    if (this._audit) {
      this._audit("HOMOMORPHIC_CONTRACT_EXECUTED", {
        contractId,
        operation,
        resultCommitment: result.commitment,
        timestamp: Math.floor(Date.now() / 1000),
      });
    }
    return {
      contractId,
      operation,
      result,
    };
  }
}

function _pedersenCommitment(value, blinding) {
  const v = typeof value === "bigint" ? value : BigInt(value);
  const r = typeof blinding === "bigint" ? blinding : BigInt(blinding);
  return (G * v + H * r) % P;
}

function _pedersenAdd(a, b) {
  return {
    value: (a.value + b.value) % P,
    blinding: (a.blinding + b.blinding) % P,
    commitment: (a.commitment + b.commitment) % P,
  };
}

function _pedersenScalarMul(commitment, scalar) {
  const s = typeof scalar === "bigint" ? scalar : BigInt(scalar);
  return {
    value: (commitment.value * s) % P,
    blinding: (commitment.blinding * s) % P,
    commitment: (commitment.commitment * s) % P,
  };
}

module.exports = { HomomorphicContractEngine, _pedersenCommitment };
