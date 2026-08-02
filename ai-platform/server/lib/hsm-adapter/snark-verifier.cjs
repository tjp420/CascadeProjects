'use strict';

/**
 * Track 26: Lightweight zk-SNARK verifier simulation.
 *
 * Verifies a succinct proof produced by SnarkProver using only public
 * parameters and public signals. In a real system this would invoke a
 * pairing-friendly curve verification routine.
 *
 * @module hsm-adapter/snark-verifier
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

class SnarkVerifier {
  /**
   * @param {object} options
   * @param {object} options.publicParams - must match prover public params
   * @param {Array<string>} [options.allowedProvingSystems]
   * @param {Array<string>} [options.allowedFields]
   */
  constructor(options = {}) {
    this._publicParams = options.publicParams || {};
    this._allowedProvingSystems = options.allowedProvingSystems || ['groth16', 'plonk', 'stark'];
    this._allowedFields = options.allowedFields || ['bn254', 'bls12-381'];
  }

  /**
   * Verify a proof against public parameters and signals.
   * @param {{proof: string, publicSignals: object}} proofArtifact
   * @returns {boolean}
   */
  verify({ proof, publicSignals }) {
    if (!proof || typeof proof !== 'string') {
      throw new HsmAdapterError('INVALID_INPUT', 'proof is required');
    }
    if (!publicSignals || typeof publicSignals !== 'object') {
      throw new HsmAdapterError('INVALID_INPUT', 'publicSignals is required');
    }

    if (!this._allowedProvingSystems.includes(publicSignals.provingSystem)) {
      throw new HsmAdapterError('SNARK_PROVING_SYSTEM_REJECTED', `system ${publicSignals.provingSystem} is not allowed`);
    }
    const field = publicSignals.field || this._publicParams.field || 'bn254';
    if (!this._allowedFields.includes(field)) {
      throw new HsmAdapterError('SNARK_FIELD_REJECTED', `field ${field} is not allowed`);
    }

    const witnessCommitment = publicSignals.witnessCommitment || this._publicParams.witnessCommitment || '';
    const expected = _hashHex([
      this._publicParams.verificationKey || 'vk',
      JSON.stringify(publicSignals),
      witnessCommitment,
      publicSignals.provingSystem,
    ]);
    return proof === expected;
  }
}

module.exports = { SnarkVerifier };
