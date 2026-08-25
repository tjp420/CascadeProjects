"use strict";

/**
 * Track 15: Volatile eviction engine.
 *
 * Monitors HSM key activity and, after a tenant-configurable inactivity
 * interval, purges and zeroizes idle keys.
 *
 * @module hsm-adapter/volatile-eviction-engine
 */

const { HsmAdapterError } = require("./base-adapter.cjs");

const DEFAULT_INTERVAL_MS = 30_000;

function _entryKey(tenantId, kekId) {
  return `${tenantId}:${kekId}`;
}

function _splitKey(key) {
  const [tenantId, ...rest] = key.split(":");
  const kekId = rest.join(":");
  return { tenantId, kekId };
}

class VolatileEvictionEngine {
  /**
   * @param {CryptoPolicyEngine} policyEngine
   * @param {object} [options]
   * @param {number} [options.intervalMs=30000] - scan interval; 0 disables automatic eviction
   */
  constructor(policyEngine, options = {}) {
    if (!policyEngine || typeof policyEngine.getPolicy !== "function") {
      throw new HsmAdapterError(
        "INVALID_INPUT",
        "VolatileEvictionEngine requires a policy engine with getPolicy()",
      );
    }
    this._policyEngine = policyEngine;
    this._intervalMs =
      options.intervalMs === undefined
        ? DEFAULT_INTERVAL_MS
        : options.intervalMs;
    this._registry = new Map();
    this._timer = null;
  }

  register(tenantId, kekId, zeroizeCallback) {
    if (typeof zeroizeCallback !== "function") {
      throw new HsmAdapterError(
        "INVALID_INPUT",
        "zeroizeCallback must be a function",
      );
    }
    const key = _entryKey(tenantId, kekId);
    this._registry.set(key, {
      tenantId,
      kekId,
      lastUsed: Date.now(),
      zeroizeCallback,
    });
    this._start();
  }

  touch(tenantId, kekId) {
    const key = _entryKey(tenantId, kekId);
    const entry = this._registry.get(key);
    if (entry) {
      entry.lastUsed = Date.now();
    }
  }

  unregister(tenantId, kekId) {
    this._registry.delete(_entryKey(tenantId, kekId));
    if (this._registry.size === 0) {
      this.stop();
    }
  }

  _start() {
    if (this._timer || this._intervalMs === 0) return;
    this._timer = setInterval(() => this._evict(), this._intervalMs);
    if (this._timer.unref) this._timer.unref();
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  /**
   * Manually evict all keys for an explicit reason, ignoring the inactivity
   * interval. Useful for shutdown or emergency purge.
   * @param {string} reason
   */
  async evictAll(reason = "explicit") {
    for (const [key, entry] of this._registry.entries()) {
      await this._triggerEviction(key, entry, reason);
    }
  }

  async _evict() {
    const now = Date.now();
    for (const [key, entry] of this._registry.entries()) {
      const policy = this._policyEngine.getPolicy(entry.tenantId);
      const seconds =
        policy && policy.eviction
          ? policy.eviction.inactivityEvictionSeconds
          : 0;
      if (seconds > 0 && now - entry.lastUsed > seconds * 1000) {
        await this._triggerEviction(key, entry, "inactivity");
      }
    }
  }

  async _triggerEviction(key, entry, reason) {
    this._registry.delete(key);
    try {
      await entry.zeroizeCallback(entry.kekId, reason);
    } catch (err) {
      console.error("volatile-eviction-engine.cjs error:", err);
      // Eviction failures are logged by the adapter; do not stop the timer.
    }
  }
}

module.exports = {
  VolatileEvictionEngine,
};
