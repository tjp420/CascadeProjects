"use strict";

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

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");
const {
  HardwareAttestationVerifier,
  ATTESTATION_MAX_AGE_SECONDS,
} = require("./hardware-attestation-verify.cjs");

const SANDBOX_STATES = {
  CREATED: "created",
  ATTESTED: "attested",
  EXECUTING: "executing",
  COMPLETED: "completed",
  ZEROIZED: "zeroized",
  DESTROYED: "destroyed",
};

const DEFAULT_ALLOWED_OPERATIONS = new Set([
  "sign",
  "verify",
  "encrypt",
  "decrypt",
  "derive",
  "hash",
]);

// Memory lifecycle limits
const MAX_MEMORY_ENTRY_BYTES = 64 * 1024; // 64 KB per entry
const MAX_MEMORY_ENTRIES = 16; // max entries per sandbox
const MAX_AUDIT_ENTRIES = 50; // ring buffer for memory audit log

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
  return "sbx-" + crypto.randomBytes(16).toString("hex");
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
    this.tenantId = options.tenantId || "default";
    this.allowedOperations =
      options.allowedOperations || DEFAULT_ALLOWED_OPERATIONS;
    this.maxExecutionTimeSeconds =
      options.maxExecutionTimeSeconds != null
        ? options.maxExecutionTimeSeconds
        : 30;
    this.state = SANDBOX_STATES.CREATED;
    this.createdAt = Date.now();
    this.attestedAt = null;
    this.executedAt = null;
    this.completedAt = null;
    this.destroyedAt = null;
    this._memory = new Map();
    this._attestation = null;
    this._executionResult = null;
    this._memoryAuditLog = [];
    this._lastParams = null;
  }

  /**
   * Store sensitive data in the sandbox memory.
   * Copies the buffer to prevent external mutation.
   * @param {string} key
   * @param {Buffer} data
   */
  setMemory(key, data) {
    if (!Buffer.isBuffer(data)) {
      throw new HsmAdapterError("INVALID_MEMORY_TYPE", "data must be a Buffer");
    }
    if (data.length > MAX_MEMORY_ENTRY_BYTES) {
      throw new HsmAdapterError(
        "MEMORY_ENTRY_TOO_LARGE",
        `entry size ${data.length} exceeds max ${MAX_MEMORY_ENTRY_BYTES}`,
      );
    }
    if (!this._memory.has(key) && this._memory.size >= MAX_MEMORY_ENTRIES) {
      throw new HsmAdapterError(
        "MEMORY_ENTRIES_FULL",
        `memory entries limit ${MAX_MEMORY_ENTRIES} reached`,
      );
    }
    // Copy buffer to prevent external mutation
    const copy = Buffer.allocUnsafe(data.length);
    data.copy(copy);
    this._memory.set(key, copy);
    this._memoryAuditLog.push({
      op: "set",
      key,
      size: copy.length,
      timestamp: Date.now(),
    });
    if (this._memoryAuditLog.length > MAX_AUDIT_ENTRIES)
      this._memoryAuditLog.shift();
  }

  /**
   * Retrieve sensitive data from the sandbox memory.
   * @param {string} key
   * @returns {Buffer|undefined}
   */
  getMemory(key) {
    const val = this._memory.get(key);
    this._memoryAuditLog.push({ op: "get", key, timestamp: Date.now() });
    if (this._memoryAuditLog.length > MAX_AUDIT_ENTRIES)
      this._memoryAuditLog.shift();
    return val;
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
   * Zeroize all sensitive data in the sandbox memory, execution result, and params.
   */
  zeroize() {
    for (const buf of this._memory.values()) {
      _secureZeroize(buf);
    }
    this._memory.clear();
    // Zeroize execution result buffers
    if (this._executionResult) {
      for (const val of Object.values(this._executionResult)) {
        if (Buffer.isBuffer(val)) _secureZeroize(val);
      }
      this._executionResult = null;
    }
    // Zeroize last operation params buffers
    if (this._lastParams) {
      for (const val of Object.values(this._lastParams)) {
        if (Buffer.isBuffer(val)) _secureZeroize(val);
      }
      this._lastParams = null;
    }
    this.state = SANDBOX_STATES.ZEROIZED;
  }

  /**
   * Get the memory access audit log (no sensitive data — just key names, sizes, timestamps).
   * @returns {object[]}
   */
  getMemoryAuditLog() {
    return this._memoryAuditLog.slice(); // return a copy
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
   * @param {object} [options.attestationClient] — EnclaveAttestationClient instance (legacy)
   * @param {object} [options.hardwareAttestationVerifier] — HardwareAttestationVerifier instance
   * @param {object} [options.expectedMeasurements] — expected hardware measurements for attestation
   * @param {object} [options.policy] — sandbox policy block
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this._attestationClient = options.attestationClient || null;
    this._policy = options.policy || null;
    this._audit = options.audit || null;
    this._sandboxes = new Map();
    // Initialize hardware attestation verifier
    if (options.hardwareAttestationVerifier) {
      this._hwVerifier = options.hardwareAttestationVerifier;
    } else if (options.expectedMeasurements) {
      this._hwVerifier = new HardwareAttestationVerifier({
        expectedMeasurements: options.expectedMeasurements,
        audit: options.audit,
      });
    } else {
      this._hwVerifier = null;
    }
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
      allowedOperations:
        options.allowedOperations || DEFAULT_ALLOWED_OPERATIONS,
      maxExecutionTimeSeconds:
        options.maxExecutionTimeSeconds != null
          ? options.maxExecutionTimeSeconds
          : 30,
    };

    if (this._policy) {
      if (
        this._policy.maxExecutionTimeSeconds &&
        mergedOptions.maxExecutionTimeSeconds >
          this._policy.maxExecutionTimeSeconds
      ) {
        throw new HsmAdapterError(
          "POLICY_VIOLATION_BLOCKED",
          `maxExecutionTimeSeconds ${mergedOptions.maxExecutionTimeSeconds} exceeds policy maximum ${this._policy.maxExecutionTimeSeconds}`,
        );
      }
      if (this._policy.allowedOperations) {
        const policyAllowed = new Set(this._policy.allowedOperations);
        for (const op of mergedOptions.allowedOperations) {
          if (!policyAllowed.has(op)) {
            throw new HsmAdapterError(
              "POLICY_VIOLATION_BLOCKED",
              `operation '${op}' is not allowed by policy`,
            );
          }
        }
      }
    }

    const sandbox = new Sandbox(id, mergedOptions);
    this._sandboxes.set(id, sandbox);
    this._emitAudit("SANDBOX_CREATED", { sandboxId: id, tenantId });
    return sandbox;
  }

  /**
   * Attest a sandbox with hardware attestation evidence.
   * @param {string} sandboxId
   * @param {object} attestation
   * @returns {object} attestation result
   */
  /**
   * Issue a nonce challenge for sandbox attestation.
   * @param {string} sandboxId
   * @returns {{ nonce: string, issuedAt: number }}
   */
  issueChallenge(sandboxId) {
    const sandbox = this._getSandbox(sandboxId);
    if (sandbox.state !== SANDBOX_STATES.CREATED) {
      throw new HsmAdapterError(
        "SANDBOX_INVALID_STATE",
        `sandbox ${sandboxId} is in state ${sandbox.state}, expected ${SANDBOX_STATES.CREATED}`,
      );
    }
    if (!this._hwVerifier) {
      throw new HsmAdapterError(
        "ATTESTATION_NOT_CONFIGURED",
        "hardware attestation verifier not configured",
      );
    }
    return this._hwVerifier.issueChallenge(sandboxId);
  }

  attest(sandboxId, attestation) {
    const sandbox = this._getSandbox(sandboxId);
    if (sandbox.state !== SANDBOX_STATES.CREATED) {
      throw new HsmAdapterError(
        "SANDBOX_INVALID_STATE",
        `sandbox ${sandboxId} is in state ${sandbox.state}, expected ${SANDBOX_STATES.CREATED}`,
      );
    }

    // Check attestation age before verification
    if (
      attestation &&
      typeof attestation === "object" &&
      typeof attestation.attestationAgeSeconds === "number"
    ) {
      if (attestation.attestationAgeSeconds > ATTESTATION_MAX_AGE_SECONDS) {
        this._emitAudit("ATTESTATION_EXPIRED", {
          sandboxId,
          ageSeconds: attestation.attestationAgeSeconds,
          siemSeverity: "high",
          siemCategory: "attestation_expired",
        });
        throw new HsmAdapterError(
          "ATTESTATION_EXPIRED",
          `attestation age ${attestation.attestationAgeSeconds}s exceeds maximum ${ATTESTATION_MAX_AGE_SECONDS}s`,
        );
      }
    }

    // Use hardware attestation verifier if configured (preferred path)
    if (this._hwVerifier) {
      const result = this._hwVerifier.verify(sandboxId, attestation);
      sandbox._attestation = result;
      this._emitAudit("SANDBOX_ATTESTED", {
        sandboxId,
        measurement: result.measurement,
        authority: result.authority,
      });
      sandbox.state = SANDBOX_STATES.ATTESTED;
      sandbox.attestedAt = Date.now();
      return sandbox._attestation;
    }

    // Legacy path: use attestation client if configured
    if (this._attestationClient) {
      const result = this._attestationClient.verify(attestation);
      if (result && result.verified === false) {
        this._emitAudit("ATTESTATION_REJECTED", {
          sandboxId,
          siemSeverity: "high",
          siemCategory: "attestation_rejected",
        });
        throw new HsmAdapterError(
          "ATTESTATION_REJECTED",
          "attestation verification failed",
        );
      }
      sandbox._attestation = result;
      sandbox.state = SANDBOX_STATES.ATTESTED;
      sandbox.attestedAt = Date.now();
      this._emitAudit("SANDBOX_ATTESTED", {
        sandboxId,
        measurement: sandbox._attestation.measurement,
      });
      return sandbox._attestation;
    }

    // No verifier configured — fail closed (no more mock fallback)
    this._emitAudit("ATTESTATION_NOT_CONFIGURED", {
      sandboxId,
      siemSeverity: "high",
      siemCategory: "attestation_not_configured",
    });
    throw new HsmAdapterError(
      "ATTESTATION_NOT_CONFIGURED",
      "no attestation verifier configured — cannot attest sandbox",
    );
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

    if (
      sandbox.state !== SANDBOX_STATES.ATTESTED &&
      sandbox.state !== SANDBOX_STATES.COMPLETED
    ) {
      throw new HsmAdapterError(
        "SANDBOX_INVALID_STATE",
        `sandbox ${sandboxId} is in state ${sandbox.state}, must be attested before execution`,
      );
    }

    if (!sandbox.isOperationAllowed(operation)) {
      throw new HsmAdapterError(
        "SANDBOX_OPERATION_DENIED",
        `operation '${operation}' is not allowed in sandbox ${sandboxId}`,
      );
    }

    sandbox.state = SANDBOX_STATES.EXECUTING;
    sandbox.executedAt = Date.now();
    sandbox._lastParams = params;

    // Enforce execution timeout
    const timeoutMs = sandbox.maxExecutionTimeSeconds * 1000;

    try {
      const result = this._executeOperation(sandbox, operation, params);
      const elapsed = Date.now() - sandbox.executedAt;
      if (elapsed > timeoutMs || timeoutMs === 0) {
        this._emitAudit("SANDBOX_EXECUTION_TIMEOUT", {
          sandboxId,
          operation,
          elapsedMs: elapsed,
          timeoutMs,
          siemSeverity: "high",
          siemCategory: "sandbox_timeout",
        });
        throw new HsmAdapterError(
          "SANDBOX_EXECUTION_TIMEOUT",
          `execution took ${elapsed}ms, exceeded limit ${timeoutMs}ms`,
        );
      }
      sandbox._executionResult = result;
      sandbox.state = SANDBOX_STATES.COMPLETED;
      sandbox.completedAt = Date.now();
      this._emitAudit("SANDBOX_EXECUTED", {
        sandboxId,
        operation,
        durationMs: sandbox.completedAt - sandbox.executedAt,
      });
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
      case "sign": {
        const data = params.data || Buffer.alloc(0);
        const key = sandbox.getMemory("signingKey") || crypto.randomBytes(32);
        const signature = crypto
          .createHmac("sha256", key)
          .update(data)
          .digest();
        return {
          operation,
          signature,
          dataHash: crypto.createHash("sha256").update(data).digest("hex"),
        };
      }
      case "verify": {
        const data = params.data || Buffer.alloc(0);
        const signature = params.signature || Buffer.alloc(0);
        const key = sandbox.getMemory("signingKey") || crypto.randomBytes(32);
        const expected = crypto.createHmac("sha256", key).update(data).digest();
        return { operation, valid: signature.equals(expected) };
      }
      case "encrypt": {
        const plaintext = params.plaintext || Buffer.alloc(0);
        const key =
          sandbox.getMemory("encryptionKey") || crypto.randomBytes(32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
        const ciphertext = Buffer.concat([
          cipher.update(plaintext),
          cipher.final(),
        ]);
        const tag = cipher.getAuthTag();
        return { operation, ciphertext, iv, tag };
      }
      case "decrypt": {
        const ciphertext = params.ciphertext || Buffer.alloc(0);
        const iv = params.iv || Buffer.alloc(0);
        const tag = params.tag || Buffer.alloc(0);
        const key =
          sandbox.getMemory("encryptionKey") || crypto.randomBytes(32);
        const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(tag);
        const plaintext = Buffer.concat([
          decipher.update(ciphertext),
          decipher.final(),
        ]);
        return { operation, plaintext };
      }
      case "derive": {
        const ikm = params.ikm || crypto.randomBytes(32);
        const salt = params.salt || Buffer.alloc(0);
        const info = params.info || "SimpleBeacon:Track28:derive";
        const derivedKey = Buffer.from(
          crypto.hkdfSync("sha256", ikm, salt, info, 32),
        );
        return { operation, derivedKey };
      }
      case "hash": {
        const data = params.data || Buffer.alloc(0);
        const digest = crypto.createHash("sha256").update(data).digest();
        return { operation, digest, digestHex: digest.toString("hex") };
      }
      default:
        throw new HsmAdapterError(
          "SANDBOX_OPERATION_UNKNOWN",
          `unknown operation '${operation}'`,
        );
    }
  }

  /**
   * Zeroize a sandbox's sensitive data.
   * @param {string} sandboxId
   */
  zeroize(sandboxId) {
    const sandbox = this._getSandbox(sandboxId);
    sandbox.zeroize();
    this._emitAudit("SANDBOX_ZEROIZED", { sandboxId });
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
    this._emitAudit("SANDBOX_DESTROYED", { sandboxId });
  }

  /**
   * Get a sandbox by ID.
   * @param {string} sandboxId
   * @returns {Sandbox}
   */
  _getSandbox(sandboxId) {
    const sandbox = this._sandboxes.get(sandboxId);
    if (!sandbox) {
      throw new HsmAdapterError(
        "SANDBOX_NOT_FOUND",
        `sandbox ${sandboxId} not found`,
      );
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
  MAX_MEMORY_ENTRY_BYTES,
  MAX_MEMORY_ENTRIES,
  MAX_AUDIT_ENTRIES,
  HardwareAttestationVerifier,
};
