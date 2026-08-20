"use strict";

/**
 * Track 49: Dynamic Enclave Rescaling and Predictive Load Balancing.
 *
 * Auto-scales the enclave cluster layout topology based on real-time load
 * metrics and predictive forecasting. Integrates with Track 44
 * CrossEnclaveStateSync for shard rebalancing and Track 48 FaultInjection
 * for chaos-triggered rescaling.
 *
 * Components:
 *   - LoadMonitor: Collects per-enclave load samples with sliding window
 *   - PredictiveForecaster: Moving average + linear trend prediction
 *   - RescalingDecisionEngine: Decides when to scale up/down based on thresholds
 *   - ShardRebalancer: Rebalances shards after topology changes
 *   - CapacityPlanner: Calculates optimal enclave count based on predicted load
 *
 * @module hsm-adapter/dynamic-enclave-rescaling
 */

const { HsmAdapterError } = require("./base-adapter.cjs");

const DEFAULT_OPTIONS = {
  minEnclaves: 2,
  maxEnclaves: 32,
  targetLoadPerEnclave: 0.7, // 70% capacity
  scaleUpThreshold: 0.85, // scale up when avg load > 85%
  scaleDownThreshold: 0.3, // scale down when avg load < 30%
  loadHistorySize: 60, // number of samples to keep
  forecastWindow: 10, // samples to predict ahead
  forecastAlgorithm: "moving-average", // or 'linear-trend'
  rebalanceThreshold: 0.2, // imbalance > 20% triggers rebalance
  cooldownPeriodMs: 30000, // minimum time between scaling actions
  sampleIntervalMs: 5000, // load sampling interval
  chaosTriggerEnabled: true, // rescale on chaos events
};

const SCALE_ACTION = {
  SCALE_UP: "scale-up",
  SCALE_DOWN: "scale-down",
  REBALANCE: "rebalance",
  NO_ACTION: "no-action",
};

const SCALE_STATUS = {
  PENDING: "pending",
  IN_PROGRESS: "in-progress",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
};

/**
 * Dynamic Enclave Rescaling and Predictive Load Balancing Engine.
 */
class DynamicEnclaveRescaler {
  /**
   * @param {object} [options]
   */
  constructor(options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    this.minEnclaves = opts.minEnclaves;
    this.maxEnclaves = opts.maxEnclaves;
    this.targetLoadPerEnclave = opts.targetLoadPerEnclave;
    this.scaleUpThreshold = opts.scaleUpThreshold;
    this.scaleDownThreshold = opts.scaleDownThreshold;
    this.loadHistorySize = opts.loadHistorySize;
    this.forecastWindow = opts.forecastWindow;
    this.forecastAlgorithm = opts.forecastAlgorithm;
    this.rebalanceThreshold = opts.rebalanceThreshold;
    this.cooldownPeriodMs = opts.cooldownPeriodMs;
    this.sampleIntervalMs = opts.sampleIntervalMs;
    this.chaosTriggerEnabled = opts.chaosTriggerEnabled;
    this._audit = opts.audit || null;

    // Per-enclave load history: enclaveId -> array of { timestamp, load, capacity }
    this._loadHistory = new Map();
    // Scaling action history
    this._actionHistory = [];
    this._maxActionHistory = 100;
    this._lastScalingAt = 0;
    this._currentAction = null;
    // Enclave registry (lightweight — for standalone use)
    this._enclaves = new Map(); // enclaveId -> { id, capacity, load, status, addedAt }
    // Shard assignments: shardId -> { enclaveIds: Set }
    this._shards = new Map();
  }

  /**
   * Register an enclave in the rescaling cluster.
   * @param {string} enclaveId
   * @param {object} [meta]
   * @param {number} [meta.capacity] - Relative capacity (default 1)
   */
  registerEnclave(enclaveId, meta) {
    if (!enclaveId || typeof enclaveId !== "string") {
      throw new HsmAdapterError(
        "INVALID_ENCLAVE",
        "enclaveId must be a non-empty string",
      );
    }
    if (this._enclaves.has(enclaveId)) {
      throw new HsmAdapterError(
        "ENCLAVE_ALREADY_REGISTERED",
        `enclave ${enclaveId} already registered`,
      );
    }
    if (this._enclaves.size >= this.maxEnclaves) {
      throw new HsmAdapterError(
        "MAX_ENCLAVES_REACHED",
        `maximum ${this.maxEnclaves} enclaves reached`,
      );
    }
    const now = Date.now();
    this._enclaves.set(enclaveId, {
      id: enclaveId,
      capacity: (meta && meta.capacity) || 1,
      load: 0,
      status: "active",
      addedAt: now,
    });
    this._loadHistory.set(enclaveId, []);
    if (typeof this._audit === "function") {
      this._audit("ENCLAVE_REGISTERED", {
        enclaveId,
        capacity: (meta && meta.capacity) || 1,
      });
    }
  }

  /**
   * Unregister an enclave and rebalance its shards.
   * @param {string} enclaveId
   */
  unregisterEnclave(enclaveId) {
    if (!this._enclaves.has(enclaveId)) {
      throw new HsmAdapterError(
        "ENCLAVE_NOT_FOUND",
        `enclave ${enclaveId} not found`,
      );
    }
    this._enclaves.delete(enclaveId);
    this._loadHistory.delete(enclaveId);
    // Reassign shards that were on this enclave
    for (const [shardId, shard] of this._shards) {
      if (shard.enclaveIds.has(enclaveId)) {
        shard.enclaveIds.delete(enclaveId);
      }
    }
    if (typeof this._audit === "function") {
      this._audit("ENCLAVE_UNREGISTERED", { enclaveId });
    }
  }

  /**
   * Record a load sample for an enclave.
   * @param {string} enclaveId
   * @param {number} load - Load value (0.0 to 1.0)
   */
  recordLoad(enclaveId, load) {
    const enclave = this._enclaves.get(enclaveId);
    if (!enclave) {
      throw new HsmAdapterError(
        "ENCLAVE_NOT_FOUND",
        `enclave ${enclaveId} not found`,
      );
    }
    if (typeof load !== "number" || load < 0 || load > 1) {
      throw new HsmAdapterError(
        "INVALID_LOAD",
        "load must be a number between 0 and 1",
      );
    }
    enclave.load = load;
    const history = this._loadHistory.get(enclaveId);
    history.push({ timestamp: Date.now(), load, capacity: enclave.capacity });
    if (history.length > this.loadHistorySize) {
      history.shift();
    }
  }

  /**
   * Get the current average load across all active enclaves.
   * @returns {number}
   */
  getAverageLoad() {
    const active = this._getActiveEnclaves();
    if (active.length === 0) return 0;
    let total = 0;
    for (const e of active) total += e.load;
    return total / active.length;
  }

  /**
   * Get the maximum load across all active enclaves.
   * @returns {number}
   */
  getMaxLoad() {
    const active = this._getActiveEnclaves();
    if (active.length === 0) return 0;
    let max = 0;
    for (const e of active) {
      if (e.load > max) max = e.load;
    }
    return max;
  }

  /**
   * Forecast future load for an enclave using the configured algorithm.
   * @param {string} enclaveId
   * @returns {number} Predicted load (0.0 to 1.0)
   */
  forecastLoad(enclaveId) {
    const history = this._loadHistory.get(enclaveId);
    if (!history || history.length === 0) return 0;
    if (this.forecastAlgorithm === "linear-trend") {
      return this._linearTrendForecast(history);
    }
    return this._movingAverageForecast(history);
  }

  /**
   * Moving average forecast.
   * @param {object[]} history
   * @returns {number}
   * @private
   */
  _movingAverageForecast(history) {
    const recent = history.slice(
      -Math.min(this.forecastWindow, history.length),
    );
    let sum = 0;
    for (const sample of recent) sum += sample.load;
    const avg = sum / recent.length;
    return Math.min(1, Math.max(0, avg));
  }

  /**
   * Linear trend forecast using least squares.
   * @param {object[]} history
   * @returns {number}
   * @private
   */
  _linearTrendForecast(history) {
    const n = history.length;
    if (n < 2) return history.length === 1 ? history[0].load : 0;
    // Simple linear regression: y = a + b*x
    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += history[i].load;
      sumXY += i * history[i].load;
      sumX2 += i * i;
    }
    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0) return history[n - 1].load;
    const b = (n * sumXY - sumX * sumY) / denominator;
    const a = (sumY - b * sumX) / n;
    const predicted = a + b * (n - 1 + this.forecastWindow);
    return Math.min(1, Math.max(0, predicted));
  }

  /**
   * Calculate the load imbalance across enclaves.
   * @returns {number} Imbalance ratio (0.0 = perfectly balanced)
   */
  getImbalance() {
    const active = this._getActiveEnclaves();
    if (active.length < 2) return 0;
    const loads = active.map((e) => e.load);
    const min = Math.min(...loads);
    const max = Math.max(...loads);
    if (max === 0) return 0;
    return (max - min) / max;
  }

  /**
   * Decide what scaling action to take based on current and predicted load.
   * @returns {object} Scaling decision
   */
  evaluateScaling() {
    const now = Date.now();
    // Check cooldown
    if (now - this._lastScalingAt < this.cooldownPeriodMs) {
      return {
        action: SCALE_ACTION.NO_ACTION,
        reason: "cooldown",
        avgLoad: this.getAverageLoad(),
      };
    }
    const active = this._getActiveEnclaves();
    if (active.length === 0) {
      return {
        action: SCALE_ACTION.NO_ACTION,
        reason: "no-active-enclaves",
        avgLoad: 0,
      };
    }
    // Calculate predicted average load
    let predictedSum = 0;
    for (const e of active) {
      predictedSum += this.forecastLoad(e.id);
    }
    const predictedAvg = predictedSum / active.length;
    const currentAvg = this.getAverageLoad();
    const imbalance = this.getImbalance();
    // Check for rebalance first (cheaper than scaling)
    if (imbalance > this.rebalanceThreshold) {
      return {
        action: SCALE_ACTION.REBALANCE,
        reason: "imbalance-detected",
        imbalance,
        avgLoad: currentAvg,
        predictedAvg,
      };
    }
    // Scale up
    if (
      predictedAvg > this.scaleUpThreshold &&
      active.length < this.maxEnclaves
    ) {
      const targetCount = Math.min(
        this.maxEnclaves,
        Math.ceil(active.length * (predictedAvg / this.targetLoadPerEnclave)),
      );
      return {
        action: SCALE_ACTION.SCALE_UP,
        reason: "predicted-load-high",
        currentCount: active.length,
        targetCount,
        avgLoad: currentAvg,
        predictedAvg,
      };
    }
    // Scale down
    if (
      predictedAvg < this.scaleDownThreshold &&
      active.length > this.minEnclaves
    ) {
      const targetCount = Math.max(
        this.minEnclaves,
        Math.ceil(active.length * (predictedAvg / this.targetLoadPerEnclave)),
      );
      return {
        action: SCALE_ACTION.SCALE_DOWN,
        reason: "predicted-load-low",
        currentCount: active.length,
        targetCount,
        avgLoad: currentAvg,
        predictedAvg,
      };
    }
    return {
      action: SCALE_ACTION.NO_ACTION,
      reason: "load-within-bounds",
      avgLoad: currentAvg,
      predictedAvg,
      imbalance,
    };
  }

  /**
   * Execute a scaling action.
   * @param {object} decision - From evaluateScaling()
   * @param {object} [hooks] - Optional hooks for enclave management
   * @param {Function} [hooks.addEnclave] - async (enclaveId) => void
   * @param {Function} [hooks.removeEnclave] - async (enclaveId) => void
   * @returns {object} Execution result
   */
  executeScaling(decision, hooks) {
    if (!decision || decision.action === SCALE_ACTION.NO_ACTION) {
      return { executed: false, action: SCALE_ACTION.NO_ACTION };
    }
    const now = Date.now();
    const actionId = `scale-${now}-${Math.floor(Math.random() * 100000)}`;
    const action = {
      actionId,
      action: decision.action,
      status: SCALE_STATUS.IN_PROGRESS,
      startedAt: now,
      decision,
      affectedEnclaves: [],
    };
    this._currentAction = action;
    try {
      if (decision.action === SCALE_ACTION.SCALE_UP) {
        const toAdd = decision.targetCount - decision.currentCount;
        for (let i = 0; i < toAdd; i++) {
          const enclaveId = `auto-enclave-${now}-${i}`;
          if (hooks && typeof hooks.addEnclave === "function") {
            hooks.addEnclave(enclaveId);
          } else {
            this.registerEnclave(enclaveId);
          }
          action.affectedEnclaves.push(enclaveId);
        }
      } else if (decision.action === SCALE_ACTION.SCALE_DOWN) {
        const toRemove = decision.currentCount - decision.targetCount;
        // Remove least loaded enclaves first
        const sorted = this._getActiveEnclaves().sort(
          (a, b) => a.load - b.load,
        );
        for (let i = 0; i < toRemove && i < sorted.length; i++) {
          const enclaveId = sorted[i].id;
          if (hooks && typeof hooks.removeEnclave === "function") {
            hooks.removeEnclave(enclaveId);
          } else {
            this.unregisterEnclave(enclaveId);
          }
          action.affectedEnclaves.push(enclaveId);
        }
      } else if (decision.action === SCALE_ACTION.REBALANCE) {
        // Rebalance by redistributing load
        this._rebalanceShards();
      }
      action.status = SCALE_STATUS.COMPLETED;
      action.completedAt = Date.now();
      this._lastScalingAt = now;
    } catch (e) {
      action.status = SCALE_STATUS.FAILED;
      action.error = e.message;
      action.completedAt = Date.now();
    }
    this._currentAction = null;
    this._actionHistory.push({ ...action });
    if (this._actionHistory.length > this._maxActionHistory) {
      this._actionHistory.shift();
    }
    if (typeof this._audit === "function") {
      this._audit("SCALING_ACTION", {
        actionId,
        action: action.action,
        status: action.status,
      });
    }
    return {
      executed: true,
      actionId,
      action: action.action,
      status: action.status,
      affectedEnclaves: action.affectedEnclaves,
    };
  }

  /**
   * Register a shard for rebalancing tracking.
   * @param {string} shardId
   * @param {string[]} enclaveIds
   */
  registerShard(shardId, enclaveIds) {
    if (!shardId || typeof shardId !== "string") {
      throw new HsmAdapterError(
        "INVALID_SHARD",
        "shardId must be a non-empty string",
      );
    }
    if (this._shards.has(shardId)) {
      throw new HsmAdapterError(
        "SHARD_ALREADY_EXISTS",
        `shard ${shardId} already exists`,
      );
    }
    this._shards.set(shardId, {
      id: shardId,
      enclaveIds: new Set(enclaveIds || []),
    });
  }

  /**
   * Rebalance shards across enclaves to even out load.
   * @private
   */
  _rebalanceShards() {
    const active = this._getActiveEnclaves();
    if (active.length === 0) return;
    // Sort by load (descending) — most loaded enclaves shed shards
    const sorted = active.sort((a, b) => b.load - a.load);
    for (const [shardId, shard] of this._shards) {
      // Find the most loaded enclave that has this shard
      const mostLoaded = sorted.find((e) => shard.enclaveIds.has(e.id));
      // Find the least loaded enclave that doesn't have this shard
      const leastLoaded = [...sorted]
        .reverse()
        .find((e) => !shard.enclaveIds.has(e.id));
      if (
        mostLoaded &&
        leastLoaded &&
        mostLoaded.load - leastLoaded.load > this.rebalanceThreshold
      ) {
        shard.enclaveIds.delete(mostLoaded.id);
        shard.enclaveIds.add(leastLoaded.id);
      }
    }
  }

  /**
   * Trigger rescaling due to a chaos event (from Track 48).
   * @param {object} chaosEvent
   * @param {string} chaosEvent.targetEnclaveId
   * @param {string} chaosEvent.faultType
   * @returns {object} Rescaling response
   */
  onChaosEvent(chaosEvent) {
    if (!this.chaosTriggerEnabled) {
      return { triggered: false, reason: "chaos-trigger-disabled" };
    }
    if (!chaosEvent || !chaosEvent.targetEnclaveId) {
      return { triggered: false, reason: "invalid-event" };
    }
    const enclave = this._enclaves.get(chaosEvent.targetEnclaveId);
    if (enclave) {
      // Mark enclave as degraded
      enclave.status = "degraded";
    }
    // Force a scaling evaluation
    const decision = this.evaluateScaling();
    if (decision.action !== SCALE_ACTION.NO_ACTION) {
      const result = this.executeScaling(decision);
      return { triggered: true, chaosEvent, decision, result };
    }
    return {
      triggered: true,
      chaosEvent,
      decision,
      result: { executed: false },
    };
  }

  /**
   * Get all active enclaves.
   * @returns {object[]}
   * @private
   */
  _getActiveEnclaves() {
    return Array.from(this._enclaves.values()).filter(
      (e) => e.status === "active",
    );
  }

  /**
   * Get all registered enclaves.
   * @returns {object[]}
   */
  getEnclaves() {
    return Array.from(this._enclaves.values()).map((e) => ({
      id: e.id,
      capacity: e.capacity,
      load: e.load,
      status: e.status,
      addedAt: e.addedAt,
      predictedLoad: this.forecastLoad(e.id),
    }));
  }

  /**
   * Get load history for an enclave.
   * @param {string} enclaveId
   * @returns {object[]}
   */
  getLoadHistory(enclaveId) {
    return (this._loadHistory.get(enclaveId) || []).slice();
  }

  /**
   * Get all shards.
   * @returns {object[]}
   */
  getShards() {
    return Array.from(this._shards.values()).map((s) => ({
      id: s.id,
      enclaveIds: Array.from(s.enclaveIds),
    }));
  }

  /**
   * Get scaling action history.
   * @param {number} [limit]
   * @returns {object[]}
   */
  getActionHistory(limit) {
    const n = typeof limit === "number" ? limit : 20;
    return this._actionHistory.slice(-n).map((a) => ({
      actionId: a.actionId,
      action: a.action,
      status: a.status,
      startedAt: a.startedAt,
      completedAt: a.completedAt,
      affectedEnclaves: a.affectedEnclaves,
    }));
  }

  /**
   * Get summary statistics.
   * @returns {object}
   */
  getStats() {
    const active = this._getActiveEnclaves();
    return {
      enclaveCount: this._enclaves.size,
      activeEnclaves: active.length,
      averageLoad: this.getAverageLoad(),
      maxLoad: this.getMaxLoad(),
      imbalance: this.getImbalance(),
      predictedAverageLoad:
        active.length > 0
          ? active.reduce((sum, e) => sum + this.forecastLoad(e.id), 0) /
            active.length
          : 0,
      shardCount: this._shards.size,
      totalScalingActions: this._actionHistory.length,
      lastScalingAt: this._lastScalingAt || null,
      minEnclaves: this.minEnclaves,
      maxEnclaves: this.maxEnclaves,
    };
  }

  /**
   * Reset all state (for testing).
   */
  reset() {
    this._enclaves.clear();
    this._loadHistory.clear();
    this._shards.clear();
    this._actionHistory = [];
    this._lastScalingAt = 0;
    this._currentAction = null;
  }
}

module.exports = {
  DynamicEnclaveRescaler,
  DEFAULT_OPTIONS,
  SCALE_ACTION,
  SCALE_STATUS,
};
