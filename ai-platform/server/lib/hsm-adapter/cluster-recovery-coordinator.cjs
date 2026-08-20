"use strict";

/**
 * Track 33: Cluster recovery coordinator.
 *
 * Evaluates node lag metrics and schedules background catch-up sessions
 * without blocking live shard commits.
 *
 * @module hsm-adapter/cluster-recovery-coordinator
 */

const { HsmAdapterError } = require("./base-adapter.cjs");

class ClusterRecoveryCoordinator {
  /**
   * @param {object} options
   * @param {string[]} options.clusterNodes
   * @param {number} options.maxCatchUpBatchSize
   * @param {number} options.reSyncRetryLimit
   * @param {number} options.backoffBaseIntervalMs
   * @param {number} options.maxBackOffMs
   * @param {number} [options.checkpointThreshold=1000]
   * @param {Function} [options.audit]
   * @param {Function} [options.streamer]
   */
  constructor(options = {}) {
    this.clusterNodes = new Set(options.clusterNodes || []);
    this.maxCatchUpBatchSize = options.maxCatchUpBatchSize || 64;
    this.reSyncRetryLimit = options.reSyncRetryLimit || 5;
    this.backoffBaseIntervalMs = options.backoffBaseIntervalMs || 1000;
    this.maxBackOffMs = options.maxBackOffMs || 60000;
    this.checkpointThreshold = options.checkpointThreshold || 1000;
    this._audit = options.audit || null;
    this._streamer = options.streamer || null;
    this._recoveries = new Map();
    this._clusterSequences = new Map();
  }

  /**
   * Register the current cluster state for a shard.
   * @param {string} shardId
   * @param {number} currentSequence
   */
  setClusterSequence(shardId, currentSequence) {
    this._clusterSequences.set(shardId, currentSequence);
  }

  /**
   * Detect lag for a node and start a recovery session.
   * @param {string} nodeId
   * @param {string} shardId
   * @param {number} localSequence
   * @returns {object}
   */
  startRecovery(nodeId, shardId, localSequence) {
    if (!this.clusterNodes.has(nodeId)) {
      throw new HsmAdapterError(
        "RECOVERY_NODE_REJECTED",
        `node ${nodeId} is not in the cluster`,
      );
    }
    const clusterSeq = this._clusterSequences.get(shardId) || 0;
    const lag = clusterSeq - localSequence;
    if (lag <= 0) {
      return { status: "NO_RECOVERY_NEEDED", nodeId, shardId, lag };
    }

    const sessionId = `${nodeId}:${shardId}:${Date.now()}`;
    const mode =
      lag > this.checkpointThreshold ? "checkpoint" : "sliding-window";
    const session = {
      sessionId,
      nodeId,
      shardId,
      localSequence,
      clusterSequence: clusterSeq,
      lag,
      mode,
      attempts: 0,
      nextBackOffMs: this.backoffBaseIntervalMs,
      ackedBatches: 0,
      completed: false,
    };
    this._recoveries.set(sessionId, session);

    this._emitAudit("NODE_RECOVERY_STARTED", {
      sessionId,
      nodeId,
      shardId,
      lag,
      mode,
    });

    if (this._streamer) {
      this._streamer(session, this);
    }

    return session;
  }

  /**
   * Record a successful catch-up batch ack.
   * @param {string} sessionId
   * @param {number} batchSize
   * @returns {object}
   */
  ackBatch(sessionId, batchSize) {
    const session = this._recoveries.get(sessionId);
    if (!session) {
      throw new HsmAdapterError(
        "RECOVERY_SESSION_NOT_FOUND",
        `no session ${sessionId}`,
      );
    }
    if (session.completed) {
      throw new HsmAdapterError(
        "RECOVERY_SESSION_COMPLETED",
        `session ${sessionId} already completed`,
      );
    }

    session.ackedBatches += 1;
    session.localSequence += batchSize;
    session.attempts = 0;
    session.nextBackOffMs = this.backoffBaseIntervalMs;

    if (session.localSequence >= session.clusterSequence) {
      session.completed = true;
      this._emitAudit("NODE_RECOVERY_SYNCED", {
        sessionId,
        nodeId: session.nodeId,
        shardId: session.shardId,
        ackedBatches: session.ackedBatches,
      });
    } else {
      this._emitAudit("CATCH_UP_BATCH_ACK", {
        sessionId,
        nodeId: session.nodeId,
        shardId: session.shardId,
        batchSize,
        remainingLag: session.clusterSequence - session.localSequence,
      });
    }

    return session;
  }

  /**
   * Record a failed batch attempt and compute next back-off.
   * @param {string} sessionId
   * @returns {object}
   */
  failBatch(sessionId) {
    const session = this._recoveries.get(sessionId);
    if (!session) {
      throw new HsmAdapterError(
        "RECOVERY_SESSION_NOT_FOUND",
        `no session ${sessionId}`,
      );
    }
    if (session.completed) {
      throw new HsmAdapterError(
        "RECOVERY_SESSION_COMPLETED",
        `session ${sessionId} already completed`,
      );
    }

    session.attempts += 1;
    if (session.attempts > this.reSyncRetryLimit) {
      throw new HsmAdapterError(
        "RECOVERY_RETRY_EXHAUSTED",
        `session ${sessionId} exhausted retries`,
      );
    }

    session.nextBackOffMs = Math.min(
      session.nextBackOffMs * 2,
      this.maxBackOffMs,
    );

    this._emitAudit("CATCH_UP_BATCH_RETRY", {
      sessionId,
      nodeId: session.nodeId,
      shardId: session.shardId,
      attempt: session.attempts,
      nextBackOffMs: session.nextBackOffMs,
    });

    return session;
  }

  /**
   * Compute the next catch-up batch range for a session.
   * @param {string} sessionId
   * @returns {{from: number, to: number, size: number}}
   */
  nextBatchRange(sessionId) {
    const session = this._recoveries.get(sessionId);
    if (!session) {
      throw new HsmAdapterError(
        "RECOVERY_SESSION_NOT_FOUND",
        `no session ${sessionId}`,
      );
    }
    const from = session.localSequence;
    const to = Math.min(
      from + this.maxCatchUpBatchSize,
      session.clusterSequence,
    );
    return { from, to, size: to - from };
  }

  _emitAudit(event, info) {
    if (this._audit) this._audit(event, { timestamp: Date.now(), ...info });
  }
}

module.exports = { ClusterRecoveryCoordinator };
