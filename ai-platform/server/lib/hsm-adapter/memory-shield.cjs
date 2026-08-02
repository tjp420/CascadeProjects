'use strict';

/**
 * Track 28: Memory shield.
 *
 * Monitors sensitive buffer allocations and applies periodic page-wipe
 * operations at a configured interval. Buffers that exceed the maximum
 * allowed age are rejected for access and zeroized.
 *
 * @module hsm-adapter/memory-shield
 */

const { HsmAdapterError } = require('./base-adapter.cjs');
const { secureZeroize } = require('./secure-zeroize.cjs');

class MemoryShield {
  /**
   * @param {object} options
   * @param {number} [options.memoryWipeIntervalMs=1000]
   * @param {number} [options.maxSensitiveBufferAgeMs=5000]
   * @param {boolean} [options.requirePageBoundaryTracking=true]
   * @param {number} [options.pageSizeBytes=4096]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this._memoryWipeIntervalMs = options.memoryWipeIntervalMs || 1000;
    this._maxSensitiveBufferAgeMs = options.maxSensitiveBufferAgeMs || 5000;
    this._requirePageBoundaryTracking = options.requirePageBoundaryTracking !== false;
    this._pageSizeBytes = options.pageSizeBytes || 4096;
    this._audit = options.audit || null;
    this._registry = new Map();
    this._interval = null;
  }

  /**
   * Start the periodic page-wipe monitor.
   */
  start() {
    if (this._interval) return;
    this._interval = setInterval(() => this._purgeExpired(), this._memoryWipeIntervalMs);
    this._emitAudit('MEMORY_SHIELD_PURGED', { reason: 'monitor_started', activeBuffers: this._registry.size });
  }

  /**
   * Stop the periodic page-wipe monitor.
   */
  stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  /**
   * Register a sensitive buffer for tracking and lifecycle enforcement.
   * @param {Buffer} buffer
   * @param {string} label
   * @returns {string} token
   */
  register(buffer, label = 'sensitive') {
    if (!Buffer.isBuffer(buffer)) {
      throw new HsmAdapterError('INVALID_INPUT', 'MemoryShield.register requires a Buffer');
    }
    if (this._requirePageBoundaryTracking && buffer.length > this._pageSizeBytes) {
      throw new HsmAdapterError('MEMORY_SHIELD_REJECTED', `buffer size ${buffer.length} exceeds page boundary ${this._pageSizeBytes} bytes`);
    }
    const token = `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this._registry.set(token, { buffer, createdAt: Date.now(), label });
    return token;
  }

  /**
   * Retrieve a tracked buffer if it has not expired.
   * @param {string} token
   * @returns {Buffer}
   */
  access(token) {
    const entry = this._registry.get(token);
    if (!entry) {
      throw new HsmAdapterError('MEMORY_SHIELD_REJECTED', 'buffer not found or already purged');
    }
    const age = Date.now() - entry.createdAt;
    if (age > this._maxSensitiveBufferAgeMs) {
      this._purgeToken(token, 'expired');
      throw new HsmAdapterError('MEMORY_SHIELD_EXPIRED', `buffer expired after ${age}ms`);
    }
    return entry.buffer;
  }

  /**
   * Purge a specific tracked buffer immediately.
   * @param {string} token
   */
  purge(token) {
    this._purgeToken(token, 'explicit');
  }

  _purgeExpired() {
    const now = Date.now();
    for (const [token, entry] of this._registry.entries()) {
      const age = now - entry.createdAt;
      if (age > this._maxSensitiveBufferAgeMs) {
        this._purgeToken(token, 'expired');
      }
    }
  }

  _purgeToken(token, reason) {
    const entry = this._registry.get(token);
    if (!entry) return;
    secureZeroize(entry.buffer, { strategy: 'both' });
    this._registry.delete(token);
    this._emitAudit('MEMORY_SHIELD_PURGED', { token, reason, label: entry.label, age: Date.now() - entry.createdAt });
  }

  _emitAudit(event, info) {
    if (this._audit) this._audit(event, { timestamp: Date.now(), ...info });
  }
}

module.exports = { MemoryShield };
