'use strict';

/**
 * Track 34: Cluster consensus engine.
 *
 * Raft-inspired leader election, heartbeat synchronization, and log
 * replication for multi-node ledger consistency. Designed to integrate
 * with the existing ClusterRecoveryCoordinator (Track 33) catch-up
 * pipeline.
 *
 * @module hsm-adapter/cluster-consensus-engine
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

// ── Consensus states ─────────────────────────────────────────────
const NODE_STATE = {
  FOLLOWER: 'follower',
  CANDIDATE: 'candidate',
  LEADER: 'leader',
};

const CONSENSUS_EVENT = {
  LEADER_ELECTED: 'LEADER_ELECTED',
  QUORUM_LOST: 'QUORUM_LOST',
  LOG_REPLICATED: 'LOG_REPLICATED',
  LOG_COMMITTED: 'LOG_COMMITTED',
  HEARTBEAT_SENT: 'HEARTBEAT_SENT',
  HEARTBEAT_ACKED: 'HEARTBEAT_ACKED',
  ELECTION_TIMEOUT: 'ELECTION_TIMEOUT',
  VOTE_REQUESTED: 'VOTE_REQUESTED',
  VOTE_GRANTED: 'VOTE_GRANTED',
  VOTE_REJECTED: 'VOTE_REJECTED',
  TERM_ADVANCED: 'TERM_ADVANCED',
  SIGNATURE_INVALID: 'CONSENSUS_SIGNATURE_INVALID',
  PEER_KEY_UNKNOWN: 'CONSENSUS_PEER_KEY_UNKNOWN',
  RPC_SIGNED: 'CONSENSUS_RPC_SIGNED',
  RPC_VERIFIED: 'CONSENSUS_RPC_VERIFIED',
  REPLAY_DETECTED: 'CONSENSUS_REPLAY_DETECTED',
  NONCE_STALE: 'CONSENSUS_NONCE_STALE',
  TIMESTAMP_EXPIRED: 'CONSENSUS_TIMESTAMP_EXPIRED',
  PEER_KEY_ADDED: 'CONSENSUS_PEER_KEY_ADDED',
  PEER_KEY_REVOKED: 'CONSENSUS_PEER_KEY_REVOKED',
  PEER_KEY_ROTATION_BLOCKED: 'CONSENSUS_PEER_KEY_ROTATION_BLOCKED',
  SNAPSHOT_CREATED: 'CONSENSUS_SNAPSHOT_CREATED',
  SNAPSHOT_INSTALLED: 'CONSENSUS_SNAPSHOT_INSTALLED',
  SNAPSHOT_REJECTED: 'CONSENSUS_SNAPSHOT_REJECTED',
};

class ClusterConsensusEngine {
  /**
   * @param {object} options
   * @param {string} options.nodeId - this node's unique identifier
   * @param {string[]} options.clusterNodes - all node IDs in the cluster
   * @param {number} [options.minQuorumNodes] - minimum nodes for quorum (default: ceil(n/2)+1)
   * @param {number} [options.heartbeatIntervalMs=500] - leader heartbeat interval
   * @param {number} [options.electionTimeoutMs=1500] - follower election timeout
   * @param {number} [options.electionTimeoutWindow=300] - randomized jitter window
   * @param {Function} [options.audit] - audit callback (event, info) => void
   * @param {Function} [options.sendHeartbeat] - async (targetNodeId, term, logIndex) => boolean
   * @param {Function} [options.requestVote] - async (targetNodeId, term, candidateId, lastLogIndex) => boolean
   * @param {Function} [options.replicateLog] - async (targetNodeId, entries, leaderCommit) => boolean
   * @param {object} [options.signingKeyPair] - Ed25519 key pair for RPC signing { privateKey: KeyObject, publicKey: KeyObject }
   * @param {Map<string, KeyObject>} [options.peerPublicKeys] - nodeId -> publicKey map for verifying inbound RPCs
   * @param {boolean} [options.requireRpcSigning=false] - if true, reject unsigned/tampered inbound RPCs
   * @param {number} [options.replayWindowMs=5000] - max age of RPC frame timestamp before rejection
   * @param {boolean} [options.enableReplayProtection=true] - enable nonce + timestamp anti-replay checks
   * @param {number} [options.snapshotThreshold=100] - min committed log entries before compaction triggers
   * @param {Function} [options.captureSnapshotState] - () => object: captures state machine for snapshot
   * @param {Function} [options.restoreSnapshotState] - (state) => void: restores state machine from snapshot
   * @param {Function} [options.installSnapshot] - async (targetNodeId, snapshot) => boolean: sends snapshot to follower
   */
  constructor(options = {}) {
    if (!options.nodeId) {
      throw new HsmAdapterError('INVALID_INPUT', 'nodeId is required');
    }
    if (!Array.isArray(options.clusterNodes) || options.clusterNodes.length === 0) {
      throw new HsmAdapterError('INVALID_INPUT', 'clusterNodes must be a non-empty array');
    }
    if (!options.clusterNodes.includes(options.nodeId)) {
      throw new HsmAdapterError('INVALID_INPUT', `nodeId ${options.nodeId} not in clusterNodes`);
    }

    this.nodeId = options.nodeId;
    this.clusterNodes = new Set(options.clusterNodes);
    this.minQuorumNodes = options.minQuorumNodes || Math.floor(options.clusterNodes.length / 2) + 1;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs || 500;
    this.electionTimeoutMs = options.electionTimeoutMs || 1500;
    this.electionTimeoutWindow = options.electionTimeoutWindow || 300;

    this._audit = options.audit || null;
    this._sendHeartbeat = options.sendHeartbeat || null;
    this._requestVote = options.requestVote || null;
    this._replicateLog = options.replicateLog || null;

    // Byzantine hardening: Ed25519 RPC signing
    this._signingKeyPair = options.signingKeyPair || null;
    this._peerPublicKeys = options.peerPublicKeys || new Map();
    this._requireRpcSigning = options.requireRpcSigning || false;

    // Phase 4: Replay protection (nonce + timestamp)
    this._replayWindowMs = options.replayWindowMs || 5000;
    this._enableReplayProtection = options.enableReplayProtection !== false; // default true
    this._lastSeenNonce = new Map(); // senderId -> last seen nonce
    this._localNonce = 0; // monotonic counter for outbound frames

    // Raft state
    this._state = NODE_STATE.FOLLOWER;
    this._currentTerm = 0;
    this._votedFor = null;
    this._votesReceived = new Set();
    this._leaderId = null;
    this._lastHeartbeatReceived = Date.now();
    this._lastAppliedIndex = 0;
    this._commitIndex = 0;
    this._log = []; // [{ term, index, command, committed }]
    this._nextIndex = new Map(); // nodeId -> next log index to send
    this._matchIndex = new Map(); // nodeId -> highest replicated index

    // Phase 6: Snapshot/compaction state
    this._snapshotThreshold = options.snapshotThreshold || 100;
    this._captureSnapshotState = options.captureSnapshotState || null;
    this._restoreSnapshotState = options.restoreSnapshotState || null;
    this._installSnapshot = options.installSnapshot || null;
    this._lastSnapshotIndex = 0; // index of last entry in snapshot (0 = no snapshot)
    this._lastSnapshotTerm = 0;  // term of last entry in snapshot
    this._snapshotState = null;  // captured state machine data

    // Phase 7: Implicit outbound signing
    this._autoSignOutbound = options.autoSignOutbound !== false; // default true

    // Election timer
    this._electionTimer = null;
    this._heartbeatTimer = null;
    this._started = false;
  }

  /**
   * Start the consensus engine — begins election timeout monitoring.
   */
  start() {
    if (this._started) return;
    this._started = true;
    this._resetElectionTimer();
    this._emitAudit(CONSENSUS_EVENT.HEARTBEAT_ACKED, {
      nodeId: this.nodeId,
      state: this._state,
      term: this._currentTerm,
      message: 'consensus engine started',
    });
  }

  /**
   * Stop the consensus engine and clean up timers.
   */
  stop() {
    this._started = false;
    if (this._electionTimer) {
      clearTimeout(this._electionTimer);
      this._electionTimer = null;
    }
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  /**
   * Get the current consensus state snapshot.
   * @returns {object}
   */
  getState() {
    return {
      nodeId: this.nodeId,
      state: this._state,
      term: this._currentTerm,
      leaderId: this._leaderId,
      votedFor: this._votedFor,
      votesReceived: Array.from(this._votesReceived),
      commitIndex: this._commitIndex,
      lastAppliedIndex: this._lastAppliedIndex,
      logLength: this._log.length,
      quorumNodes: this.minQuorumNodes,
      clusterSize: this.clusterNodes.size,
      lastSnapshotIndex: this._lastSnapshotIndex,
      lastSnapshotTerm: this._lastSnapshotTerm,
      hasSnapshot: this._snapshotState !== null,
    };
  }

  /**
   * Process a heartbeat received from a leader.
   * @param {object} heartbeat
   * @param {number} heartbeat.term
   * @param {string} heartbeat.leaderId
   * @param {number} [heartbeat.leaderCommit]
   */
  receiveHeartbeat(heartbeat = {}) {
    if (typeof heartbeat.term !== 'number' || !heartbeat.leaderId) {
      throw new HsmAdapterError('INVALID_INPUT', 'heartbeat requires term and leaderId');
    }
    if (!this.clusterNodes.has(heartbeat.leaderId)) {
      throw new HsmAdapterError('UNKNOWN_LEADER', `leader ${heartbeat.leaderId} not in cluster`);
    }

    // Byzantine hardening: verify heartbeat signature
    const payload = this._extractSignablePayload(heartbeat);
    if (!this.verifyRpcFrame(payload, heartbeat.leaderId, heartbeat.signature)) {
      return { accepted: false, reason: 'signature_invalid', currentTerm: this._currentTerm };
    }

    // Stale leader — reject
    if (heartbeat.term < this._currentTerm) {
      return { accepted: false, reason: 'stale_term', currentTerm: this._currentTerm };
    }

    // Term advancement — step down to follower
    if (heartbeat.term > this._currentTerm) {
      this._currentTerm = heartbeat.term;
      this._state = NODE_STATE.FOLLOWER;
      this._votedFor = null;
      this._votesReceived.clear();
      this._emitAudit(CONSENSUS_EVENT.TERM_ADVANCED, {
        nodeId: this.nodeId,
        newTerm: this._currentTerm,
        source: 'heartbeat',
      });
    }

    // Acknowledge the leader
    if (this._state !== NODE_STATE.FOLLOWER) {
      this._state = NODE_STATE.FOLLOWER;
    }
    this._leaderId = heartbeat.leaderId;
    this._lastHeartbeatReceived = Date.now();

    // Advance commit index if leader has committed further
    if (typeof heartbeat.leaderCommit === 'number' && heartbeat.leaderCommit > this._commitIndex) {
      this._commitIndex = Math.min(heartbeat.leaderCommit, this._log.length);
      this._applyCommittedEntries();
    }

    this._resetElectionTimer();

    this._emitAudit(CONSENSUS_EVENT.HEARTBEAT_ACKED, {
      nodeId: this.nodeId,
      leaderId: this._leaderId,
      term: this._currentTerm,
      commitIndex: this._commitIndex,
    });

    return { accepted: true, term: this._currentTerm, commitIndex: this._commitIndex };
  }

  /**
   * Request a vote from this node (Raft RequestVote RPC).
   * @param {object} request
   * @param {number} request.term
   * @param {string} request.candidateId
   * @param {number} [request.lastLogIndex]
   * @param {number} [request.lastLogTerm]
   * @returns {object} { voteGranted: boolean, term: number }
   */
  requestVote(request = {}) {
    if (typeof request.term !== 'number' || !request.candidateId) {
      throw new HsmAdapterError('INVALID_INPUT', 'vote request requires term and candidateId');
    }
    if (!this.clusterNodes.has(request.candidateId)) {
      throw new HsmAdapterError('UNKNOWN_CANDIDATE', `candidate ${request.candidateId} not in cluster`);
    }

    // Byzantine hardening: verify RPC signature
    const payload = this._extractSignablePayload(request);
    if (!this.verifyRpcFrame(payload, request.candidateId, request.signature)) {
      return { voteGranted: false, term: this._currentTerm, reason: 'signature_invalid' };
    }

    // Stale term — reject
    if (request.term < this._currentTerm) {
      this._emitAudit(CONSENSUS_EVENT.VOTE_REJECTED, {
        nodeId: this.nodeId,
        candidateId: request.candidateId,
        reason: 'stale_term',
        currentTerm: this._currentTerm,
      });
      return { voteGranted: false, term: this._currentTerm };
    }

    // Newer term — update and reset vote
    if (request.term > this._currentTerm) {
      this._currentTerm = request.term;
      this._state = NODE_STATE.FOLLOWER;
      this._votedFor = null;
      this._votesReceived.clear();
      this._emitAudit(CONSENSUS_EVENT.TERM_ADVANCED, {
        nodeId: this.nodeId,
        newTerm: this._currentTerm,
        source: 'vote_request',
      });
    }

    // Already voted for someone else this term
    if (this._votedFor !== null && this._votedFor !== request.candidateId) {
      this._emitAudit(CONSENSUS_EVENT.VOTE_REJECTED, {
        nodeId: this.nodeId,
        candidateId: request.candidateId,
        reason: 'already_voted',
        votedFor: this._votedFor,
      });
      return { voteGranted: false, term: this._currentTerm };
    }

    // Check candidate's log is at least as up-to-date as ours
    // Phase 6: Use absolute log index (including snapshot offset)
    const myLastLogTerm = this._log.length > 0
      ? this._log[this._log.length - 1].term
      : this._lastSnapshotTerm;
    const myLastLogIndex = this._log.length + this._lastSnapshotIndex;

    const candidateLastLogTerm = typeof request.lastLogTerm === 'number' ? request.lastLogTerm : 0;
    const candidateLastLogIndex = typeof request.lastLogIndex === 'number' ? request.lastLogIndex : 0;

    const logUpToDate =
      candidateLastLogTerm > myLastLogTerm ||
      (candidateLastLogTerm === myLastLogTerm && candidateLastLogIndex >= myLastLogIndex);

    if (!logUpToDate) {
      this._emitAudit(CONSENSUS_EVENT.VOTE_REJECTED, {
        nodeId: this.nodeId,
        candidateId: request.candidateId,
        reason: 'log_out_of_date',
      });
      return { voteGranted: false, term: this._currentTerm };
    }

    // Grant vote
    this._votedFor = request.candidateId;
    this._state = NODE_STATE.FOLLOWER;
    this._leaderId = null;
    this._resetElectionTimer();

    this._emitAudit(CONSENSUS_EVENT.VOTE_GRANTED, {
      nodeId: this.nodeId,
      candidateId: request.candidateId,
      term: this._currentTerm,
    });

    return { voteGranted: true, term: this._currentTerm };
  }

  /**
   * Initiate a leader election. Transitions to candidate, increments term,
   * votes for self, and requests votes from all other nodes.
   * @returns {Promise<object>} election result
   */
  async startElection() {
    if (!this._started) {
      throw new HsmAdapterError('NOT_STARTED', 'consensus engine not started');
    }

    this._state = NODE_STATE.CANDIDATE;
    this._currentTerm += 1;
    this._votedFor = this.nodeId;
    this._votesReceived = new Set([this.nodeId]);
    this._leaderId = null;

    // Phase 6: Use absolute log index (including snapshot offset)
    const lastLogIndex = this._log.length + this._lastSnapshotIndex;
    const lastLogTerm = this._log.length > 0
      ? this._log[this._log.length - 1].term
      : this._lastSnapshotTerm;

    this._emitAudit(CONSENSUS_EVENT.VOTE_REQUESTED, {
      nodeId: this.nodeId,
      term: this._currentTerm,
      lastLogIndex,
      lastLogTerm,
    });

    // Request votes from all other nodes
    const votePromises = [];
    for (const targetId of this.clusterNodes) {
      if (targetId === this.nodeId) continue;
      if (this._requestVote) {
        // Phase 7: Auto-sign outbound vote request payload
        const votePayload = {
          term: this._currentTerm,
          candidateId: this.nodeId,
          lastLogIndex,
          lastLogTerm,
        };
        const signedEnvelope = this._signOutboundFrame(votePayload);
        votePromises.push(
          this._requestVote(targetId, signedEnvelope)
            .then(() => ({ targetId, granted: true }))
            .catch(() => ({ targetId, granted: false }))
        );
      } else {
        votePromises.push(Promise.resolve({ targetId, granted: true }));
      }
    }

    const results = await Promise.all(votePromises);
    let voteCount = 1; // self
    for (const { targetId, granted } of results) {
      if (granted) {
        this._votesReceived.add(targetId);
        voteCount += 1;
      }
    }

    if (voteCount >= this.minQuorumNodes) {
      this._becomeLeader();
      return { elected: true, term: this._currentTerm, votes: voteCount };
    }

    // Failed to achieve quorum — stay as candidate, wait for next election
    this._emitAudit(CONSENSUS_EVENT.QUORUM_LOST, {
      nodeId: this.nodeId,
      term: this._currentTerm,
      votes: voteCount,
      required: this.minQuorumNodes,
    });

    return { elected: false, term: this._currentTerm, votes: voteCount };
  }

  /**
   * Append a new log entry as leader and replicate to followers.
   * @param {object} command - the command to replicate
   * @returns {Promise<object>} { index, committed, replicas }
   */
  async appendAndReplicate(command) {
    if (this._state !== NODE_STATE.LEADER) {
      throw new HsmAdapterError('NOT_LEADER', `node ${this.nodeId} is not the leader (state: ${this._state})`);
    }

    // Phase 6: Account for snapshot offset when computing absolute log index
    const index = this._log.length + this._lastSnapshotIndex + 1;
    const entry = { term: this._currentTerm, index, command, committed: false };
    this._log.push(entry);

    // Replicate to all followers
    const replicationResults = [];
    for (const targetId of this.clusterNodes) {
      if (targetId === this.nodeId) continue;
      let success = false;
      if (this._replicateLog) {
        // Phase 7: Auto-sign outbound append entries payload
        const appendPayload = {
          term: this._currentTerm,
          leaderId: this.nodeId,
          entries: [entry],
          leaderCommit: this._commitIndex,
        };
        const signedEnvelope = this._signOutboundFrame(appendPayload);
        try {
          success = await this._replicateLog(targetId, signedEnvelope);
        } catch {
          success = false;
        }
      } else {
        success = true;
      }
      replicationResults.push({ targetId, success });
      if (success) {
        this._matchIndex.set(targetId, index);
        this._nextIndex.set(targetId, index + 1);
      }
    }

    // Check if we can commit (majority replication)
    const successCount = replicationResults.filter((r) => r.success).length + 1; // +1 for leader
    const committed = successCount >= this.minQuorumNodes;

    if (committed) {
      entry.committed = true;
      this._commitIndex = index;
      this._applyCommittedEntries();
      this._emitAudit(CONSENSUS_EVENT.LOG_COMMITTED, {
        leaderId: this.nodeId,
        term: this._currentTerm,
        index,
        replicas: successCount,
      });
    }

    this._emitAudit(CONSENSUS_EVENT.LOG_REPLICATED, {
      leaderId: this.nodeId,
      term: this._currentTerm,
      index,
      replicas: successCount,
      committed,
    });

    return { index, committed, replicas: successCount };
  }

  // ── Phase 5: Peer key rotation (quorum-gated) ───────────────────

  /**
   * Add or update a peer's public key in the registry via quorum-gated consensus.
   * Only the leader can initiate this. The key update is replicated and must
   * achieve majority commit before being applied to the local registry.
   * @param {string} peerNodeId - the node ID whose key is being added/updated
   * @param {KeyObject} publicKey - the Ed25519 public key to register
   * @returns {Promise<object>} { index, committed, replicas }
   */
  async addPeerKey(peerNodeId, publicKey) {
    if (this._state !== NODE_STATE.LEADER) {
      this._emitAudit(CONSENSUS_EVENT.PEER_KEY_ROTATION_BLOCKED, {
        nodeId: this.nodeId,
        peerNodeId,
        reason: 'not_leader',
        state: this._state,
      });
      throw new HsmAdapterError('CONSENSUS_NOT_LEADER',
        `peer key rotation blocked: node ${this.nodeId} is not leader (state: ${this._state})`);
    }
    if (!peerNodeId || typeof peerNodeId !== 'string') {
      throw new HsmAdapterError('INVALID_INPUT', 'peerNodeId must be a non-empty string');
    }
    if (!publicKey) {
      throw new HsmAdapterError('INVALID_INPUT', 'publicKey is required');
    }

    const result = await this.appendAndReplicate({
      operation: 'addPeerKey',
      nodeId: peerNodeId,
      publicKey,
    });

    if (result.committed) {
      // Apply immediately on leader (followers apply via _applyCommittedEntries)
      this._peerPublicKeys.set(peerNodeId, publicKey);
      this._emitAudit(CONSENSUS_EVENT.PEER_KEY_ADDED, {
        nodeId: this.nodeId,
        peerNodeId,
        logIndex: result.index,
        replicas: result.replicas,
      });
    }

    return result;
  }

  /**
   * Revoke a peer's public key from the registry via quorum-gated consensus.
   * Only the leader can initiate this. After revocation, inbound RPC frames
   * from the revoked node will fail signature verification.
   * @param {string} peerNodeId - the node ID whose key is being revoked
   * @returns {Promise<object>} { index, committed, replicas }
   */
  async revokePeerKey(peerNodeId) {
    if (this._state !== NODE_STATE.LEADER) {
      this._emitAudit(CONSENSUS_EVENT.PEER_KEY_ROTATION_BLOCKED, {
        nodeId: this.nodeId,
        peerNodeId,
        reason: 'not_leader',
        state: this._state,
      });
      throw new HsmAdapterError('CONSENSUS_NOT_LEADER',
        `peer key revocation blocked: node ${this.nodeId} is not leader (state: ${this._state})`);
    }
    if (!peerNodeId || typeof peerNodeId !== 'string') {
      throw new HsmAdapterError('INVALID_INPUT', 'peerNodeId must be a non-empty string');
    }
    if (!this._peerPublicKeys.has(peerNodeId)) {
      this._emitAudit(CONSENSUS_EVENT.PEER_KEY_ROTATION_BLOCKED, {
        nodeId: this.nodeId,
        peerNodeId,
        reason: 'key_not_found',
      });
      throw new HsmAdapterError('PEER_KEY_NOT_FOUND',
        `peer key for ${peerNodeId} not found in registry`);
    }

    const result = await this.appendAndReplicate({
      operation: 'revokePeerKey',
      nodeId: peerNodeId,
    });

    if (result.committed) {
      // Apply immediately on leader
      this._peerPublicKeys.delete(peerNodeId);
      this._lastSeenNonce.delete(peerNodeId);
      this._emitAudit(CONSENSUS_EVENT.PEER_KEY_REVOKED, {
        nodeId: this.nodeId,
        peerNodeId,
        logIndex: result.index,
        replicas: result.replicas,
      });
    }

    return result;
  }

  /**
   * Get the current list of registered peer node IDs.
   * @returns {string[]}
   */
  getRegisteredPeers() {
    return Array.from(this._peerPublicKeys.keys());
  }

  /**
   * Check if a peer's public key is registered.
   * @param {string} peerNodeId
   * @returns {boolean}
   */
  hasPeerKey(peerNodeId) {
    return this._peerPublicKeys.has(peerNodeId);
  }

  // ── Phase 6: Log compaction & snapshotting ──────────────────────

  /**
   * Create a snapshot of the current state machine and truncate the log
   * up to the current commit index. This compacts the log prefix to
   * prevent unbounded memory growth.
   *
   * After compaction:
   * - _lastSnapshotIndex = commitIndex
   * - _lastSnapshotTerm = term of the entry at commitIndex
   * - _log is truncated to only contain entries after commitIndex
   * - _snapshotState holds the captured state machine data
   *
   * @param {object} [stateOverride] - optional state to snapshot (defaults to captureSnapshotState callback)
   * @returns {object} { lastSnapshotIndex, lastSnapshotTerm, truncatedEntries, snapshotState }
   */
  createSnapshot(stateOverride) {
    if (this._commitIndex === 0) {
      throw new HsmAdapterError('INVALID_INPUT', 'cannot snapshot with commitIndex=0');
    }
    if (this._commitIndex <= this._lastSnapshotIndex) {
      throw new HsmAdapterError('INVALID_INPUT',
        `commitIndex ${this._commitIndex} already covered by snapshot at ${this._lastSnapshotIndex}`);
    }

    // Capture the state machine
    const snapshotState = stateOverride !== undefined
      ? stateOverride
      : (this._captureSnapshotState ? this._captureSnapshotState() : null);

    // Find the term of the entry at commitIndex
    const localIdx = this._commitIndex - this._lastSnapshotIndex - 1;
    const lastEntry = this._log[localIdx];
    const lastSnapshotTerm = lastEntry ? lastEntry.term : this._lastSnapshotTerm;

    // Truncate the log: remove all entries up to and including commitIndex
    const truncatedEntries = this._log.splice(0, localIdx + 1);

    this._lastSnapshotIndex = this._commitIndex;
    this._lastSnapshotTerm = lastSnapshotTerm;
    this._snapshotState = snapshotState;

    // Adjust lastAppliedIndex to reflect the snapshot
    if (this._lastAppliedIndex < this._lastSnapshotIndex) {
      this._lastAppliedIndex = this._lastSnapshotIndex;
    }

    this._emitAudit(CONSENSUS_EVENT.SNAPSHOT_CREATED, {
      nodeId: this.nodeId,
      lastSnapshotIndex: this._lastSnapshotIndex,
      lastSnapshotTerm: this._lastSnapshotTerm,
      truncatedEntries: truncatedEntries.length,
      remainingLogLength: this._log.length,
    });

    return {
      lastSnapshotIndex: this._lastSnapshotIndex,
      lastSnapshotTerm: this._lastSnapshotTerm,
      truncatedEntries: truncatedEntries.length,
      snapshotState,
    };
  }

  /**
   * Check if the log has grown past the snapshot threshold and compact if so.
   * Called automatically after each commit, or can be called manually.
   * @returns {object|null} snapshot result if compaction occurred, null otherwise
   */
  maybeCompact() {
    if (this._log.length < this._snapshotThreshold) return null;
    return this.createSnapshot();
  }

  /**
   * Install a snapshot received from a leader. This replaces the follower's
   * entire log and state with the snapshot data.
   *
   * @param {object} request
   * @param {number} request.term - leader's current term
   * @param {string} request.leaderId - leader's node ID
   * @param {number} request.lastIncludedIndex - log index of last entry in snapshot
   * @param {number} request.lastIncludedTerm - term of last entry in snapshot
   * @param {object} request.state - the state machine data to restore
   * @param {string} [request.signature] - RPC signature for verification
   * @returns {object} { success, term, matchIndex }
   */
  installSnapshot(request = {}) {
    if (typeof request.term !== 'number' || !request.leaderId) {
      throw new HsmAdapterError('INVALID_INPUT', 'installSnapshot requires term and leaderId');
    }
    if (!this.clusterNodes.has(request.leaderId)) {
      throw new HsmAdapterError('UNKNOWN_LEADER', `leader ${request.leaderId} not in cluster`);
    }
    if (typeof request.lastIncludedIndex !== 'number' || typeof request.lastIncludedTerm !== 'number') {
      throw new HsmAdapterError('INVALID_INPUT', 'installSnapshot requires lastIncludedIndex and lastIncludedTerm');
    }

    // Byzantine hardening: verify RPC signature
    const payload = this._extractSignablePayload(request);
    if (!this.verifyRpcFrame(payload, request.leaderId, request.signature)) {
      this._emitAudit(CONSENSUS_EVENT.SNAPSHOT_REJECTED, {
        nodeId: this.nodeId,
        leaderId: request.leaderId,
        reason: 'signature_invalid',
      });
      return { success: false, term: this._currentTerm, matchIndex: this._lastSnapshotIndex, reason: 'signature_invalid' };
    }

    // Stale term — reject
    if (request.term < this._currentTerm) {
      this._emitAudit(CONSENSUS_EVENT.SNAPSHOT_REJECTED, {
        nodeId: this.nodeId,
        leaderId: request.leaderId,
        reason: 'stale_term',
      });
      return { success: false, term: this._currentTerm, matchIndex: this._lastSnapshotIndex };
    }

    // Term advancement
    if (request.term > this._currentTerm) {
      this._currentTerm = request.term;
      this._votedFor = null;
      this._emitAudit(CONSENSUS_EVENT.TERM_ADVANCED, {
        nodeId: this.nodeId,
        newTerm: this._currentTerm,
        source: 'installSnapshot',
      });
    }

    this._state = NODE_STATE.FOLLOWER;
    this._leaderId = request.leaderId;
    this._lastHeartbeatReceived = Date.now();
    this._resetElectionTimer();

    // If the snapshot is older than what we already have, ignore it
    if (request.lastIncludedIndex <= this._lastSnapshotIndex) {
      this._emitAudit(CONSENSUS_EVENT.SNAPSHOT_REJECTED, {
        nodeId: this.nodeId,
        leaderId: request.leaderId,
        reason: 'snapshot_older',
        requested: request.lastIncludedIndex,
        current: this._lastSnapshotIndex,
      });
      return { success: false, term: this._currentTerm, matchIndex: this._lastSnapshotIndex, reason: 'snapshot_older' };
    }

    // Discard any log entries that conflict with the snapshot
    // Keep entries that come after lastIncludedIndex if they have the same term
    const localIdx = request.lastIncludedIndex - this._lastSnapshotIndex - 1;
    let remainingLog = [];
    if (localIdx >= 0 && localIdx < this._log.length) {
      const candidate = this._log[localIdx];
      if (candidate && candidate.term === request.lastIncludedTerm) {
        // Keep entries after the snapshot point
        remainingLog = this._log.slice(localIdx + 1);
      }
    }

    // Apply the snapshot
    this._lastSnapshotIndex = request.lastIncludedIndex;
    this._lastSnapshotTerm = request.lastIncludedTerm;
    this._log = remainingLog;
    this._snapshotState = request.state || null;
    this._commitIndex = Math.max(this._commitIndex, this._lastSnapshotIndex);
    this._lastAppliedIndex = Math.max(this._lastAppliedIndex, this._lastSnapshotIndex);

    // Restore state machine if callback provided
    if (this._restoreSnapshotState && request.state) {
      this._restoreSnapshotState(request.state);
    }

    this._emitAudit(CONSENSUS_EVENT.SNAPSHOT_INSTALLED, {
      nodeId: this.nodeId,
      leaderId: request.leaderId,
      lastSnapshotIndex: this._lastSnapshotIndex,
      lastSnapshotTerm: this._lastSnapshotTerm,
      remainingLogLength: this._log.length,
    });

    return { success: true, term: this._currentTerm, matchIndex: this._lastSnapshotIndex };
  }

  /**
   * Get the current snapshot data.
   * @returns {object|null}
   */
  getSnapshot() {
    if (this._lastSnapshotIndex === 0) return null;
    return {
      lastIncludedIndex: this._lastSnapshotIndex,
      lastIncludedTerm: this._lastSnapshotTerm,
      state: this._snapshotState,
    };
  }

  /**
   * Append entries received from a leader (Raft AppendEntries RPC).
   * @param {object} request
   * @param {number} request.term
   * @param {string} request.leaderId
   * @param {object[]} request.entries
   * @param {number} [request.leaderCommit]
   * @returns {object} { success: boolean, matchIndex: number }
   */
  appendEntries(request = {}) {
    if (typeof request.term !== 'number' || !request.leaderId) {
      throw new HsmAdapterError('INVALID_INPUT', 'appendEntries requires term and leaderId');
    }
    if (!this.clusterNodes.has(request.leaderId)) {
      throw new HsmAdapterError('UNKNOWN_LEADER', `leader ${request.leaderId} not in cluster`);
    }

    // Byzantine hardening: verify RPC signature
    const payload = this._extractSignablePayload(request);
    if (!this.verifyRpcFrame(payload, request.leaderId, request.signature)) {
      return { success: false, term: this._currentTerm, matchIndex: this._matchIndexFor(this.nodeId), reason: 'signature_invalid' };
    }

    // Stale term — reject
    if (request.term < this._currentTerm) {
      return { success: false, term: this._currentTerm, matchIndex: this._matchIndexFor(this.nodeId) };
    }

    // Term advancement
    if (request.term > this._currentTerm) {
      this._currentTerm = request.term;
      this._votedFor = null;
      this._emitAudit(CONSENSUS_EVENT.TERM_ADVANCED, {
        nodeId: this.nodeId,
        newTerm: this._currentTerm,
        source: 'appendEntries',
      });
    }

    this._state = NODE_STATE.FOLLOWER;
    this._leaderId = request.leaderId;
    this._lastHeartbeatReceived = Date.now();
    this._resetElectionTimer();

    // Append new entries
    // Phase 6: Account for snapshot offset — local array index = entry.index - _lastSnapshotIndex - 1
    let matchIndex = this._log.length + this._lastSnapshotIndex;
    if (Array.isArray(request.entries) && request.entries.length > 0) {
      for (const entry of request.entries) {
        const localIdx = entry.index - this._lastSnapshotIndex - 1;
        if (localIdx < 0) continue; // entry already in snapshot — skip
        if (localIdx < this._log.length) {
          this._log[localIdx] = { ...entry, committed: false };
        } else {
          this._log.push({ ...entry, committed: false });
        }
        matchIndex = entry.index;
      }
    }

    // Advance commit index
    if (typeof request.leaderCommit === 'number' && request.leaderCommit > this._commitIndex) {
      this._commitIndex = Math.min(request.leaderCommit, this._log.length + this._lastSnapshotIndex);
      this._applyCommittedEntries();
    }

    return { success: true, term: this._currentTerm, matchIndex };
  }

  /**
   * Send heartbeats to all followers. Called periodically by the leader.
   * @returns {Promise<object>} { sent: number, acked: number }
   */
  async sendHeartbeats() {
    if (this._state !== NODE_STATE.LEADER) {
      return { sent: 0, acked: 0 };
    }

    let acked = 0;
    for (const targetId of this.clusterNodes) {
      if (targetId === this.nodeId) continue;
      let success = false;
      if (this._sendHeartbeat) {
        // Phase 7: Auto-sign outbound heartbeat payload
        const heartbeatPayload = {
          term: this._currentTerm,
          leaderId: this.nodeId,
          commitIndex: this._commitIndex,
        };
        const signedEnvelope = this._signOutboundFrame(heartbeatPayload);
        try {
          success = await this._sendHeartbeat(targetId, signedEnvelope);
        } catch {
          success = false;
        }
      } else {
        success = true;
      }
      if (success) acked += 1;
    }

    this._emitAudit(CONSENSUS_EVENT.HEARTBEAT_SENT, {
      leaderId: this.nodeId,
      term: this._currentTerm,
      sent: this.clusterNodes.size - 1,
      acked,
    });

    // Check if we still have quorum
    if (acked + 1 < this.minQuorumNodes) {
      this._emitAudit(CONSENSUS_EVENT.QUORUM_LOST, {
        leaderId: this.nodeId,
        term: this._currentTerm,
        acked: acked + 1,
        required: this.minQuorumNodes,
      });
      // Step down to follower
      this._state = NODE_STATE.FOLLOWER;
      this._leaderId = null;
      this._resetElectionTimer();
    }

    return { sent: this.clusterNodes.size - 1, acked };
  }

  // ── Internal helpers ───────────────────────────────────────────

  _becomeLeader() {
    this._state = NODE_STATE.LEADER;
    this._leaderId = this.nodeId;

    // Initialize nextIndex/matchIndex for all followers
    // Phase 6: Use absolute log index (including snapshot offset)
    for (const targetId of this.clusterNodes) {
      if (targetId === this.nodeId) continue;
      this._nextIndex.set(targetId, this._log.length + this._lastSnapshotIndex + 1);
      this._matchIndex.set(targetId, 0);
    }

    this._emitAudit(CONSENSUS_EVENT.LEADER_ELECTED, {
      leaderId: this.nodeId,
      term: this._currentTerm,
      votes: this._votesReceived.size,
      clusterSize: this.clusterNodes.size,
    });

    // Start heartbeat loop
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    this._heartbeatTimer = setInterval(() => {
      this.sendHeartbeats().catch(() => { /* swallow */ });
    }, this.heartbeatIntervalMs);
  }

  _resetElectionTimer() {
    if (this._electionTimer) clearTimeout(this._electionTimer);
    if (!this._started || this._state === NODE_STATE.LEADER) return;

    // Randomized election timeout to avoid split votes
    const jitter = Math.floor(Math.random() * this.electionTimeoutWindow);
    const timeout = this.electionTimeoutMs + jitter;

    this._electionTimer = setTimeout(() => {
      if (this._started && this._state !== NODE_STATE.LEADER) {
        this._emitAudit(CONSENSUS_EVENT.ELECTION_TIMEOUT, {
          nodeId: this.nodeId,
          term: this._currentTerm,
          timeoutMs: timeout,
        });
        this.startElection().catch(() => { /* swallow */ });
      }
    }, timeout);
  }

  _applyCommittedEntries() {
    while (this._lastAppliedIndex < this._commitIndex) {
      this._lastAppliedIndex += 1;
      // Phase 6: Account for snapshot offset when indexing into log array
      const localIdx = this._lastAppliedIndex - this._lastSnapshotIndex - 1;
      const entry = this._log[localIdx];
      if (entry) {
        entry.committed = true;
        // Phase 5: Apply peer key rotation commands when committed
        this._applyConsensusCommand(entry);
      }
    }
  }

  /**
   * Apply a committed consensus command to the local state machine.
   * Supports peer key rotation operations (addPeerKey, revokePeerKey).
   * @param {object} entry - committed log entry
   * @private
   */
  _applyConsensusCommand(entry) {
    if (!entry.command || typeof entry.command !== 'object') return;
    const { operation } = entry.command;
    if (operation === 'addPeerKey') {
      this._peerPublicKeys.set(entry.command.nodeId, entry.command.publicKey);
      this._emitAudit(CONSENSUS_EVENT.PEER_KEY_ADDED, {
        nodeId: this.nodeId,
        peerNodeId: entry.command.nodeId,
        logIndex: entry.index,
      });
    } else if (operation === 'revokePeerKey') {
      this._peerPublicKeys.delete(entry.command.nodeId);
      this._lastSeenNonce.delete(entry.command.nodeId);
      this._emitAudit(CONSENSUS_EVENT.PEER_KEY_REVOKED, {
        nodeId: this.nodeId,
        peerNodeId: entry.command.nodeId,
        logIndex: entry.index,
      });
    }
  }

  _matchIndexFor(nodeId) {
    return this._matchIndex.get(nodeId) || 0;
  }

  // ── Byzantine hardening: RPC frame signing/verification ─────────

  /**
   * Sign an RPC frame payload with this node's Ed25519 private key.
   * Automatically injects a monotonic nonce and timestamp for replay protection.
   * @param {object} payload - the RPC payload to sign
   * @returns {{ signature: string, nonce: number, timestamp: number }|null}
   */
  signRpcFrame(payload) {
    if (!this._signingKeyPair?.privateKey) return null;
    const nonce = ++this._localNonce;
    const timestamp = Date.now();
    const enrichedPayload = { ...payload, nonce, timestamp };
    const data = Buffer.from(JSON.stringify(enrichedPayload), 'utf8');
    const sig = crypto.sign(null, data, this._signingKeyPair.privateKey);
    this._emitAudit(CONSENSUS_EVENT.RPC_SIGNED, {
      nodeId: this.nodeId,
      payloadSize: data.length,
      nonce,
      timestamp,
    });
    return { signature: sig.toString('base64'), nonce, timestamp };
  }

  /**
   * Verify an inbound RPC frame's signature against the sender's public key.
   * @param {object} payload - the RPC payload (without signature)
   * @param {string} senderId - the claimed sender node ID
   * @param {string} signature - base64 signature to verify
   * @returns {boolean} true if signature is valid and frame is not a replay
   */
  verifyRpcFrame(payload, senderId, signature) {
    if (!signature) {
      if (this._requireRpcSigning) {
        this._emitAudit(CONSENSUS_EVENT.SIGNATURE_INVALID, {
          nodeId: this.nodeId,
          senderId,
          reason: 'missing_signature',
        });
        return false;
      }
      return true; // signing not required — accept unsigned
    }

    const publicKey = this._peerPublicKeys.get(senderId);
    if (!publicKey) {
      this._emitAudit(CONSENSUS_EVENT.PEER_KEY_UNKNOWN, {
        nodeId: this.nodeId,
        senderId,
        reason: 'no_public_key_for_sender',
      });
      return false;
    }

    // Phase 4: Replay protection — timestamp freshness check
    if (this._enableReplayProtection && typeof payload.timestamp === 'number') {
      const now = Date.now();
      const age = now - payload.timestamp;
      if (age > this._replayWindowMs) {
        this._emitAudit(CONSENSUS_EVENT.TIMESTAMP_EXPIRED, {
          nodeId: this.nodeId,
          senderId,
          age,
          window: this._replayWindowMs,
          timestamp: payload.timestamp,
        });
        return false;
      }
      // Reject future timestamps beyond tolerance (clock skew)
      if (payload.timestamp > now + this._replayWindowMs) {
        this._emitAudit(CONSENSUS_EVENT.TIMESTAMP_EXPIRED, {
          nodeId: this.nodeId,
          senderId,
          age: -age,
          reason: 'future_timestamp',
          window: this._replayWindowMs,
        });
        return false;
      }
    }

    // Phase 4: Replay protection — nonce monotonicity check
    if (this._enableReplayProtection && typeof payload.nonce === 'number') {
      const lastNonce = this._lastSeenNonce.get(senderId) || 0;
      if (payload.nonce <= lastNonce) {
        this._emitAudit(CONSENSUS_EVENT.NONCE_STALE, {
          nodeId: this.nodeId,
          senderId,
          nonce: payload.nonce,
          lastSeen: lastNonce,
        });
        return false;
      }
    }

    const data = Buffer.from(JSON.stringify(payload), 'utf8');
    const sigBuf = Buffer.from(signature, 'base64');
    try {
      const valid = crypto.verify(null, data, publicKey, sigBuf);
      if (!valid) {
        this._emitAudit(CONSENSUS_EVENT.SIGNATURE_INVALID, {
          nodeId: this.nodeId,
          senderId,
          reason: 'signature_mismatch',
        });
        return false;
      }
      // Signature valid — record nonce to prevent replay
      if (this._enableReplayProtection && typeof payload.nonce === 'number') {
        this._lastSeenNonce.set(senderId, payload.nonce);
      }
      this._emitAudit(CONSENSUS_EVENT.RPC_VERIFIED, {
        nodeId: this.nodeId,
        senderId,
        nonce: payload.nonce,
        timestamp: payload.timestamp,
      });
      return true;
    } catch (err) {
      this._emitAudit(CONSENSUS_EVENT.SIGNATURE_INVALID, {
        nodeId: this.nodeId,
        senderId,
        reason: 'verification_error',
        error: err.message,
      });
      return false;
    }
  }

  /**
   * Phase 7: Sign an outbound RPC payload and return the signed envelope.
   * If autoSignOutbound is disabled or no signing key is configured, returns
   * the payload as-is (unsigned).
   * @param {object} payload - the RPC payload to sign
   * @returns {object} signed envelope { ...payload, signature, nonce, timestamp }
   * @private
   */
  _signOutboundFrame(payload) {
    if (!this._autoSignOutbound || !this._signingKeyPair?.privateKey) {
      return payload;
    }
    const result = this.signRpcFrame(payload);
    if (!result) {
      this._emitAudit(CONSENSUS_EVENT.OUTBOUND_SIGN_FAILED, {
        nodeId: this.nodeId,
        reason: 'sign_returned_null',
      });
      return payload;
    }
    // Deep-copy the payload to prevent post-signing mutations (e.g. entry.committed)
    // from invalidating the signature on captured envelopes.
    const frozen = JSON.parse(JSON.stringify(payload));
    const envelope = { ...frozen, signature: result.signature, nonce: result.nonce, timestamp: result.timestamp };
    this._emitAudit(CONSENSUS_EVENT.OUTBOUND_SIGNED, {
      nodeId: this.nodeId,
      nonce: result.nonce,
      timestamp: result.timestamp,
    });
    return envelope;
  }

  /**
   * Extract the signable payload from an RPC request (excluding the signature field).
   * @param {object} request - full RPC request with optional signature
   * @returns {object} payload without signature
   * @private
   */
  _extractSignablePayload(request) {
    const { signature, ...payload } = request;
    return payload;
  }

  _emitAudit(event, info) {
    if (this._audit) this._audit(event, { timestamp: Date.now(), ...info });
    // Lazy-require metrics module to avoid circular deps
    try {
      const metrics = require('./hsm-metrics.cjs');
const { validateTenantContext, TENANT_FIELD, DEFAULT_TENANT } = require('../replication-tenant-context.cjs');
      switch (event) {
        case CONSENSUS_EVENT.VOTE_REQUESTED:
          metrics.incrementCounter('hsm_consensus_leader_elections_total');
          break;
        case CONSENSUS_EVENT.LEADER_ELECTED:
          metrics.incrementCounter('hsm_consensus_leader_elections_won_total');
          break;
        case CONSENSUS_EVENT.QUORUM_LOST:
          metrics.incrementCounter('hsm_consensus_quorum_lost_total');
          break;
        case CONSENSUS_EVENT.LOG_REPLICATED:
          metrics.incrementCounter('hsm_consensus_log_replicated_total');
          break;
        case CONSENSUS_EVENT.LOG_COMMITTED:
          metrics.incrementCounter('hsm_consensus_log_committed_total');
          break;
        case CONSENSUS_EVENT.HEARTBEAT_SENT:
          metrics.incrementCounter('hsm_consensus_heartbeats_sent_total');
          break;
        case CONSENSUS_EVENT.RPC_SIGNED:
          metrics.incrementCounter('hsm_consensus_rpc_signed_total');
          break;
        case CONSENSUS_EVENT.RPC_VERIFIED:
          metrics.incrementCounter('hsm_consensus_rpc_verified_total');
          break;
        case CONSENSUS_EVENT.SIGNATURE_INVALID:
          metrics.incrementCounter('hsm_consensus_signature_invalid_total');
          break;
        case CONSENSUS_EVENT.PEER_KEY_UNKNOWN:
          metrics.incrementCounter('hsm_consensus_peer_key_unknown_total');
          break;
        case CONSENSUS_EVENT.NONCE_STALE:
          metrics.incrementCounter('hsm_consensus_nonce_stale_total');
          metrics.incrementCounter('hsm_consensus_replay_detected_total');
          break;
        case CONSENSUS_EVENT.TIMESTAMP_EXPIRED:
          metrics.incrementCounter('hsm_consensus_timestamp_expired_total');
          metrics.incrementCounter('hsm_consensus_replay_detected_total');
          break;
        case CONSENSUS_EVENT.PEER_KEY_ADDED:
          metrics.incrementCounter('hsm_consensus_peer_key_added_total');
          break;
        case CONSENSUS_EVENT.PEER_KEY_REVOKED:
          metrics.incrementCounter('hsm_consensus_peer_key_revoked_total');
          break;
        case CONSENSUS_EVENT.PEER_KEY_ROTATION_BLOCKED:
          metrics.incrementCounter('hsm_consensus_peer_key_rotation_blocked_total');
          break;
        case CONSENSUS_EVENT.SNAPSHOT_CREATED:
          metrics.incrementCounter('hsm_consensus_snapshot_created_total');
          break;
        case CONSENSUS_EVENT.SNAPSHOT_INSTALLED:
          metrics.incrementCounter('hsm_consensus_snapshot_installed_total');
          break;
        case CONSENSUS_EVENT.SNAPSHOT_REJECTED:
          metrics.incrementCounter('hsm_consensus_snapshot_rejected_total');
          break;
        case CONSENSUS_EVENT.OUTBOUND_SIGNED:
          metrics.incrementCounter('hsm_consensus_outbound_signed_total');
          break;
        case CONSENSUS_EVENT.OUTBOUND_SIGN_FAILED:
          metrics.incrementCounter('hsm_consensus_outbound_sign_failed_total');
          break;
      }
    } catch { /* metrics module optional */ }
  }
}

module.exports = {
  ClusterConsensusEngine,
  NODE_STATE,
  CONSENSUS_EVENT,
};
