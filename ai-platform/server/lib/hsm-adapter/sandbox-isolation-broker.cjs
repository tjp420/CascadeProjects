'use strict';

/**
 * Track 28: Sandbox isolation broker.
 *
 * Simulates an isolated runtime ring for cryptographic operations. Sensitive
 * payloads (wrap, split, sign) are executed inside a sandbox context with
 * memory shielding and policy-bound attestation.
 *
 * @module hsm-adapter/sandbox-isolation-broker
 */

const { HsmAdapterError } = require('./base-adapter.cjs');
const { MemoryShield } = require('./memory-shield.cjs');

const ALLOWED_MODES = new Set(['wasm', 'gvisor', 'bubblewrap']);

class SandboxIsolationBroker {
  /**
   * @param {object} options
   * @param {string} [options.mode='wasm']
   * @param {object} [options.policy] - full enclave policy
   * @param {MemoryShield} [options.memoryShield]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this._mode = options.mode || 'wasm';
    this._policy = options.policy || {};
    this._memoryShield = options.memoryShield || null;
    this._audit = options.audit || null;
    this._initialized = false;
    this._attestation = null;
  }

  /**
   * Initialize the sandbox and start memory shielding if configured.
   * @returns {{mode: string, attestation: string}}
   */
  initialize() {
    if (this._initialized) {
      return { mode: this._mode, attestation: this._attestation };
    }
    if (!ALLOWED_MODES.has(this._mode)) {
      throw new HsmAdapterError('SANDBOX_MODE_REJECTED', `mode ${this._mode} is not allowed; permitted: ${[...ALLOWED_MODES].join(', ')}`);
    }
    if (this._policy.requireAttestationLog) {
      this._attestation = this._generateAttestation();
    }
    if (this._memoryShield && !this._memoryShield._interval) {
      this._memoryShield.start();
    }
    this._initialized = true;
    this._emitAudit('SANDBOX_ENCLAVE_INITIALIZED', { mode: this._mode, attestation: this._attestation });
    return { mode: this._mode, attestation: this._attestation };
  }

  /**
   * Execute a cryptographic payload inside the sandbox.
   * @param {string} operation - 'wrap', 'split', 'sign'
   * @param {Function} payload
   * @param  {...any} args
   * @returns {any}
   */
  execute(operation, payload, ...args) {
    this._ensureInitialized();
    if (typeof operation !== 'string' || !payload || typeof payload !== 'function') {
      throw new HsmAdapterError('INVALID_INPUT', 'operation and payload function are required');
    }
    if (this._policy.requireAttestationLog && !this._attestation) {
      throw new HsmAdapterError('SANDBOX_ATTESTATION_REQUIRED', 'attestation log is required before execution');
    }
    try {
      const result = payload(...args);
      return { operation, result, sandboxed: true, mode: this._mode };
    } catch (err) {
      throw new HsmAdapterError('SANDBOX_EXECUTION_FAILED', `payload failed: ${err.message}`);
    }
  }

  /**
   * Tear down the sandbox and clear any tracked buffers.
   */
  teardown() {
    if (this._memoryShield) {
      this._memoryShield.stop();
    }
    this._initialized = false;
    this._attestation = null;
  }

  _generateAttestation() {
    return `attest-${this._mode}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  _ensureInitialized() {
    if (!this._initialized) {
      throw new HsmAdapterError('SANDBOX_NOT_INITIALIZED', 'initialize() must be called before execute()');
    }
  }

  _emitAudit(event, info) {
    if (this._audit) this._audit(event, { timestamp: Date.now(), ...info });
  }
}

module.exports = { SandboxIsolationBroker };
