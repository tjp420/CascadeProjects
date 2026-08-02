'use strict';

/**
 * Track 32: BFT Shard Sync.
 *
 * Restores cross-node share replication accuracy via monotonic
 * ShardVectorClock sequence tracking and non-blocking background
 * sliding-window catch-up batch streamers.
 *
 * Components:
 *   - ShardVectorClock: per-shard, per-node monotonic sequence counter
 *   - BFT commit gating: shard commits require t-of-N quorum acknowledgment
 *   - Sliding-window catch-up: detects lagging nodes and streams missing entries
 *   - Byzantine detection: nodes that diverge from quorum are flagged and quarantined
 *
 * @module hsm-adapter/bft-shard-sync-engine
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

// ── Shard entry states ───────────────────────────────────────────
const ENTRY_STATE = {
  PENDING: 'pending',
  REPLICATED: 'replicated',
  COMMITTED: 'committed',
};

// ── Node sync states ─────────────────────────────────────────────
const NODE_SYNC_STATE = {
  SYNCED: 'synced',
  LAGGING: 'lagging',
  QUARANTINED: 'quarantined',
};

/**
 * ShardVectorClock — monotonic per-shard, per-node sequence tracker.
 *
 * Tracks the replication position of each node for a given shard.
 * Each node has a monotonically increasing sequence number that
 * advances as it acknowledges shard entries.
 */
class ShardVectorClock {
  /**
   * @param {string} shardId
   * @param {string[]} nodeIds
   */
  constructor(shardId, nodeIds) {
    this.shardId = shardId;
    this._sequences = new Map();
    for (const nodeId of nodeIds) {
      this._sequences.set(nodeId, 0);
    }
  }

  /**
   * Get the sequence number for a node.
   * @param {string} nodeId
   * @returns {number}
   */
  get(nodeId) {
    if (!this._sequences.has(nodeId)) {
      throw new HsmAdapterError('SHARD_NODE_UNKNOWN', `node ${nodeId} not in vector clock for shard ${this.shardId}`);
    }
    return this._sequences.get(nodeId);
  }

  /**
   * Advance the sequence for a node. Must be monotonic.
   * @param {string} nodeId
   * @param {number} sequence
   */
  advance(nodeId, sequence) {
    const current = this.get(nodeId);
    if (sequence <= current) {
      throw new HsmAdapterError(
        'SHARD_SEQUENCE_STALE',
        `sequence ${sequence} for node ${nodeId} is stale (current: ${current})`,
      );
    }
    this._sequences.set(nodeId, sequence);
  }

  /**
   * Get the minimum sequence across all nodes (the "safe" commit point).
   * @returns {number}
   */
  minSequence() {
    let min = Infinity;
    for (const seq of this._sequences.values()) {
      if (seq < min) min = seq;
    }
    return min === Infinity ? 0 : min;
  }

  /**
   * Get the maximum sequence across all nodes.
   * @returns {number}
   */
  maxSequence() {
    let max = 0;
    for (const seq of this._sequences.values()) {
      if (seq > max) max = seq;
    }
    return max;
  }

  /**
   * Get the sequence at a given quorum rank (e.g., the t-th smallest).
   * @param {number} quorumSize
   * @returns {number}
   */
  quorumSequence(quorumSize) {
    const sorted = Array.from(this._sequences.values()).sort((a, b) => a - b);
    if (quorumSize < 1 || quorumSize > sorted.length) {
      throw new HsmAdapterError('SHARD_QUORUM_INVALID', `quorum size ${quorumSize} invalid for ${sorted.length} nodes`);
    }
    // The quorum commit point is the t-th smallest sequence (0-indexed: quorumSize - 1)
    return sorted[quorumSize - 1];
  }

  /**
   * Get all node sequences as a snapshot.
   * @returns {object}
   */
  snapshot() {
    const result = {};
    for (const [nodeId, seq] of this._sequences) {
      result[nodeId] = seq;
    }
    return result;
  }

  /**
   * Get all node IDs.
   * @returns {string[]}
   */
  nodeIds() {
    return Array.from(this._sequences.keys());
  }
}

/**
 * Represents a single shard entry in the replication log.
 */
class ShardEntry {
  /**
   * @param {number} index
   * @param {string} data
   * @param {number} timestamp
   */
  constructor(index, data, timestamp) {
    this.index = index;
    this.data = data;
    this.hash = crypto.createHash('sha256').update(data).digest('hex');
    this.timestamp = timestamp;
    this.state = ENTRY_STATE.PENDING;
    this.acknowledgedBy = new Set();
  }
}

/**
 * BFT Shard Sync Engine.
 *
 * Manages shard replication across a cluster of nodes with BFT commit
 * gating, sliding-window catch-up, and Byzantine node detection.
 */
class BftShardSyncEngine {
  /**
   * @param {object} options
   * @param {string[]} options.clusterNodes
   * @param {number} [options.minQuorumNodes] — t-of-N quorum for commit
   * @param {number} [options.maxCatchUpBatchSize] — max entries per catch-up batch
   * @param {number} [options.lagThreshold] — entries behind before catch-up triggered
   * @param {number} [options.byzantineDivergenceThreshold] — sequences behind before quarantine
   * @param {Function} [options.audit]
   * @param {Function} [options.streamer] — async (nodeId, shardId, entries) => boolean
   */
  constructor(options = {}) {
    if (!Array.isArray(options.clusterNodes) || options.clusterNodes.length === 0) {
      throw new HsmAdapterError('INVALID_INPUT', 'clusterNodes must be a non-empty array');
    }
    this.clusterNodes = new Set(options.clusterNodes);
    this.minQuorumNodes = options.minQuorumNodes || Math.floor(options.clusterNodes.length / 2) + 1;
    this.maxCatchUpBatchSize = options.maxCatchUpBatchSize || 64;
    this.lagThreshold = options.lagThreshold || 8;
    this.byzantineDivergenceThreshold = options.byzantineDivergenceThreshold || 100;
    this._audit = options.audit || null;
    this._streamer = options.streamer || null;

    // Per-shard state
    this._shards = new Map(); // shardId -> { log, vectorClock, nextIndex }
    // Per-node state
    this._nodeStates = new Map(); // nodeId -> NODE_SYNC_STATE
    for (const nodeId of options.clusterNodes) {
      this._nodeStates.set(nodeId, NODE_SYNC_STATE.SYNCED);
    }
  }

  /**
   * Register a new shard for tracking.
   * @param {string} shardId
   */
  registerShard(shardId) {
    if (this._shards.has(shardId)) {
      throw new HsmAdapterError('SHARD_ALREADY_REGISTERED', `shard ${shardId} already registered`);
    }
    this._shards.set(shardId, {
      log: [],
      vectorClock: new ShardVectorClock(shardId, Array.from(this.clusterNodes)),
      nextIndex: 1,
    });
    this._emitAudit('SHARD_REGISTERED', { shardId });
  }

  /**
   * Append a new entry to a shard's replication log.
   * @param {string} shardId
   * @param {string} data
   * @returns {ShardEntry}
   */
  append(shardId, data) {
    const shard = this._getShard(shardId);
    const entry = new ShardEntry(shard.nextIndex, data, Date.now());
    shard.log.push(entry);
    shard.nextIndex++;
    this._emitAudit('SHARD_ENTRY_APPENDED', { shardId, index: entry.index, hash: entry.hash });
    return entry;
  }

  /**
   * Acknowledge receipt of a shard entry by a node.
   * @param {string} shardId
   * @param {string} nodeId
   * @param {number} sequence
   */
  acknowledge(shardId, nodeId, sequence) {
    this._validateNode(nodeId);
    const shard = this._getShard(shardId);

    // Anti-replay: sequence must be monotonic
    shard.vectorClock.advance(nodeId, sequence);

    // Mark entry as acknowledged by this node
    const entry = shard.log.find((e) => e.index === sequence);
    if (entry) {
      entry.acknowledgedBy.add(nodeId);
      this._checkCommit(shardId, entry);
    }

    this._emitAudit('SHARD_ENTRY_ACKED', { shardId, nodeId, sequence });
  }

  /**
   * Check if an entry has reached quorum and can be committed.
   * @param {string} shardId
   * @param {ShardEntry} entry
   */
  _checkCommit(shardId, entry) {
    if (entry.state === ENTRY_STATE.COMMITTED) return;
    if (entry.acknowledgedBy.size >= this.minQuorumNodes) {
      entry.state = ENTRY_STATE.COMMITTED;
      this._emitAudit('SHARD_ENTRY_COMMITTED', { shardId, index: entry.index, acks: entry.acknowledgedBy.size });
    }
  }

  /**
   * Get the commit index for a shard (highest committed entry index).
   * @param {string} shardId
   * @returns {number}
   */
  commitIndex(shardId) {
    const shard = this._getShard(shardId);
    let committed = 0;
    for (const entry of shard.log) {
      if (entry.state === ENTRY_STATE.COMMITTED) committed = entry.index;
      else break;
    }
    return committed;
  }

  /**
   * Detect lagging nodes for a shard and trigger catch-up if needed.
   * @param {string} shardId
   * @returns {object} lag report
   */
  detectLag(shardId) {
    const shard = this._getShard(shardId);
    const maxSeq = shard.vectorClock.maxSequence();
    const laggingNodes = [];
    const byzantineNodes = [];

    for (const nodeId of shard.vectorClock.nodeIds()) {
      const nodeSeq = shard.vectorClock.get(nodeId);
      const lag = maxSeq - nodeSeq;

      if (lag >= this.byzantineDivergenceThreshold) {
        byzantineNodes.push({ nodeId, lag, sequence: nodeSeq });
        this._nodeStates.set(nodeId, NODE_SYNC_STATE.QUARANTINED);
        this._emitAudit('SHARD_NODE_BYZANTINE', { shardId, nodeId, lag, sequence: nodeSeq });
      } else if (lag >= this.lagThreshold) {
        laggingNodes.push({ nodeId, lag, sequence: nodeSeq });
        if (this._nodeStates.get(nodeId) !== NODE_SYNC_STATE.QUARANTINED) {
          this._nodeStates.set(nodeId, NODE_SYNC_STATE.LAGGING);
        }
      } else {
        if (this._nodeStates.get(nodeId) !== NODE_SYNC_STATE.QUARANTINED) {
          this._nodeStates.set(nodeId, NODE_SYNC_STATE.SYNCED);
        }
      }
    }

    return { shardId, maxSeq, laggingNodes, byzantineNodes };
  }

  /**
   * Stream a catch-up batch to a lagging node.
   * @param {string} shardId
   * @param {string} nodeId
   * @returns {object} batch info
   */
  catchUp(shardId, nodeId) {
    this._validateNode(nodeId);
    const shard = this._getShard(shardId);
    const nodeSeq = shard.vectorClock.get(nodeId);
    const maxSeq = shard.vectorClock.maxSequence();

    if (nodeSeq >= maxSeq) {
      return { shardId, nodeId, batchSize: 0, entries: [], message: 'node is up to date' };
    }

    // Gather entries that the node is missing
    const missing = shard.log.filter((e) => e.index > nodeSeq);
    const batch = missing.slice(0, this.maxCatchUpBatchSize);
    const batchSize = batch.length;

    // Stream the batch if a streamer is configured
    if (this._streamer) {
      const streamResult = this._streamer(nodeId, shardId, batch);
      // Note: streamer may be sync or async; we don't block on it
    }

    this._emitAudit('SHARD_CATCH_UP_BATCH', { shardId, nodeId, batchSize, fromSeq: nodeSeq, toSeq: nodeSeq + batchSize });

    return {
      shardId,
      nodeId,
      batchSize,
      fromSeq: nodeSeq,
      toSeq: nodeSeq + batchSize,
      entries: batch.map((e) => ({ index: e.index, hash: e.hash })),
    };
  }

  /**
   * Run a full sync cycle: detect lag, stream catch-up batches.
   * @param {string} shardId
   * @returns {object} sync report
   */
  syncCycle(shardId) {
    const lagReport = this.detectLag(shardId);
    const catchUps = [];

    for (const { nodeId } of lagReport.laggingNodes) {
      const result = this.catchUp(shardId, nodeId);
      catchUps.push(result);
    }

    return {
      shardId,
      lagReport,
      catchUps,
      commitIndex: this.commitIndex(shardId),
    };
  }

  /**
   * Get the state of a node (synced, lagging, quarantined).
   * @param {string} nodeId
   * @returns {string}
   */
  getNodeState(nodeId) {
    this._validateNode(nodeId);
    return this._nodeStates.get(nodeId);
  }

  /**
   * Get the vector clock snapshot for a shard.
   * @param {string} shardId
   * @returns {object}
   */
  getVectorClock(shardId) {
    return this._getShard(shardId).vectorClock.snapshot();
  }

  /**
   * Get the quorum commit point for a shard.
   * @param {string} shardId
   * @returns {number}
   */
  quorumCommitPoint(shardId) {
    const shard = this._getShard(shardId);
    return shard.vectorClock.quorumSequence(this.minQuorumNodes);
  }

  /**
   * Get engine telemetry.
   * @returns {object}
   */
  getEngineState() {
    const nodeStates = {};
    for (const [nodeId, state] of this._nodeStates) {
      nodeStates[nodeId] = state;
    }
    return {
      activeShards: this._shards.size,
      clusterSize: this.clusterNodes.size,
      minQuorumNodes: this.minQuorumNodes,
      nodeStates,
    };
  }

  /**
   * Get a shard's state.
   * @param {string} shardId
   * @returns {object}
   */
  _getShard(shardId) {
    const shard = this._shards.get(shardId);
    if (!shard) {
      throw new HsmAdapterError('SHARD_NOT_FOUND', `shard ${shardId} not found`);
    }
    return shard;
  }

  /**
   * Validate that a node is part of the cluster.
   * @param {string} nodeId
   */
  _validateNode(nodeId) {
    if (!this.clusterNodes.has(nodeId)) {
      throw new HsmAdapterError('SHARD_NODE_UNKNOWN', `node ${nodeId} not in cluster`);
    }
  }

  _emitAudit(event, data) {
    if (this._audit) this._audit(event, { timestamp: Date.now(), ...data });
  }
}

module.exports = {
  BftShardSyncEngine,
  ShardVectorClock,
  ShardEntry,
  ENTRY_STATE,
  NODE_SYNC_STATE,
};
