'use strict';

/**
 * Track 26: Lightweight zk-SNARK prover simulation.
 *
 * Generates a succinct proof that an adapter configuration satisfies a set of
 * Track 14 policy constraints without revealing the sensitive policy values.
 * This is a pedagogical, hash-based simulation of a zk-SNARK prover; for
 * production workloads it would be replaced by a real proving backend.
 *
 * @module hsm-adapter/snark-prover
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

function _hashHex(inputs) {
  const h = crypto.createHash('sha256');
  for (const item of inputs) {
    h.update(typeof item === 'string' ? item : JSON.stringify(item));
  }
  return h.digest('hex');
}

class SnarkProver {
  /**
   * @param {object} options
   * @param {object} options.publicParams - public verification parameters
   * @param {string} [options.provingSystem] - e.g. 'groth16', 'plonk', 'stark'
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this._publicParams = options.publicParams || {};
    this._provingSystem = options.provingSystem || 'groth16';
    this._audit = options.audit || null;
  }

  /**
   * Evaluate policy constraints as a lightweight R1CS-like satisfaction check.
   * @param {object} witness - private adapter configuration
   * @param {object} publicInputs - values known to both prover and verifier
   * @param {Array<{name: string, predicate: Function}>} constraints
   * @returns {{proof: string, publicSignals: object}}
   */
  prove(witness, publicInputs, constraints = []) {
    if (!witness || typeof witness !== 'object') {
      throw new HsmAdapterError('INVALID_INPUT', 'witness must be an object');
    }
    if (!publicInputs || typeof publicInputs !== 'object') {
      throw new HsmAdapterError('INVALID_INPUT', 'publicInputs must be an object');
    }

    const failures = [];
    for (const c of constraints) {
      if (typeof c.predicate !== 'function') {
        throw new HsmAdapterError('INVALID_SNARK_CONSTRAINT', `constraint ${c.name} missing predicate`);
      }
      if (!c.predicate(witness, publicInputs)) {
        failures.push(c.name);
      }
    }
    if (failures.length > 0) {
      throw new HsmAdapterError('SNARK_CONSTRAINT_UNSATISFIED', `constraints failed: ${failures.join(', ')}`);
    }

    const witnessCommitment = _hashHex([JSON.stringify(witness), this._publicParams.salt || '']);
    const publicSignals = {
      ...publicInputs,
      provingSystem: this._provingSystem,
      field: this._publicParams.field || 'bn254',
      witnessCommitment,
    };
    const proof = _hashHex([
      this._publicParams.verificationKey || 'vk',
      JSON.stringify(publicSignals),
      witnessCommitment,
      this._provingSystem,
    ]);

    this._emitAudit('ZK_SUCCINCT_PROOF_GENERATED', {
      provingSystem: this._provingSystem,
      publicSignalCount: Object.keys(publicSignals).length,
      proofHash: proof,
    });

    return { proof, publicSignals };
  }

  _emitAudit(event, info) {
    if (this._audit) this._audit(event, { timestamp: Date.now(), ...info });
  }
}

module.exports = { SnarkProver };
