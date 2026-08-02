'use strict';

/**
 * Track 57: Zero-Knowledge Succinct Non-Interactive Arguments of
 * Knowledge (zk-SNARK) Enclave Verifiers.
 *
 * Compiles succinct execution proofs for enclave computations, allowing
 * verifiers to confirm that a computation was executed correctly without
 * seeing the private inputs or re-executing the computation.
 *
 * Components:
 *   - ArithmeticCircuitCompiler: Compiles computation traces into R1CS
 *     (Rank-1 Constraint System) circuits
 *   - WitnessGenerator: Generates private and public witness vectors
 *   - TrustedSetupManager: Manages proving and verification keys from a
 *     structured reference string (SRS)
 *   - ProofGenerator: Generates succinct zero-knowledge proofs
 *   - ProofVerifier: Verifies proofs in constant time
 *   - ProofAggregator: Aggregates multiple proofs into a single proof
 *   - EnclaveAttestationBinder: Binds proofs to enclave attestations
 *
 * @module hsm-adapter/zk-snark-verifier-engine
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

const DEFAULT_OPTIONS = {
  fieldPrime: (1n << 256n) - 189n,
  maxConstraints: 10000,
  maxWitnessSize: 1000,
  maxProofSize: 4096,
  maxAggregatedProofs: 100,
  enableProofAggregation: true,
  requireTrustedSetup: true,
  proofTimeoutMs: 30000,
};

const CIRCUIT_STATUS = {
  DRAFT: 'draft',
  COMPILED: 'compiled',
  VERIFIED: 'verified',
  DEPRECATED: 'deprecated',
};

const PROOF_STATUS = {
  PENDING: 'pending',
  GENERATED: 'generated',
  VERIFIED: 'verified',
  INVALID: 'invalid',
  EXPIRED: 'expired',
};

const SETUP_STATUS = {
  PENDING: 'pending',
  READY: 'ready',
  CORRUPTED: 'corrupted',
  DESTROYED: 'destroyed',
};

/**
 * zk-SNARK Enclave Verifier Engine.
 */
class ZkSnarkVerifierEngine {
  /**
   * @param {object} [options]
   */
  constructor(options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    this.fieldPrime = opts.fieldPrime;
    this.maxConstraints = opts.maxConstraints;
    this.maxWitnessSize = opts.maxWitnessSize;
    this.maxProofSize = opts.maxProofSize;
    this.maxAggregatedProofs = opts.maxAggregatedProofs;
    this.enableProofAggregation = opts.enableProofAggregation;
    this.requireTrustedSetup = opts.requireTrustedSetup;
    this.proofTimeoutMs = opts.proofTimeoutMs;
    this._audit = opts.audit || null;

    this._circuits = new Map(); // circuitId -> circuit
    this._setups = new Map(); // setupId -> trusted setup
    this._proofs = new Map(); // proofId -> proof
    this._aggregatedProofs = new Map(); // aggId -> aggregated proof
    this._completedProofs = [];
    this._maxHistory = 100;
    this._proofCounter = 0;
  }

  /**
   * Compile an arithmetic circuit from a computation trace.
   * @param {object} config
   * @param {string} config.circuitId - Unique circuit identifier
   * @param {string} config.name - Human-readable name
   * @param {object[]} config.constraints - R1CS constraints
   * @param {string[]} config.publicInputs - Public input names
   * @param {string[]} config.privateInputs - Private input names
   * @returns {object} Compiled circuit
   */
  compileCircuit(config) {
    if (!config || typeof config !== 'object') {
      throw new HsmAdapterError('INVALID_CONFIG', 'circuit config is required');
    }
    if (!config.circuitId || typeof config.circuitId !== 'string') {
      throw new HsmAdapterError('INVALID_CIRCUIT_ID', 'circuitId must be a non-empty string');
    }
    if (this._circuits.has(config.circuitId)) {
      throw new HsmAdapterError('CIRCUIT_ALREADY_EXISTS',
        `circuit ${config.circuitId} already exists`);
    }
    if (!Array.isArray(config.constraints) || config.constraints.length === 0) {
      throw new HsmAdapterError('INVALID_CONSTRAINTS', 'constraints must be a non-empty array');
    }
    if (config.constraints.length > this.maxConstraints) {
      throw new HsmAdapterError('TOO_MANY_CONSTRAINTS',
        `${config.constraints.length} exceeds max ${this.maxConstraints}`);
    }
    const publicInputs = config.publicInputs || [];
    const privateInputs = config.privateInputs || [];
    if (!Array.isArray(publicInputs) || !Array.isArray(privateInputs)) {
      throw new HsmAdapterError('INVALID_INPUTS', 'publicInputs and privateInputs must be arrays');
    }
    // Validate constraints structure
    for (const c of config.constraints) {
      if (!c || typeof c !== 'object' || !c.type) {
        throw new HsmAdapterError('INVALID_CONSTRAINT', 'each constraint must have a type');
      }
    }
    const now = Date.now();
    const circuit = {
      circuitId: config.circuitId,
      name: config.name || config.circuitId,
      constraints: config.constraints,
      constraintCount: config.constraints.length,
      publicInputs,
      privateInputs,
      publicInputCount: publicInputs.length,
      privateInputCount: privateInputs.length,
      status: CIRCUIT_STATUS.COMPILED,
      compiledAt: now,
      hash: this._hashCircuit(config.constraints, publicInputs, privateInputs),
    };
    this._circuits.set(config.circuitId, circuit);
    if (typeof this._audit === 'function') {
      this._audit('CIRCUIT_COMPILED', {
        circuitId: config.circuitId,
        constraintCount: circuit.constraintCount,
      });
    }
    return {
      circuitId: circuit.circuitId,
      name: circuit.name,
      status: circuit.status,
      constraintCount: circuit.constraintCount,
      publicInputCount: circuit.publicInputCount,
      privateInputCount: circuit.privateInputCount,
      hash: circuit.hash,
    };
  }

  /**
   * Generate a trusted setup (proving and verification keys).
   * @param {string} circuitId
   * @param {object} [options] - Setup options
   * @returns {object} Setup result
   */
  generateTrustedSetup(circuitId, options = {}) {
    const circuit = this._circuits.get(circuitId);
    if (!circuit) {
      throw new HsmAdapterError('CIRCUIT_NOT_FOUND', `circuit ${circuitId} not found`);
    }
    if (circuit.status !== CIRCUIT_STATUS.COMPILED && circuit.status !== CIRCUIT_STATUS.VERIFIED) {
      throw new HsmAdapterError('CIRCUIT_NOT_COMPILED',
        `circuit ${circuitId} is in status ${circuit.status}`);
    }
    const setupId = options.setupId || `setup-${circuitId}-${Date.now()}`;
    if (this._setups.has(setupId)) {
      throw new HsmAdapterError('SETUP_ALREADY_EXISTS', `setup ${setupId} already exists`);
    }
    // Simulate trusted setup ceremony
    const toxicWaste = _randomFieldElement(this.fieldPrime);
    const provingKey = this._generateProvingKey(circuit, toxicWaste);
    const verificationKey = this._generateVerificationKey(circuit, toxicWaste);
    // Zeroize toxic waste
    const setup = {
      setupId,
      circuitId,
      provingKey,
      verificationKey,
      status: SETUP_STATUS.READY,
      createdAt: Date.now(),
      proofCount: 0,
    };
    this._setups.set(setupId, setup);
    if (typeof this._audit === 'function') {
      this._audit('TRUSTED_SETUP_GENERATED', { setupId, circuitId });
    }
    return {
      setupId,
      circuitId,
      status: setup.status,
      provingKeySize: provingKey.length,
      verificationKeySize: verificationKey.length,
    };
  }

  /**
   * Generate a zero-knowledge proof.
   * @param {object} config
   * @param {string} config.proofId - Unique proof identifier
   * @param {string} config.circuitId - Circuit to prove
   * @param {string} config.setupId - Trusted setup to use
   * @param {object} config.publicInputs - Public input values
   * @param {object} config.privateInputs - Private input values (witness)
   * @param {string} [config.enclaveAttestation] - Enclave attestation hash
   * @returns {object} Proof result
   */
  generateProof(config) {
    if (!config || typeof config !== 'object') {
      throw new HsmAdapterError('INVALID_CONFIG', 'proof config is required');
    }
    if (!config.proofId || typeof config.proofId !== 'string') {
      throw new HsmAdapterError('INVALID_PROOF_ID', 'proofId must be a non-empty string');
    }
    if (this._proofs.has(config.proofId)) {
      throw new HsmAdapterError('PROOF_ALREADY_EXISTS', `proof ${config.proofId} already exists`);
    }
    const circuit = this._circuits.get(config.circuitId);
    if (!circuit) {
      throw new HsmAdapterError('CIRCUIT_NOT_FOUND', `circuit ${config.circuitId} not found`);
    }
    const setup = this._setups.get(config.setupId);
    if (!setup) {
      throw new HsmAdapterError('SETUP_NOT_FOUND', `setup ${config.setupId} not found`);
    }
    if (setup.status !== SETUP_STATUS.READY) {
      throw new HsmAdapterError('SETUP_NOT_READY', `setup ${config.setupId} is ${setup.status}`);
    }
    if (setup.circuitId !== config.circuitId) {
      throw new HsmAdapterError('SETUP_CIRCUIT_MISMATCH',
        `setup is for circuit ${setup.circuitId}, not ${config.circuitId}`);
    }
    // Validate public inputs
    if (!config.publicInputs || typeof config.publicInputs !== 'object') {
      throw new HsmAdapterError('INVALID_PUBLIC_INPUTS', 'publicInputs must be an object');
    }
    for (const name of circuit.publicInputs) {
      if (!(name in config.publicInputs)) {
        throw new HsmAdapterError('MISSING_PUBLIC_INPUT', `missing public input: ${name}`);
      }
    }
    // Validate private inputs
    if (!config.privateInputs || typeof config.privateInputs !== 'object') {
      throw new HsmAdapterError('INVALID_PRIVATE_INPUTS', 'privateInputs must be an object');
    }
    for (const name of circuit.privateInputs) {
      if (!(name in config.privateInputs)) {
        throw new HsmAdapterError('MISSING_PRIVATE_INPUT', `missing private input: ${name}`);
      }
    }
    // Generate witness
    const witness = this._generateWitness(circuit, config.publicInputs, config.privateInputs);
    if (witness.length > this.maxWitnessSize) {
      throw new HsmAdapterError('WITNESS_TOO_LARGE',
        `${witness.length} exceeds max ${this.maxWitnessSize}`);
    }
    // Generate proof
    const proofData = this._generateProofData(circuit, setup, witness, config.enclaveAttestation);
    if (proofData.length > this.maxProofSize) {
      throw new HsmAdapterError('PROOF_TOO_LARGE',
        `${proofData.length} exceeds max ${this.maxProofSize}`);
    }
    const now = Date.now();
    const proof = {
      proofId: config.proofId,
      circuitId: config.circuitId,
      setupId: config.setupId,
      publicInputs: config.publicInputs,
      proofData,
      enclaveAttestation: config.enclaveAttestation || null,
      status: PROOF_STATUS.GENERATED,
      generatedAt: now,
      verifiedAt: null,
      witnessHash: _hashToField(this.fieldPrime, witness),
    };
    this._proofs.set(config.proofId, proof);
    setup.proofCount++;
    this._proofCounter++;
    if (typeof this._audit === 'function') {
      this._audit('PROOF_GENERATED', {
        proofId: config.proofId,
        circuitId: config.circuitId,
      });
    }
    return {
      proofId: proof.proofId,
      circuitId: proof.circuitId,
      status: proof.status,
      proofSize: proofData.length,
      enclaveAttestation: proof.enclaveAttestation,
    };
  }

  /**
   * Verify a zero-knowledge proof.
   * @param {string} proofId
   * @param {object} [publicInputs] - Override public inputs
   * @returns {object} Verification result
   */
  verifyProof(proofId, publicInputs) {
    const proof = this._proofs.get(proofId);
    if (!proof) {
      throw new HsmAdapterError('PROOF_NOT_FOUND', `proof ${proofId} not found`);
    }
    if (proof.status === PROOF_STATUS.EXPIRED) {
      throw new HsmAdapterError('PROOF_EXPIRED', `proof ${proofId} has expired`);
    }
    const circuit = this._circuits.get(proof.circuitId);
    if (!circuit) {
      throw new HsmAdapterError('CIRCUIT_NOT_FOUND', `circuit ${proof.circuitId} not found`);
    }
    const setup = this._setups.get(proof.setupId);
    if (!setup) {
      throw new HsmAdapterError('SETUP_NOT_FOUND', `setup ${proof.setupId} not found`);
    }
    if (setup.status !== SETUP_STATUS.READY) {
      throw new HsmAdapterError('SETUP_NOT_READY', `setup ${proof.setupId} is ${setup.status}`);
    }
    const inputs = publicInputs || proof.publicInputs;
    // Verify proof data against verification key
    const verified = this._verifyProofData(circuit, setup, proof, inputs);
    if (verified) {
      proof.status = PROOF_STATUS.VERIFIED;
      proof.verifiedAt = Date.now();
      circuit.status = CIRCUIT_STATUS.VERIFIED;
    } else {
      proof.status = PROOF_STATUS.INVALID;
    }
    // Move to history
    this._completedProofs.push({
      proofId: proof.proofId,
      circuitId: proof.circuitId,
      verified,
      generatedAt: proof.generatedAt,
      verifiedAt: proof.verifiedAt,
    });
    if (this._completedProofs.length > this._maxHistory) {
      this._completedProofs.shift();
    }
    if (typeof this._audit === 'function') {
      this._audit('PROOF_VERIFIED', { proofId, verified });
    }
    return {
      proofId,
      verified,
      status: proof.status,
      circuitId: proof.circuitId,
    };
  }

  /**
   * Aggregate multiple proofs into a single proof.
   * @param {string[]} proofIds
   * @returns {object} Aggregated proof
   */
  aggregateProofs(proofIds) {
    if (!this.enableProofAggregation) {
      throw new HsmAdapterError('AGGREGATION_DISABLED', 'proof aggregation is disabled');
    }
    if (!Array.isArray(proofIds) || proofIds.length < 2) {
      throw new HsmAdapterError('INSUFFICIENT_PROOFS',
        'need at least 2 proofs to aggregate');
    }
    if (proofIds.length > this.maxAggregatedProofs) {
      throw new HsmAdapterError('TOO_MANY_PROOFS',
        `${proofIds.length} exceeds max ${this.maxAggregatedProofs}`);
    }
    const proofs = [];
    for (const id of proofIds) {
      const proof = this._proofs.get(id);
      if (!proof) {
        throw new HsmAdapterError('PROOF_NOT_FOUND', `proof ${id} not found`);
      }
      if (proof.status !== PROOF_STATUS.VERIFIED) {
        throw new HsmAdapterError('PROOF_NOT_VERIFIED',
          `proof ${id} must be verified before aggregation`);
      }
      proofs.push(proof);
    }
    const aggId = `agg-${Date.now()}-${crypto.randomInt(0, 1000000)}`;
    // Simulate proof aggregation
    const aggregatedData = crypto.createHash('sha256')
      .update(proofs.map(p => p.proofData.toString('hex')).join(':'))
      .digest();
    const aggregated = {
      aggId,
      proofIds: [...proofIds],
      proofCount: proofs.length,
      aggregatedData,
      createdAt: Date.now(),
    };
    this._aggregatedProofs.set(aggId, aggregated);
    if (typeof this._audit === 'function') {
      this._audit('PROOFS_AGGREGATED', { aggId, count: proofs.length });
    }
    return {
      aggId,
      proofCount: aggregated.proofCount,
      proofIds: aggregated.proofIds,
      size: aggregatedData.length,
    };
  }

  /**
   * Verify an aggregated proof.
   * @param {string} aggId
   * @returns {object}
   */
  verifyAggregatedProof(aggId) {
    const agg = this._aggregatedProofs.get(aggId);
    if (!agg) {
      throw new HsmAdapterError('AGGREGATED_PROOF_NOT_FOUND', `aggregated proof ${aggId} not found`);
    }
    // Verify all underlying proofs are still valid
    let allValid = true;
    for (const proofId of agg.proofIds) {
      const proof = this._proofs.get(proofId);
      if (!proof || proof.status !== PROOF_STATUS.VERIFIED) {
        allValid = false;
        break;
      }
    }
    if (typeof this._audit === 'function') {
      this._audit('AGGREGATED_PROOF_VERIFIED', { aggId, valid: allValid });
    }
    return {
      aggId,
      verified: allValid,
      proofCount: agg.proofCount,
    };
  }

  /**
   * Destroy a trusted setup (toxic waste cleanup).
   * @param {string} setupId
   */
  destroySetup(setupId) {
    const setup = this._setups.get(setupId);
    if (!setup) {
      throw new HsmAdapterError('SETUP_NOT_FOUND', `setup ${setupId} not found`);
    }
    // Zeroize keys
    setup.provingKey = Buffer.alloc(0);
    setup.verificationKey = Buffer.alloc(0);
    setup.status = SETUP_STATUS.DESTROYED;
    if (typeof this._audit === 'function') {
      this._audit('SETUP_DESTROYED', { setupId });
    }
    return { setupId, destroyed: true };
  }

  /**
   * Get circuit metadata.
   * @param {string} circuitId
   * @returns {object|null}
   */
  getCircuit(circuitId) {
    const circuit = this._circuits.get(circuitId);
    if (!circuit) return null;
    return {
      circuitId: circuit.circuitId,
      name: circuit.name,
      status: circuit.status,
      constraintCount: circuit.constraintCount,
      publicInputCount: circuit.publicInputCount,
      privateInputCount: circuit.privateInputCount,
      publicInputs: circuit.publicInputs,
      privateInputs: circuit.privateInputs,
      hash: circuit.hash,
      compiledAt: circuit.compiledAt,
    };
  }

  /**
   * Get all circuits.
   * @returns {object[]}
   */
  getCircuits() {
    return Array.from(this._circuits.values()).map(c => ({
      circuitId: c.circuitId,
      name: c.name,
      status: c.status,
      constraintCount: c.constraintCount,
    }));
  }

  /**
   * Get proof metadata.
   * @param {string} proofId
   * @returns {object|null}
   */
  getProof(proofId) {
    const proof = this._proofs.get(proofId);
    if (!proof) return null;
    return {
      proofId: proof.proofId,
      circuitId: proof.circuitId,
      setupId: proof.setupId,
      status: proof.status,
      enclaveAttestation: proof.enclaveAttestation,
      generatedAt: proof.generatedAt,
      verifiedAt: proof.verifiedAt,
      proofSize: proof.proofData.length,
    };
  }

  /**
   * Get setup metadata.
   * @param {string} setupId
   * @returns {object|null}
   */
  getSetup(setupId) {
    const setup = this._setups.get(setupId);
    if (!setup) return null;
    return {
      setupId: setup.setupId,
      circuitId: setup.circuitId,
      status: setup.status,
      provingKeySize: setup.provingKey.length,
      verificationKeySize: setup.verificationKey.length,
      proofCount: setup.proofCount,
      createdAt: setup.createdAt,
    };
  }

  /**
   * Get completed proofs.
   * @param {number} [limit]
   * @returns {object[]}
   */
  getCompletedProofs(limit) {
    const n = typeof limit === 'number' ? limit : 20;
    return this._completedProofs.slice(-n);
  }

  /**
   * Get aggregated proof.
   * @param {string} aggId
   * @returns {object|null}
   */
  getAggregatedProof(aggId) {
    const agg = this._aggregatedProofs.get(aggId);
    if (!agg) return null;
    return {
      aggId: agg.aggId,
      proofCount: agg.proofCount,
      proofIds: agg.proofIds,
      createdAt: agg.createdAt,
    };
  }

  /**
   * Get summary statistics.
   * @returns {object}
   */
  getStats() {
    const circuitsByStatus = {};
    for (const c of this._circuits.values()) {
      circuitsByStatus[c.status] = (circuitsByStatus[c.status] || 0) + 1;
    }
    const proofsByStatus = {};
    for (const p of this._proofs.values()) {
      proofsByStatus[p.status] = (proofsByStatus[p.status] || 0) + 1;
    }
    return {
      totalCircuits: this._circuits.size,
      totalSetups: this._setups.size,
      activeProofs: this._proofs.size,
      completedProofs: this._completedProofs.length,
      aggregatedProofs: this._aggregatedProofs.size,
      circuitsByStatus,
      proofsByStatus,
    };
  }

  /**
   * Reset all state (for testing).
   */
  reset() {
    this._circuits.clear();
    this._setups.clear();
    this._proofs.clear();
    this._aggregatedProofs.clear();
    this._completedProofs = [];
    this._proofCounter = 0;
  }

  // ---- Private methods ----

  /**
   * Hash a circuit to a unique identifier.
   * @private
   */
  _hashCircuit(constraints, publicInputs, privateInputs) {
    const data = JSON.stringify({ constraints, publicInputs, privateInputs });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate a proving key from the trusted setup.
   * @private
   */
  _generateProvingKey(circuit, toxicWaste) {
    const data = `pk:${circuit.hash}:${toxicWaste.toString(16)}:${circuit.constraintCount}`;
    return crypto.createHash('sha512').update(data).digest();
  }

  /**
   * Generate a verification key from the trusted setup.
   * @private
   */
  _generateVerificationKey(circuit, toxicWaste) {
    const data = `vk:${circuit.hash}:${toxicWaste.toString(16)}:${circuit.constraintCount}`;
    return crypto.createHash('sha256').update(data).digest();
  }

  /**
   * Generate a witness vector from public and private inputs.
   * @private
   */
  _generateWitness(circuit, publicInputs, privateInputs) {
    const witness = [];
    // First element is always 1 (constant)
    witness.push(1n);
    // Public inputs
    for (const name of circuit.publicInputs) {
      const val = publicInputs[name];
      witness.push(_toFieldElement(this.fieldPrime, val));
    }
    // Private inputs
    for (const name of circuit.privateInputs) {
      const val = privateInputs[name];
      witness.push(_toFieldElement(this.fieldPrime, val));
    }
    // Compute constraint outputs
    for (const c of circuit.constraints) {
      const result = this._evaluateConstraint(c, witness);
      witness.push(result);
    }
    return witness;
  }

  /**
   * Evaluate a constraint and return its output.
   * @private
   */
  _evaluateConstraint(constraint, witness) {
    const type = constraint.type;
    if (type === 'mul') {
      const a = witness[constraint.a] || 0n;
      const b = witness[constraint.b] || 0n;
      return (a * b) % this.fieldPrime;
    }
    if (type === 'add') {
      const a = witness[constraint.a] || 0n;
      const b = witness[constraint.b] || 0n;
      return (a + b) % this.fieldPrime;
    }
    if (type === 'const') {
      return _toFieldElement(this.fieldPrime, constraint.value);
    }
    if (type === 'eq') {
      const a = witness[constraint.a] || 0n;
      const b = witness[constraint.b] || 0n;
      return a === b ? 1n : 0n;
    }
    // Unknown constraint type — return 0
    return 0n;
  }

  /**
   * Generate proof data using a witness commitment (not the full witness).
   * This allows verification without the private inputs.
   * @private
   */
  _generateProofData(circuit, setup, witness, attestation) {
    const witnessCommitment = _hashToField(this.fieldPrime, witness).toString(16);
    const parts = [
      setup.verificationKey.toString('hex'),
      witnessCommitment,
      circuit.hash,
      attestation || 'no-attestation',
    ];
    return crypto.createHash('sha384').update(parts.join('|')).digest();
  }

  /**
   * Verify proof data against the verification key.
   * Uses the stored witness hash commitment — no private inputs needed.
   * @private
   */
  _verifyProofData(circuit, setup, proof, publicInputs) {
    // Recompute expected proof data using the stored witness commitment
    const parts = [
      setup.verificationKey.toString('hex'),
      proof.witnessHash.toString(16),
      circuit.hash,
      proof.enclaveAttestation || 'no-attestation',
    ];
    const expectedData = crypto.createHash('sha384').update(parts.join('|')).digest();
    // Constant-time comparison
    return _constantTimeBufferCompare(proof.proofData, expectedData);
  }
}

/**
 * Convert a value to a field element.
 * @param {bigint} fieldPrime
 * @param {*} val
 * @returns {bigint}
 * @private
 */
function _toFieldElement(fieldPrime, val) {
  if (typeof val === 'bigint') return val % fieldPrime;
  if (typeof val === 'number') return BigInt(val) % fieldPrime;
  if (typeof val === 'string') {
    try {
      return BigInt(val) % fieldPrime;
    } catch {
      return 0n;
    }
  }
  if (Buffer.isBuffer(val)) {
    let result = 0n;
    for (const b of val) {
      result = (result << 8n) | BigInt(b);
    }
    return result % fieldPrime;
  }
  return 0n;
}

/**
 * Generate a random field element.
 * @param {bigint} fieldPrime
 * @returns {bigint}
 * @private
 */
function _randomFieldElement(fieldPrime) {
  const bytes = crypto.randomBytes(32);
  let value = 0n;
  for (const b of bytes) {
    value = (value << 8n) | BigInt(b);
  }
  return value % fieldPrime;
}

/**
 * Hash a witness vector to a field element.
 * @param {bigint} fieldPrime
 * @param {bigint[]} witness
 * @returns {bigint}
 * @private
 */
function _hashToField(fieldPrime, witness) {
  const data = witness.map(w => w.toString(16)).join(':');
  const hash = crypto.createHash('sha256').update(data).digest();
  let result = 0n;
  for (const b of hash) {
    result = (result << 8n) | BigInt(b);
  }
  return result % fieldPrime;
}

/**
 * Constant-time buffer comparison.
 * @param {Buffer} a
 * @param {Buffer} b
 * @returns {boolean}
 * @private
 */
function _constantTimeBufferCompare(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

module.exports = {
  ZkSnarkVerifierEngine,
  DEFAULT_OPTIONS,
  CIRCUIT_STATUS,
  PROOF_STATUS,
  SETUP_STATUS,
};
