'use strict';

/**
 * Track 28: Confidential Computing Sandboxing.
 *
 * Creates isolated execution environments for sensitive cryptographic
 * operations. Each sandbox enforces attestation-gated access, memory
 * isolation, and zeroization of sensitive data after execution.
 *
 * Sandbox lifecycle:
 *   1. create() — allocate sandbox with scoped key material
 *   2. attest() — verify hardware attestation before execution
 *   3. execute() — run operation inside sandbox
 *   4. zeroize() — clear all sensitive data
 *   5. destroy() — deallocate sandbox
 *
 * @module hsm-adapter/confidential-sandbox-engine
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

const SANDBOX_STATES = {
  CREATED: 'created',
  ATTESTED: 'attested',
  EXECUTING: 'executing',
  COMPLETED: 'completed',
  ZEROIZED: 'zeroized',
  DESTROYED: 'destroyed',
};

const DEFAULT_ALLOWED_OPERATIONS = new Set([
  'sign',
  'verify',
  'encrypt',
  'decrypt',
  'derive',
  'hash',
]);

/**
 * Securely zeroize a Buffer.
 * @param {Buffer} buf
 */
function _secureZeroize(buf) {
  if (Buffer.isBuffer(buf)) buf.fill(0);
}

/**
 * Generate a random sandbox ID.
 * @returns {string}
 */
function _generateSandboxId() {
  return 'sbx-' + crypto.randomBytes(16).toString('hex');
}

/**
 * Represents an isolated execution sandbox.
 */
class Sandbox {
  /**
   * @param {string} id
   * @param {object} options
   * @param {string} options.tenantId
   * @param {Set<string>} options.allowedOperations
   * @param {number} options.maxExecutionTimeSeconds
   */
  constructor(id, options = {}) {
    this.id = id;
    this.tenantId = options.tenantId || 'default';
    this.allowedOperations = options.allowedOperations || DEFAULT_ALLOWED_OPERATIONS;
    this.maxExecutionTimeSeconds = options.maxExecutionTimeSeconds || 30;
    this.state = SANDBOX_STATES.CREATED;
    this.createdAt = Date.now();
    this.attestedAt = null;
    this.executedAt = null;
    this.completedAt = null;
    this.destroyedAt = null;
    this._memory = new Map();
    this._attestation = null;
    this._executionResult = null;
  }

  /**
   * Store sensitive data in the sandbox memory.
   * @param {string} key
   * @param {Buffer} data
   */
  setMemory(key, data) {
    this._memory.set(key, data);
  }

  /**
   * Retrieve sensitive data from the sandbox memory.
   * @param {string} key
   * @returns {Buffer|undefined}
   */
  getMemory(key) {
    return this._memory.get(key);
  }

  /**
   * Check if an operation is allowed in this sandbox.
   * @param {string} operation
   * @returns {boolean}
   */
  isOperationAllowed(operation) {
    return this.allowedOperations.has(operation);
  }

  /**
   * Zeroize all sensitive data in the sandbox memory.
   */
  zeroize() {
    for (const buf of this._memory.values()) {
      _secureZeroize(buf);
    }
    this._memory.clear();
    this.state = SANDBOX_STATES.ZEROIZED;
  }

  /**
   * Get the sandbox state for telemetry.
   * @returns {object}
   */
  getState() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      state: this.state,
      createdAt: this.createdAt,
      attestedAt: this.attestedAt,
      executedAt: this.executedAt,
      completedAt: this.completedAt,
      destroyedAt: this.destroyedAt,
      memoryEntries: this._memory.size,
      hasAttestation: this._attestation !== null,
    };
  }
}

/**
 * Confidential Sandbox Engine.
 *
 * Manages sandbox lifecycle, attestation gating, and policy enforcement.
 */
class ConfidentialSandboxEngine {
  /**
   * @param {object} options
   * @param {object} [options.attestationClient] — EnclaveAttestationClient instance
   * @param {object} [options.policy] — sandbox policy block
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this._attestationClient = options.attestationClient || null;
    this._policy = options.policy || null;
    this._audit = options.audit || null;
    this._sandboxes = new Map();
  }

  /**
   * Create a new isolated sandbox.
   * @param {string} tenantId
   * @param {object} [options]
   * @param {Set<string>} [options.allowedOperations]
   * @param {number} [options.maxExecutionTimeSeconds]
   * @returns {Sandbox}
   */
  create(tenantId, options = {}) {
    const id = _generateSandboxId();
    const mergedOptions = {
      tenantId,
      allowedOperations: options.allowedOperations || DEFAULT_ALLOWED_OPERATIONS,
      maxExecutionTimeSeconds: options.maxExecutionTimeSeconds || 30,
    };

    if (this._policy) {
      if (this._policy.maxExecutionTimeSeconds && mergedOptions.maxExecutionTimeSeconds > this._policy.maxExecutionTimeSeconds) {
        throw new HsmAdapterError(
          'POLICY_VIOLATION_BLOCKED',
          `maxExecutionTimeSeconds ${mergedOptions.maxExecutionTimeSeconds} exceeds policy maximum ${this._policy.maxExecutionTimeSeconds}`,
        );
      }
      if (this._policy.allowedOperations) {
        const policyAllowed = new Set(this._policy.allowedOperations);
        for (const op of mergedOptions.allowedOperations) {
          if (!policyAllowed.has(op)) {
            throw new HsmAdapterError(
              'POLICY_VIOLATION_BLOCKED',
              `operation '${op}' is not allowed by policy`,
            );
          }
        }
      }
    }

    const sandbox = new Sandbox(id, mergedOptions);
    this._sandboxes.set(id, sandbox);
    this._emitAudit('SANDBOX_CREATED', { sandboxId: id, tenantId });
    return sandbox;
  }

  /**
   * Attest a sandbox with hardware attestation evidence.
   * @param {string} sandboxId
   * @param {object} attestation
   * @returns {object} attestation result
   */
  attest(sandboxId, attestation) {
    const sandbox = this._getSandbox(sandboxId);
    if (sandbox.state !== SANDBOX_STATES.CREATED) {
      throw new HsmAdapterError(
        'SANDBOX_INVALID_STATE',
        `sandbox ${sandboxId} is in state ${sandbox.state}, expected ${SANDBOX_STATES.CREATED}`,
      );
    }

    if (this._attestationClient) {
      const result = this._attestationClient.verify(attestation);
      if (!result.verified && !result.valid) {
        throw new HsmAdapterError('ATTESTATION_REJECTED', result.reason || 'attestation verification failed');
      }
      sandbox._attestation = result;
    } else {
      // No attestation client configured — accept mock attestation
      if (!attestation || typeof attestation !== 'object') {
        throw new HsmAdapterError('ATTESTATION_INVALID_DOCUMENT', 'attestation document missing');
      }
      sandbox._attestation = { verified: true, ...attestation };
    }

    sandbox.state = SANDBOX_STATES.ATTESTED;
    sandbox.attestedAt = Date.now();
    this._emitAudit('SANDBOX_ATTESTED', { sandboxId, measurement: sandbox._attestation.measurement });
    return sandbox._attestation;
  }

  /**
   * Execute an operation inside a sandbox.
   * @param {string} sandboxId
   * @param {string} operation — operation name (must be in allowedOperations)
   * @param {object} [params] — operation parameters
   * @returns {object} execution result
   */
  execute(sandboxId, operation, params = {}) {
    const sandbox = this._getSandbox(sandboxId);

    if (sandbox.state !== SANDBOX_STATES.ATTESTED && sandbox.state !== SANDBOX_STATES.COMPLETED) {
      throw new HsmAdapterError(
        'SANDBOX_INVALID_STATE',
        `sandbox ${sandboxId} is in state ${sandbox.state}, must be attested before execution`,
      );
    }

    if (!sandbox.isOperationAllowed(operation)) {
      throw new HsmAdapterError(
        'SANDBOX_OPERATION_DENIED',
        `operation '${operation}' is not allowed in sandbox ${sandboxId}`,
      );
    }

    sandbox.state = SANDBOX_STATES.EXECUTING;
    sandbox.executedAt = Date.now();

    try {
      const result = this._executeOperation(sandbox, operation, params);
      sandbox._executionResult = result;
      sandbox.state = SANDBOX_STATES.COMPLETED;
      sandbox.completedAt = Date.now();
      this._emitAudit('SANDBOX_EXECUTED', { sandboxId, operation, durationMs: sandbox.completedAt - sandbox.executedAt });
      return result;
    } catch (err) {
      sandbox.state = SANDBOX_STATES.COMPLETED;
      sandbox.completedAt = Date.now();
      throw err;
    }
  }

  /**
   * Internal operation executor.
   * @param {Sandbox} sandbox
   * @param {string} operation
   * @param {object} params
   * @returns {object}
   */
  _executeOperation(sandbox, operation, params) {
    switch (operation) {
      case 'sign': {
        const data = params.data || Buffer.alloc(0);
        const key = sandbox.getMemory('signingKey') || crypto.randomBytes(32);
        const signature = crypto.createHmac('sha256', key).update(data).digest();
        return { operation, signature, dataHash: crypto.createHash('sha256').update(data).digest('hex') };
      }
      case 'verify': {
        const data = params.data || Buffer.alloc(0);
        const signature = params.signature || Buffer.alloc(0);
        const key = sandbox.getMemory('signingKey') || crypto.randomBytes(32);
        const expected = crypto.createHmac('sha256', key).update(data).digest();
        return { operation, valid: signature.equals(expected) };
      }
      case 'encrypt': {
        const plaintext = params.plaintext || Buffer.alloc(0);
        const key = sandbox.getMemory('encryptionKey') || crypto.randomBytes(32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
        const tag = cipher.getAuthTag();
        return { operation, ciphertext, iv, tag };
      }
      case 'decrypt': {
        const ciphertext = params.ciphertext || Buffer.alloc(0);
        const iv = params.iv || Buffer.alloc(0);
        const tag = params.tag || Buffer.alloc(0);
        const key = sandbox.getMemory('encryptionKey') || crypto.randomBytes(32);
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        return { operation, plaintext };
      }
      case 'derive': {
        const ikm = params.ikm || crypto.randomBytes(32);
        const salt = params.salt || Buffer.alloc(0);
        const info = params.info || 'SimpleBeacon:Track28:derive';
        const derivedKey = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, 32));
        return { operation, derivedKey };
      }
      case 'hash': {
        const data = params.data || Buffer.alloc(0);
        const digest = crypto.createHash('sha256').update(data).digest();
        return { operation, digest, digestHex: digest.toString('hex') };
      }
      default:
        throw new HsmAdapterError('SANDBOX_OPERATION_UNKNOWN', `unknown operation '${operation}'`);
    }
  }

  /**
   * Zeroize a sandbox's sensitive data.
   * @param {string} sandboxId
   */
  zeroize(sandboxId) {
    const sandbox = this._getSandbox(sandboxId);
    sandbox.zeroize();
    this._emitAudit('SANDBOX_ZEROIZED', { sandboxId });
  }

  /**
   * Destroy a sandbox and remove it from the engine.
   * @param {string} sandboxId
   */
  destroy(sandboxId) {
    const sandbox = this._getSandbox(sandboxId);
    if (sandbox.state !== SANDBOX_STATES.ZEROIZED) {
      sandbox.zeroize();
    }
    sandbox.state = SANDBOX_STATES.DESTROYED;
    sandbox.destroyedAt = Date.now();
    this._sandboxes.delete(sandboxId);
    this._emitAudit('SANDBOX_DESTROYED', { sandboxId });
  }

  /**
   * Get a sandbox by ID.
   * @param {string} sandboxId
   * @returns {Sandbox}
   */
  _getSandbox(sandboxId) {
    const sandbox = this._sandboxes.get(sandboxId);
    if (!sandbox) {
      throw new HsmAdapterError('SANDBOX_NOT_FOUND', `sandbox ${sandboxId} not found`);
    }
    return sandbox;
  }

  /**
   * Get a sandbox's state (read-only).
   * @param {string} sandboxId
   * @returns {object}
   */
  getSandboxState(sandboxId) {
    return this._getSandbox(sandboxId).getState();
  }

  /**
   * Get engine telemetry.
   * @returns {object}
   */
  getEngineState() {
    return {
      activeSandboxes: this._sandboxes.size,
      hasAttestationClient: this._attestationClient !== null,
      hasPolicy: this._policy !== null,
    };
  }

  _emitAudit(event, data) {
    if (this._audit) this._audit(event, { timestamp: Date.now(), ...data });
  }
}

module.exports = {
  ConfidentialSandboxEngine,
  Sandbox,
  SANDBOX_STATES,
  DEFAULT_ALLOWED_OPERATIONS,
};
