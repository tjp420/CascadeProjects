'use strict';

/**
 * Track 48: Enclave Fault Injection and Byzantine Chaos Testing.
 *
 * Provides a controlled framework for injecting faults into the enclave
 * cluster to validate the resilience of Tracks 41-47. Simulates byzantine
 * behavior, network partitions, enclave crashes, key corruption, and
 * timing attacks in a deterministic, reproducible manner.
 *
 * Components:
 *   - FaultInjector: Injects specific fault types into target enclaves
 *   - ByzantineSimulator: Simulates byzantine behavior (equivocation, omission)
 *   - ChaosScheduler: Schedules random fault injections with configurable probability
 *   - FaultRecoveryValidator: Validates that the system recovers correctly
 *   - ScenarioRunner: Runs predefined fault scenarios with deterministic seeds
 *
 * @module hsm-adapter/enclave-fault-injection
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

const DEFAULT_OPTIONS = {
  maxConcurrentFaults: 10,
  defaultFaultDurationMs: 5000,
  maxFaultDurationMs: 60000,
  chaosProbability: 0.1,
  chaosIntervalMs: 1000,
  deterministicSeed: null,
  enableByzantineFaults: true,
  enableNetworkPartitions: true,
  enableCrashFaults: true,
  enableKeyCorruption: true,
  enableTimingAttacks: true,
  // Track 127: Mesh partition fuzzing options
  enableGossipPacketDrop: true,
  enableSplitBrainPartition: true,
  enableNetworkJitter: true,
  gossipDropRate: 0.1,
  splitBrainDurationMs: 10000,
  networkJitterMs: 100,
  recoveryTimeoutMs: 30000,
};

const FAULT_TYPE = {
  BYZANTINE_EQUIVOCATION: 'byzantine-equivocation',
  BYZANTINE_OMISSION: 'byzantine-omission',
  NETWORK_PARTITION: 'network-partition',
  ENCLAVE_CRASH: 'enclave-crash',
  KEY_CORRUPTION: 'key-corruption',
  TIMING_ATTACK: 'timing-attack',
  HEARTBEAT_LOSS: 'heartbeat-loss',
  STATE_DIVERGENCE: 'state-divergence',
  // Track 127: Chaos & Mesh Partition Fuzzing fault types
  GOSSIP_PACKET_DROP: 'gossip-packet-drop',
  SPLIT_BRAIN_PARTITION: 'split-brain-partition',
  NETWORK_JITTER: 'network-jitter',
};

const FAULT_STATUS = {
  INJECTED: 'injected',
  ACTIVE: 'active',
  RESOLVED: 'resolved',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
};

const SCENARIO_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

/**
 * Enclave Fault Injection and Byzantine Chaos Testing Engine.
 */
class EnclaveFaultInjection {
  /**
   * @param {object} [options]
   */
  constructor(options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    this.maxConcurrentFaults = opts.maxConcurrentFaults;
    this.defaultFaultDurationMs = opts.defaultFaultDurationMs;
    this.maxFaultDurationMs = opts.maxFaultDurationMs;
    this.chaosProbability = opts.chaosProbability;
    this.chaosIntervalMs = opts.chaosIntervalMs;
    this.deterministicSeed = opts.deterministicSeed;
    this.enableByzantineFaults = opts.enableByzantineFaults;
    this.enableNetworkPartitions = opts.enableNetworkPartitions;
    this.enableCrashFaults = opts.enableCrashFaults;
    this.enableKeyCorruption = opts.enableKeyCorruption;
    this.enableTimingAttacks = opts.enableTimingAttacks;
    this.enableGossipPacketDrop = opts.enableGossipPacketDrop;
    this.enableSplitBrainPartition = opts.enableSplitBrainPartition;
    this.enableNetworkJitter = opts.enableNetworkJitter;
    this.gossipDropRate = opts.gossipDropRate;
    this.splitBrainDurationMs = opts.splitBrainDurationMs;
    this.networkJitterMs = opts.networkJitterMs;
    this.recoveryTimeoutMs = opts.recoveryTimeoutMs;
    this._audit = opts.audit || null;

    this._activeFaults = new Map(); // faultId -> fault state
    this._faultHistory = []; // completed faults
    this._maxHistory = 500;
    this._scenarios = new Map(); // scenarioId -> scenario state
    this._prng = this._createPrng();
  }

  /**
   * Create a deterministic PRNG if seed is provided.
   * @returns {object}
   * @private
   */
  _createPrng() {
    if (this.deterministicSeed !== null) {
      let state = crypto.createHash('sha256').update(String(this.deterministicSeed)).digest();
      return {
        next: () => {
          state = crypto.createHash('sha256').update(state).digest();
          return state.readUInt32BE(0) / 0xFFFFFFFF;
        },
        nextInt: (max) => Math.floor(this._prng.next() * max),
      };
    }
    return {
      next: () => Math.random(),
      nextInt: (max) => Math.floor(Math.random() * max),
    };
  }

  /**
   * Inject a specific fault into a target enclave.
   * @param {object} config
   * @param {string} config.faultType - One of FAULT_TYPE
   * @param {string} config.targetEnclaveId - Target enclave
   * @param {number} [config.durationMs] - Fault duration
   * @param {object} [config.params] - Fault-specific parameters
   * @returns {object} Injected fault state
   */
  injectFault(config) {
    if (!config || typeof config !== 'object') {
      throw new HsmAdapterError('INVALID_CONFIG', 'fault config is required');
    }
    if (!config.faultType || !Object.values(FAULT_TYPE).includes(config.faultType)) {
      throw new HsmAdapterError('INVALID_FAULT_TYPE', `faultType must be one of: ${Object.values(FAULT_TYPE).join(', ')}`);
    }
    if (!config.targetEnclaveId || typeof config.targetEnclaveId !== 'string') {
      throw new HsmAdapterError('INVALID_TARGET', 'targetEnclaveId must be a non-empty string');
    }
    this._validateFaultEnabled(config.faultType);
    if (this._activeFaults.size >= this.maxConcurrentFaults) {
      throw new HsmAdapterError('MAX_CONCURRENT_FAULTS',
        `maximum ${this.maxConcurrentFaults} concurrent faults reached`);
    }
    const durationMs = Math.min(config.durationMs || this.defaultFaultDurationMs, this.maxFaultDurationMs);
    const faultId = _generateId('fault', config.faultType, Date.now(), this._prng);
    const now = Date.now();
    const fault = {
      faultId,
      faultType: config.faultType,
      targetEnclaveId: config.targetEnclaveId,
      status: FAULT_STATUS.INJECTED,
      injectedAt: now,
      expiresAt: now + durationMs,
      durationMs,
      params: config.params || {},
      effects: _getFaultEffects(config.faultType, config.params),
      recoveryActions: _getRecoveryActions(config.faultType),
    };
    fault.status = FAULT_STATUS.ACTIVE;
    this._activeFaults.set(faultId, fault);
    if (typeof this._audit === 'function') {
      this._audit('FAULT_INJECTED', {
        faultId,
        faultType: fault.faultType,
        targetEnclaveId: fault.targetEnclaveId,
        durationMs,
      });
    }
    return {
      faultId,
      faultType: fault.faultType,
      targetEnclaveId: fault.targetEnclaveId,
      status: fault.status,
      effects: fault.effects,
    };
  }

  /**
   * Validate that a fault type is enabled.
   * @param {string} faultType
   * @private
   */
  _validateFaultEnabled(faultType) {
    const checks = {
      [FAULT_TYPE.BYZANTINE_EQUIVOCATION]: this.enableByzantineFaults,
      [FAULT_TYPE.BYZANTINE_OMISSION]: this.enableByzantineFaults,
      [FAULT_TYPE.NETWORK_PARTITION]: this.enableNetworkPartitions,
      [FAULT_TYPE.ENCLAVE_CRASH]: this.enableCrashFaults,
      [FAULT_TYPE.KEY_CORRUPTION]: this.enableKeyCorruption,
      [FAULT_TYPE.TIMING_ATTACK]: this.enableTimingAttacks,
      [FAULT_TYPE.HEARTBEAT_LOSS]: this.enableCrashFaults,
      [FAULT_TYPE.STATE_DIVERGENCE]: this.enableByzantineFaults,
      [FAULT_TYPE.GOSSIP_PACKET_DROP]: this.enableGossipPacketDrop,
      [FAULT_TYPE.SPLIT_BRAIN_PARTITION]: this.enableSplitBrainPartition,
      [FAULT_TYPE.NETWORK_JITTER]: this.enableNetworkJitter,
    };
    if (checks[faultType] === false) {
      throw new HsmAdapterError('FAULT_TYPE_DISABLED',
        `fault type ${faultType} is disabled`);
    }
  }

  /**
   * Cancel an active fault.
   * @param {string} faultId
   * @returns {object} Cancellation result
   */
  cancelFault(faultId) {
    const fault = this._activeFaults.get(faultId);
    if (!fault) {
      throw new HsmAdapterError('FAULT_NOT_FOUND', `fault ${faultId} not found`);
    }
    fault.status = FAULT_STATUS.CANCELLED;
    fault.resolvedAt = Date.now();
    this._activeFaults.delete(faultId);
    this._addToHistory(fault);
    if (typeof this._audit === 'function') {
      this._audit('FAULT_CANCELLED', { faultId, faultType: fault.faultType });
    }
    return { faultId, cancelled: true };
  }

  /**
   * Resolve an active fault (mark as resolved).
   * @param {string} faultId
   * @returns {object} Resolution result
   */
  resolveFault(faultId) {
    const fault = this._activeFaults.get(faultId);
    if (!fault) {
      throw new HsmAdapterError('FAULT_NOT_FOUND', `fault ${faultId} not found`);
    }
    fault.status = FAULT_STATUS.RESOLVED;
    fault.resolvedAt = Date.now();
    this._activeFaults.delete(faultId);
    this._addToHistory(fault);
    if (typeof this._audit === 'function') {
      this._audit('FAULT_RESOLVED', { faultId, faultType: fault.faultType });
    }
    return { faultId, resolved: true };
  }

  /**
   * Check for expired faults and move them to history.
   * @returns {string[]} List of expired fault IDs
   */
  checkExpiredFaults() {
    const now = Date.now();
    const expired = [];
    for (const [faultId, fault] of this._activeFaults) {
      if (now > fault.expiresAt) {
        fault.status = FAULT_STATUS.EXPIRED;
        fault.resolvedAt = now;
        this._activeFaults.delete(faultId);
        this._addToHistory(fault);
        expired.push(faultId);
        if (typeof this._audit === 'function') {
          this._audit('FAULT_EXPIRED', { faultId, faultType: fault.faultType });
        }
      }
    }
    return expired;
  }

  /**
   * Run a chaos step — randomly inject faults with configured probability.
   * @param {string[]} targetEnclaveIds - Available enclaves to target
   * @returns {object[]} Injected faults (may be empty)
   */
  chaosStep(targetEnclaveIds) {
    if (!Array.isArray(targetEnclaveIds) || targetEnclaveIds.length === 0) {
      return [];
    }
    const injected = [];
    for (const enclaveId of targetEnclaveIds) {
      if (this._prng.next() < this.chaosProbability) {
        const faultType = _pickRandomFaultType(this._prng, {
          byzantine: this.enableByzantineFaults,
          network: this.enableNetworkPartitions,
          crash: this.enableCrashFaults,
          keyCorruption: this.enableKeyCorruption,
          timing: this.enableTimingAttacks,
        });
        if (!faultType) continue;
        try {
          const result = this.injectFault({
            faultType,
            targetEnclaveId: enclaveId,
            durationMs: this.defaultFaultDurationMs,
          });
          injected.push(result);
        } catch (e) {
          // Skip if max concurrent reached
        }
      }
    }
    return injected;
  }

  /**
   * Create and run a predefined fault scenario.
   * @param {object} scenario
   * @param {string} scenario.name - Scenario name
   * @param {object[]} scenario.steps - Array of fault injection steps
   * @param {string} scenario.steps[].faultType
   * @param {string} scenario.steps[].targetEnclaveId
   * @param {number} [scenario.steps[].delayMs] - Delay before this step
   * @param {number} [scenario.steps[].durationMs]
   * @returns {object} Scenario execution result
   */
  runScenario(scenario) {
    if (!scenario || !scenario.name || !Array.isArray(scenario.steps)) {
      throw new HsmAdapterError('INVALID_SCENARIO', 'scenario must have name and steps');
    }
    const scenarioId = _generateId('scenario', scenario.name, Date.now(), this._prng);
    const state = {
      scenarioId,
      name: scenario.name,
      status: SCENARIO_STATUS.RUNNING,
      steps: scenario.steps.length,
      completedSteps: 0,
      injectedFaults: [],
      startedAt: Date.now(),
      finishedAt: null,
      errors: [],
    };
    this._scenarios.set(scenarioId, state);
    // Execute steps synchronously (delays are recorded but not waited in test mode)
    for (let i = 0; i < scenario.steps.length; i++) {
      const step = scenario.steps[i];
      try {
        const result = this.injectFault({
          faultType: step.faultType,
          targetEnclaveId: step.targetEnclaveId,
          durationMs: step.durationMs,
          params: step.params,
        });
        state.injectedFaults.push(result);
        state.completedSteps++;
      } catch (e) {
        state.errors.push({ step: i, error: e.message });
      }
    }
    state.status = state.errors.length > 0 ? SCENARIO_STATUS.FAILED : SCENARIO_STATUS.COMPLETED;
    state.finishedAt = Date.now();
    if (typeof this._audit === 'function') {
      this._audit('SCENARIO_COMPLETED', {
        scenarioId,
        name: scenario.name,
        status: state.status,
        completedSteps: state.completedSteps,
      });
    }
    return {
      scenarioId,
      name: scenario.name,
      status: state.status,
      completedSteps: state.completedSteps,
      totalSteps: state.steps,
      injectedFaults: state.injectedFaults,
      errors: state.errors,
    };
  }

  /**
   * Validate that the system has recovered from all active faults.
   * @returns {object} Recovery validation result
   */
  validateRecovery() {
    const activeCount = this._activeFaults.size;
    const resolvedCount = this._faultHistory.filter(f => f.status === FAULT_STATUS.RESOLVED).length;
    const expiredCount = this._faultHistory.filter(f => f.status === FAULT_STATUS.EXPIRED).length;
    const cancelledCount = this._faultHistory.filter(f => f.status === FAULT_STATUS.CANCELLED).length;
    const isRecovered = activeCount === 0;
    return {
      recovered: isRecovered,
      activeFaults: activeCount,
      resolvedFaults: resolvedCount,
      expiredFaults: expiredCount,
      cancelledFaults: cancelledCount,
      totalHistory: this._faultHistory.length,
    };
  }

  /**
   * Get an active fault by ID.
   * @param {string} faultId
   * @returns {object|null}
   */
  getFault(faultId) {
    const fault = this._activeFaults.get(faultId);
    if (fault) return { ...fault };
    const historical = this._faultHistory.find(f => f.faultId === faultId);
    return historical ? { ...historical } : null;
  }

  /**
   * Get all active faults.
   * @returns {object[]}
   */
  getActiveFaults() {
    return Array.from(this._activeFaults.values()).map(f => ({
      faultId: f.faultId,
      faultType: f.faultType,
      targetEnclaveId: f.targetEnclaveId,
      status: f.status,
      injectedAt: f.injectedAt,
      expiresAt: f.expiresAt,
      effects: f.effects,
    }));
  }

  /**
   * Get fault history.
   * @param {number} [limit]
   * @returns {object[]}
   */
  getFaultHistory(limit) {
    const n = typeof limit === 'number' ? limit : 50;
    return this._faultHistory.slice(-n).map(f => ({
      faultId: f.faultId,
      faultType: f.faultType,
      targetEnclaveId: f.targetEnclaveId,
      status: f.status,
      injectedAt: f.injectedAt,
      resolvedAt: f.resolvedAt,
    }));
  }

  /**
   * Get scenario result.
   * @param {string} scenarioId
   * @returns {object|null}
   */
  getScenario(scenarioId) {
    const s = this._scenarios.get(scenarioId);
    if (!s) return null;
    return {
      scenarioId: s.scenarioId,
      name: s.name,
      status: s.status,
      steps: s.steps,
      completedSteps: s.completedSteps,
      startedAt: s.startedAt,
      finishedAt: s.finishedAt,
      errors: s.errors,
    };
  }

  /**
   * Get summary statistics.
   * @returns {object}
   */
  getStats() {
    const byType = {};
    const byStatus = {};
    for (const f of this._activeFaults.values()) {
      byType[f.faultType] = (byType[f.faultType] || 0) + 1;
      byStatus[f.status] = (byStatus[f.status] || 0) + 1;
    }
    for (const f of this._faultHistory) {
      byStatus[f.status] = (byStatus[f.status] || 0) + 1;
    }
    return {
      activeFaults: this._activeFaults.size,
      totalHistory: this._faultHistory.length,
      totalScenarios: this._scenarios.size,
      byType,
      byStatus,
      chaosProbability: this.chaosProbability,
      deterministicMode: this.deterministicSeed !== null,
    };
  }

  /**
   * Add a fault to history.
   * @param {object} fault
   * @private
   */
  _addToHistory(fault) {
    this._faultHistory.push({ ...fault });
    if (this._faultHistory.length > this._maxHistory) {
      this._faultHistory.shift();
    }
  }

  /**
   * Reset all state (for testing).
   */
  reset() {
    this._activeFaults.clear();
    this._faultHistory = [];
    this._scenarios.clear();
    this._prng = this._createPrng();
  }
}

function _generateId(prefix, type, timestamp, prng) {
  const rand = prng ? prng.nextInt(1000000) : Math.floor(Math.random() * 1000000);
  return `${prefix}-${type}-${timestamp}-${rand}`;
}

function _getFaultEffects(faultType, params) {
  const effects = {
    [FAULT_TYPE.BYZANTINE_EQUIVOCATION]: ['conflicting-responses', 'quorum-disruption'],
    [FAULT_TYPE.BYZANTINE_OMISSION]: ['dropped-messages', 'silent-failure'],
    [FAULT_TYPE.NETWORK_PARTITION]: ['isolation', 'communication-loss'],
    [FAULT_TYPE.ENCLAVE_CRASH]: ['process-termination', 'state-loss'],
    [FAULT_TYPE.KEY_CORRUPTION]: ['key-material-altered', 'signature-invalid'],
    [FAULT_TYPE.TIMING_ATTACK]: ['timing-leak', 'side-channel'],
    [FAULT_TYPE.HEARTBEAT_LOSS]: ['heartbeat-timeout', 'quarantine-trigger'],
    [FAULT_TYPE.STATE_DIVERGENCE]: ['inconsistent-state', 'sync-conflict'],
    [FAULT_TYPE.GOSSIP_PACKET_DROP]: ['dropped-gossip', 'delayed-sync', 'stale-quorum'],
    [FAULT_TYPE.SPLIT_BRAIN_PARTITION]: ['dual-leader', 'quorum-split', 'divergent-logs'],
    [FAULT_TYPE.NETWORK_JITTER]: ['latency-spike', 'timeout-flap', 'heartbeat-jitter'],
  };
  return effects[faultType] || ['unknown-effect'];
}

function _getRecoveryActions(faultType) {
  const actions = {
    [FAULT_TYPE.BYZANTINE_EQUIVOCATION]: ['quarantine-node', 're-sync-state'],
    [FAULT_TYPE.BYZANTINE_OMISSION]: ['retry-messages', 'check-liveness'],
    [FAULT_TYPE.NETWORK_PARTITION]: ['heal-partition', 'reconcile-state'],
    [FAULT_TYPE.ENCLAVE_CRASH]: ['restart-enclave', 'restore-from-backup'],
    [FAULT_TYPE.KEY_CORRUPTION]: ['rotate-key', 're-attest-enclave'],
    [FAULT_TYPE.TIMING_ATTACK]: ['add-jitter', 'constant-time-ops'],
    [FAULT_TYPE.HEARTBEAT_LOSS]: ['force-heartbeat', 'check-quarantine'],
    [FAULT_TYPE.STATE_DIVERGENCE]: ['force-sync', 'resolve-conflicts'],
    [FAULT_TYPE.GOSSIP_PACKET_DROP]: ['retry-gossip', 'increase-timeout', 'reconcile-state'],
    [FAULT_TYPE.SPLIT_BRAIN_PARTITION]: ['force-quorum-revote', 'merge-divergent-logs', 'heal-partition'],
    [FAULT_TYPE.NETWORK_JITTER]: ['stabilize-timers', 'adjust-heartbeat-interval'],
  };
  return actions[faultType] || ['unknown-recovery'];
}

function _pickRandomFaultType(prng, enabled) {
  const types = [];
  if (enabled.byzantine) {
    types.push(FAULT_TYPE.BYZANTINE_EQUIVOCATION, FAULT_TYPE.BYZANTINE_OMISSION, FAULT_TYPE.STATE_DIVERGENCE);
  }
  if (enabled.network) types.push(FAULT_TYPE.NETWORK_PARTITION);
  if (enabled.crash) types.push(FAULT_TYPE.ENCLAVE_CRASH, FAULT_TYPE.HEARTBEAT_LOSS);
  if (enabled.keyCorruption) types.push(FAULT_TYPE.KEY_CORRUPTION);
  if (enabled.timing) types.push(FAULT_TYPE.TIMING_ATTACK);
  if (enabled.gossipDrop) types.push(FAULT_TYPE.GOSSIP_PACKET_DROP);
  if (enabled.splitBrain) types.push(FAULT_TYPE.SPLIT_BRAIN_PARTITION);
  if (enabled.networkJitter) types.push(FAULT_TYPE.NETWORK_JITTER);
  if (types.length === 0) return null;
  return types[prng.nextInt(types.length)];
}

module.exports = {
  EnclaveFaultInjection,
  DEFAULT_OPTIONS,
  FAULT_TYPE,
  FAULT_STATUS,
  SCENARIO_STATUS,
};
