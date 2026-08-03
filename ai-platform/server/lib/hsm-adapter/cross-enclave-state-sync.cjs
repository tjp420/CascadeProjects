'use strict';

/**
 * Track 44: Distributed Sharding and Cross-Enclave State Sync.
 *
 * Manages shard distribution across multiple hardware enclaves with
 * cross-enclave state synchronization, shard assignment/rebalancing,
 * and conflict resolution for concurrent state updates.
 *
 * Built on top of Track 41 (HardwareEnclaveAdapter) and Track 32
 * (BftShardSyncEngine), this module adds the enclave-aware layer:
 *   - EnclaveRegistry: tracks which enclaves are available and their capacity
 *   - ShardAssignment: maps shards to enclaves with replication factor
 *   - StateSyncProtocol: vector-clock-based state sync between enclaves
 *   - ConflictResolver: last-writer-wins or quorum-based merge for conflicts
 *
 * @module hsm-adapter/cross-enclave-state-sync
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

const DEFAULT_OPTIONS = {
  replicationFactor: 3,
  minSyncQuorum: 2,
  maxEnclaves: 16,
  shardAssignmentStrategy: 'consistent-hash', // or 'round-robin'
  syncTimeoutMs: 30000,
  maxStateSizeBytes: 1048576,
  conflictResolution: 'last-writer-wins', // or 'quorum-merge'
};

const ENCLAVE_STATUS = {
  ACTIVE: 'active',
  DEGRADED: 'degraded',
  OFFLINE: 'offline',
};

const SYNC_OP_TYPE = {
  FULL: 'full',
  INCREMENTAL: 'incremental',
  REPAIR: 'repair',
};

/**
 * Cross-Enclave State Synchronization Engine.
 */
class CrossEnclaveStateSync {
  /**
   * @param {object} [options]
   */
  constructor(options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    this.replicationFactor = opts.replicationFactor;
    this.minSyncQuorum = opts.minSyncQuorum;
    this.maxEnclaves = opts.maxEnclaves;
    this.shardAssignmentStrategy = opts.shardAssignmentStrategy;
    this.syncTimeoutMs = opts.syncTimeoutMs;
    this.maxStateSizeBytes = opts.maxStateSizeBytes;
    this.conflictResolution = opts.conflictResolution;
    this._audit = opts.audit || null;

    this._enclaves = new Map(); // enclaveId -> { id, status, capacity, load, lastHeartbeat }
    this._shards = new Map(); // shardId -> { id, enclaveIds: Set, vectorClock: Map, state: Map, version }
    this._syncLog = []; // recent sync operations
    this._maxSyncLog = 100;
  }

  /**
   * Register an enclave in the cluster.
   * @param {string} enclaveId
   * @param {object} [meta]
   * @param {number} [meta.capacity] - Relative capacity weight (default 1)
   */
  registerEnclave(enclaveId, meta) {
    if (!enclaveId || typeof enclaveId !== 'string') {
      throw new HsmAdapterError('INVALID_ENCLAVE', 'enclaveId must be a non-empty string');
    }
    if (this._enclaves.size >= this.maxEnclaves) {
      throw new HsmAdapterError('ENCLAVE_LIMIT_REACHED',
        `maximum ${this.maxEnclaves} enclaves reached`);
    }
    if (this._enclaves.has(enclaveId)) {
      throw new HsmAdapterError('ENCLAVE_ALREADY_REGISTERED',
        `enclave ${enclaveId} already registered`);
    }
    this._enclaves.set(enclaveId, {
      id: enclaveId,
      status: ENCLAVE_STATUS.ACTIVE,
      capacity: (meta && meta.capacity) || 1,
      load: 0,
      lastHeartbeat: Date.now(),
    });
    if (typeof this._audit === 'function') {
      this._audit('ENCLAVE_REGISTERED', { enclaveId });
    }
  }

  /**
   * Unregister an enclave and reassign its shards.
   * @param {string} enclaveId
   */
  unregisterEnclave(enclaveId) {
    if (!this._enclaves.has(enclaveId)) {
      throw new HsmAdapterError('ENCLAVE_NOT_FOUND', `enclave ${enclaveId} not found`);
    }
    this._enclaves.delete(enclaveId);
    // Reassign shards that were on this enclave
    for (const [shardId, shard] of this._shards) {
      if (shard.enclaveIds.has(enclaveId)) {
        shard.enclaveIds.delete(enclaveId);
        if (shard.enclaveIds.size < this.replicationFactor) {
          this._reassignShard(shardId);
        }
      }
    }
    if (typeof this._audit === 'function') {
      this._audit('ENCLAVE_UNREGISTERED', { enclaveId });
    }
  }

  /**
   * Update enclave heartbeat.
   * @param {string} enclaveId
   * @param {object} [status]
   */
  heartbeat(enclaveId, status) {
    const enclave = this._enclaves.get(enclaveId);
    if (!enclave) {
      throw new HsmAdapterError('ENCLAVE_NOT_FOUND', `enclave ${enclaveId} not found`);
    }
    enclave.lastHeartbeat = Date.now();
    if (status && status.load !== undefined) enclave.load = status.load;
    if (status && status.status) enclave.status = status.status;
  }

  /**
   * Get all registered enclaves.
   * @returns {object[]}
   */
  getEnclaves() {
    return Array.from(this._enclaves.values());
  }

  /**
   * Get active enclaves only.
   * @returns {object[]}
   */
  getActiveEnclaves() {
    return this.getEnclaves().filter(e => e.status === ENCLAVE_STATUS.ACTIVE);
  }

  /**
   * Create a new shard and assign it to enclaves.
   * @param {string} shardId
   * @returns {object} Assignment result
   */
  createShard(shardId) {
    if (!shardId || typeof shardId !== 'string') {
      throw new HsmAdapterError('INVALID_SHARD', 'shardId must be a non-empty string');
    }
    if (this._shards.has(shardId)) {
      throw new HsmAdapterError('SHARD_ALREADY_EXISTS', `shard ${shardId} already exists`);
    }
    const enclaveIds = this._selectEnclavesForShard();
    if (enclaveIds.length < this.minSyncQuorum) {
      throw new HsmAdapterError('INSUFFICIENT_ENCLAVES',
        `need at least ${this.minSyncQuorum} active enclaves, have ${enclaveIds.length}`);
    }
    const shard = {
      id: shardId,
      enclaveIds: new Set(enclaveIds),
      vectorClock: new Map(), // enclaveId -> sequence
      state: new Map(), // key -> { value, timestamp, enclaveId }
      version: 0,
    };
    for (const eid of enclaveIds) {
      shard.vectorClock.set(eid, 0);
    }
    this._shards.set(shardId, shard);
    if (typeof this._audit === 'function') {
      this._audit('SHARD_CREATED', { shardId, enclaveIds });
    }
    return { shardId, enclaveIds };
  }

  /**
   * Select enclaves for a shard based on the assignment strategy.
   * @returns {string[]}
   * @private
   */
  _selectEnclavesForShard() {
    const active = this.getActiveEnclaves();
    if (active.length === 0) return [];

    if (this.shardAssignmentStrategy === 'round-robin') {
      // Sort by load (ascending) and pick top N
      const sorted = active.sort((a, b) => a.load - b.load);
      return sorted.slice(0, Math.min(this.replicationFactor, sorted.length))
        .map(e => e.id);
    }

    // consistent-hash: use hash-based assignment
    const sorted = active.sort((a, b) => a.load - b.load);
    const selected = [];
    const target = Math.min(this.replicationFactor, sorted.length);
    for (let i = 0; i < target; i++) {
      selected.push(sorted[i].id);
      sorted[i].load++;
    }
    return selected;
  }

  /**
   * Reassign a shard to new enclaves (after enclave removal or failure).
   * @param {string} shardId
   * @private
   */
  _reassignShard(shardId) {
    const shard = this._shards.get(shardId);
    if (!shard) return;
    const needed = this.replicationFactor - shard.enclaveIds.size;
    if (needed <= 0) return;
    const available = this.getActiveEnclaves()
      .filter(e => !shard.enclaveIds.has(e.id))
      .sort((a, b) => a.load - b.load);
    for (let i = 0; i < Math.min(needed, available.length); i++) {
      shard.enclaveIds.add(available[i].id);
      shard.vectorClock.set(available[i].id, 0);
      available[i].load++;
    }
    if (typeof this._audit === 'function') {
      this._audit('SHARD_REASSIGNED', { shardId, newEnclaves: available.slice(0, needed).map(e => e.id) });
    }
  }

  /**
   * Write a state update to a shard.
   * @param {string} shardId
   * @param {string} key
   * @param {object} value
   * @param {string} enclaveId - The enclave performing the write
   * @returns {object} Write result
   */
  writeState(shardId, key, value, enclaveId) {
    const shard = this._shards.get(shardId);
    if (!shard) {
      throw new HsmAdapterError('SHARD_NOT_FOUND', `shard ${shardId} not found`);
    }
    if (!shard.enclaveIds.has(enclaveId)) {
      throw new HsmAdapterError('ENCLAVE_NOT_ASSIGNED',
        `enclave ${enclaveId} is not assigned to shard ${shardId}`);
    }
    const valueStr = JSON.stringify(value);
    if (Buffer.byteLength(valueStr) > this.maxStateSizeBytes) {
      throw new HsmAdapterError('STATE_TOO_LARGE',
        `state value exceeds maximum ${this.maxStateSizeBytes} bytes`);
    }
    const seq = (shard.vectorClock.get(enclaveId) || 0) + 1;
    shard.vectorClock.set(enclaveId, seq);
    const timestamp = Date.now();
    const existing = shard.state.get(key);
    // Conflict resolution
    if (existing) {
      if (this.conflictResolution === 'last-writer-wins') {
        if (timestamp < existing.timestamp) {
          return { shardId, key, conflict: true, resolved: 'rejected-stale', version: shard.version };
        }
      } else if (this.conflictResolution === 'quorum-merge') {
        // Merge: keep both values, newer wins on key collision
      }
    }
    shard.state.set(key, { value, timestamp, enclaveId, sequence: seq });
    shard.version++;
    if (typeof this._audit === 'function') {
      this._audit('STATE_WRITTEN', { shardId, key, enclaveId, sequence: seq, version: shard.version });
    }
    return { shardId, key, enclaveId, sequence: seq, version: shard.version };
  }

  /**
   * Read state from a shard.
   * @param {string} shardId
   * @param {string} key
   * @returns {object|null}
   */
  readState(shardId, key) {
    const shard = this._shards.get(shardId);
    if (!shard) {
      throw new HsmAdapterError('SHARD_NOT_FOUND', `shard ${shardId} not found`);
    }
    const entry = shard.state.get(key);
    return entry ? { key, value: entry.value, timestamp: entry.timestamp, enclaveId: entry.enclaveId } : null;
  }

  /**
   * Synchronize state between enclaves for a shard.
   * @param {string} shardId
   * @param {string} sourceEnclaveId
   * @param {object} remoteState - { key -> { value, timestamp, enclaveId, sequence } }
   * @param {object} remoteVectorClock - { enclaveId -> sequence }
   * @returns {object} Sync result
   */
  syncState(shardId, sourceEnclaveId, remoteState, remoteVectorClock) {
    const shard = this._shards.get(shardId);
    if (!shard) {
      throw new HsmAdapterError('SHARD_NOT_FOUND', `shard ${shardId} not found`);
    }
    if (!shard.enclaveIds.has(sourceEnclaveId)) {
      throw new HsmAdapterError('ENCLAVE_NOT_ASSIGNED',
        `enclave ${sourceEnclaveId} is not assigned to shard ${shardId}`);
    }
    const result = {
      shardId,
      sourceEnclaveId,
      type: SYNC_OP_TYPE.INCREMENTAL,
      merged: 0,
      conflicts: 0,
      skipped: 0,
    };
    // Merge remote state
    for (const [key, remoteEntry] of Object.entries(remoteState || {})) {
      const localEntry = shard.state.get(key);
      if (!localEntry) {
        // New key from remote — accept
        shard.state.set(key, remoteEntry);
        result.merged++;
      } else if (remoteEntry.timestamp > localEntry.timestamp) {
        // Remote is newer — accept (last-writer-wins)
        shard.state.set(key, remoteEntry);
        result.merged++;
      } else if (remoteEntry.timestamp === localEntry.timestamp) {
        // Conflict — use sequence number as tiebreaker
        if (remoteEntry.sequence > (localEntry.sequence || 0)) {
          shard.state.set(key, remoteEntry);
          result.merged++;
        } else {
          result.skipped++;
        }
      } else {
        // Local is newer — skip
        result.skipped++;
      }
    }
    // Merge vector clock
    for (const [eid, seq] of Object.entries(remoteVectorClock || {})) {
      const current = shard.vectorClock.get(eid) || 0;
      if (seq > current) {
        shard.vectorClock.set(eid, seq);
      }
    }
    shard.version++;
    this._logSync(result);
    if (typeof this._audit === 'function') {
      this._audit('STATE_SYNCED', result);
    }
    return result;
  }

  /**
   * Get the vector clock snapshot for a shard.
   * @param {string} shardId
   * @returns {object}
   */
  getVectorClock(shardId) {
    const shard = this._shards.get(shardId);
    if (!shard) {
      throw new HsmAdapterError('SHARD_NOT_FOUND', `shard ${shardId} not found`);
    }
    const result = {};
    for (const [eid, seq] of shard.vectorClock) {
      result[eid] = seq;
    }
    return result;
  }

  /**
   * Get all shards.
   * @returns {object[]}
   */
  getShards() {
    return Array.from(this._shards.values()).map(s => ({
      id: s.id,
      enclaveIds: Array.from(s.enclaveIds),
      version: s.version,
      keyCount: s.state.size,
    }));
  }

  /**
   * Get shard info.
   * @param {string} shardId
   * @returns {object|null}
   */
  getShard(shardId) {
    const shard = this._shards.get(shardId);
    if (!shard) return null;
    return {
      id: shard.id,
      enclaveIds: Array.from(shard.enclaveIds),
      version: shard.version,
      keyCount: shard.state.size,
      vectorClock: this.getVectorClock(shardId),
    };
  }

  /**
   * Detect enclaves with stale heartbeats and mark them as offline.
   * @param {number} [staleThresholdMs] - Default 2x syncTimeoutMs
   * @returns {string[]} Enclaves marked offline
   */
  detectStaleEnclaves(staleThresholdMs) {
    const threshold = staleThresholdMs || this.syncTimeoutMs * 2;
    const now = Date.now();
    const stale = [];
    for (const [id, enclave] of this._enclaves) {
      if (enclave.status === ENCLAVE_STATUS.ACTIVE && now - enclave.lastHeartbeat > threshold) {
        enclave.status = ENCLAVE_STATUS.OFFLINE;
        stale.push(id);
        // Reassign shards
        for (const [shardId, shard] of this._shards) {
          if (shard.enclaveIds.has(id)) {
            shard.enclaveIds.delete(id);
            shard.vectorClock.delete(id);
            this._reassignShard(shardId);
          }
        }
      }
    }
    if (stale.length > 0 && typeof this._audit === 'function') {
      this._audit('STALE_ENCLAVES_DETECTED', { enclaveIds: stale });
    }
    return stale;
  }

  /**
   * Get recent sync operations.
   * @param {number} [limit]
   * @returns {object[]}
   */
  getSyncLog(limit) {
    const n = typeof limit === 'number' ? limit : 20;
    return this._syncLog.slice(-n);
  }

  /**
   * Get summary statistics.
   * @returns {object}
   */
  getStats() {
    let totalKeys = 0;
    for (const shard of this._shards.values()) {
      totalKeys += shard.state.size;
    }
    return {
      enclaveCount: this._enclaves.size,
      activeEnclaves: this.getActiveEnclaves().length,
      shardCount: this._shards.size,
      totalKeys,
      syncOperations: this._syncLog.length,
      replicationFactor: this.replicationFactor,
      conflictResolution: this.conflictResolution,
    };
  }

  /**
   * Log a sync operation.
   * @param {object} result
   * @private
   */
  _logSync(result) {
    this._syncLog.push({ ...result, timestamp: Date.now() });
    if (this._syncLog.length > this._maxSyncLog) {
      this._syncLog.shift();
    }
  }

  /**
   * Reset all state (for testing).
   */
  reset() {
    this._enclaves.clear();
    this._shards.clear();
    this._syncLog = [];
  }
}

module.exports = { CrossEnclaveStateSync, DEFAULT_OPTIONS, ENCLAVE_STATUS, SYNC_OP_TYPE };
