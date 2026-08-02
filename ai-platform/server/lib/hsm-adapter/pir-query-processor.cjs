'use strict';

/**
 * Track 24: Homomorphic Private Information Retrieval (PIR) query processor.
 *
 * Computes a dot-product over a client-encrypted selection vector and a
 * plaintext data matrix. Each database row is multiplied by the encrypted
 * query bit and accumulated homomorphically, returning the selected row in
 * encrypted form without decrypting the query or the dataset.
 *
 * @module hsm-adapter/pir-query-processor
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

function _mod(a, m) {
  let r = a % m;
  if (r < 0n) {
    r += m;
  }
  return r;
}

/**
 * A small additively-homomorphic engine for unit tests and development.
 * It is **not** cryptographically secure; production should use a real
 * scheme such as Paillier or BFV, supplied via the `engine` option.
 */
class ModularHomomorphicEngine {
  /**
   * @param {object} options
   * @param {BigInt} options.secret
   * @param {BigInt} options.modulus
   */
  constructor(options = {}) {
    this._modulus = options.modulus || (2n ** 256n);
    this._secret = options.secret || _mod(_bufToBigInt(crypto.randomBytes(32)), this._modulus);
  }

  encrypt(plaintext) {
    return _mod(BigInt(plaintext) + this._secret, this._modulus);
  }

  decrypt(ciphertext) {
    return _mod(BigInt(ciphertext) - this._secret, this._modulus);
  }

  add(a, b) {
    // Enc(x) + Enc(y) = x + y + 2k; subtract k once to get Enc(x + y)
    return _mod(BigInt(a) + BigInt(b) - this._secret, this._modulus);
  }

  mulScalar(ciphertext, scalar) {
    const s = BigInt(scalar);
    const c = BigInt(ciphertext);
    // c * s = (x + k) * s = x*s + k*s; subtract (s-1)k to get Enc(x*s)
    return _mod(c * s - (s - 1n) * this._secret, this._modulus);
  }

  zero() {
    return this.encrypt(0);
  }
}

function _bufToBigInt(buf) {
  return BigInt('0x' + buf.toString('hex'));
}

class PirQueryProcessor {
  /**
   * @param {object} options
   * @param {object} [options.engine] - additively-homomorphic engine
   * @param {string} [options.tenantId]
   * @param {CryptoPolicyEngine} [options.policyEngine]
   * @param {Function} [options.audit] - (event, info) => void
   */
  constructor(options = {}) {
    this._engine = options.engine || new ModularHomomorphicEngine();
    this._tenantId = options.tenantId || null;
    this._policyEngine = options.policyEngine || null;
    this._audit = options.audit || null;
  }

  _emitAudit(extra = {}) {
    if (this._audit) {
      this._audit('PIR_QUERY_EXECUTED', {
        tenantId: this._tenantId,
        timestamp: Date.now(),
        ...extra,
      });
    }
  }

  _validatePirPolicy(rows, columns, bytes) {
    if (!this._policyEngine || !this._tenantId) {
      return;
    }
    this._policyEngine.validate(this._tenantId, 'pir', {
      rows,
      columns,
      querySizeBytes: bytes,
      scheme: 'modular',
    });
  }

  /**
   * Process a private information retrieval query.
   * @param {BigInt[]} queryVector - encrypted one-hot selection vector
   * @param {number[][]} dataMatrix - plaintext rows, each an array of column values
   * @returns {BigInt[]} encrypted result row
   */
  process(queryVector, dataMatrix) {
    if (!Array.isArray(queryVector) || !Array.isArray(dataMatrix)) {
      throw new HsmAdapterError('INVALID_INPUT', 'queryVector and dataMatrix must be arrays');
    }
    if (queryVector.length !== dataMatrix.length) {
      throw new HsmAdapterError('INVALID_INPUT', 'queryVector length must match dataMatrix row count');
    }
    if (queryVector.length === 0) {
      return [];
    }

    const columns = Array.isArray(dataMatrix[0]) ? dataMatrix[0].length : 1;
    const bytes = queryVector.length * 8;
    this._validatePirPolicy(queryVector.length, columns, bytes);

    const result = [];
    const colCount = columns;

    for (let col = 0; col < colCount; col += 1) {
      let acc = this._engine.zero();
      for (let row = 0; row < dataMatrix.length; row += 1) {
        const value = Array.isArray(dataMatrix[row]) ? dataMatrix[row][col] : dataMatrix[row];
        const product = this._engine.mulScalar(queryVector[row], value);
        acc = this._engine.add(acc, product);
      }
      result.push(acc);
    }

    this._emitAudit({ rows: dataMatrix.length, columns: colCount, querySizeBytes: bytes });
    return result;
  }
}

module.exports = {
  PirQueryProcessor,
  ModularHomomorphicEngine,
};
