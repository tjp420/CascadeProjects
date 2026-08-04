'use strict';

/**
 * Track 40: Distributed Consensus Coordinator.
 *
 * Orchestrates multiple ClusterConsensusEngine (Track 34) instances across
 * consensus groups. Provides multi-group management, cross-group proposal
 * routing, view change coordination, fault detection, and unified state
 * tracking.
 *
 * @module hsm-adapter/distributed-consensus-coordinator
 */

const { HsmAdapterError } = require('./base-adapter.cjs');
const { CryptoPolicyEngine } = require('./crypto-policy-engine.cjs');
const hsmMetrics = require('./hsm-metrics.cjs');

// ── Consensus group states ──────────────────────────────────────
const GROUP_STATE = {
  ACTIVE: 'active',
  DEGRADED: 'degraded',
  RECONFIGURING: 'reconfiguring',
  DESTROYED: 'destroyed',
};

const COORDINATOR_EVENT = {
  GROUP_CREATED: 'COORD_GROUP_CREATED',
  GROUP_DESTROYED: 'COORD_GROUP_DESTROYED',
  PROPOSAL_ROUTED: 'COORD_PROPOSAL_ROUTED',
  PROPOSAL_REJECTED: 'COORD_PROPOSAL_REJECTED',
  FAULT_DETECTED: 'COORD_FAULT_DETECTED',
  VIEW_CHANGE_STARTED: 'COORD_VIEW_CHANGE_STARTED',
  VIEW_CHANGE_COMPLETED: 'COORD_VIEW_CHANGE_COMPLETED',
  VIEW_CHANGE_ABORTED: 'COORD_VIEW_CHANGE_ABORTED',
  QUORUM_VERIFIED: 'COORD_QUORUM_VERIFIED',
  QUORUM_DENIED: 'COORD_QUORUM_DENIED',
};

/**
 * Distributed Consensus Coordinator.
 *
 * Manages multiple consensus groups, each backed by a ClusterConsensusEngine.
 * Routes proposals cross-group, coordinates view changes, and detects faults.
 */
class DistributedConsensusCoordinator {
  /**
   * @param {object} options
   * @param {string} options.coordinatorId - unique identifier for this coordinator
   * @param {string} options.nodeId - this node's ID (passed to consensus engines)
   * @param {number} [options.maxGroups=64] - maximum consensus groups allowed
   * @param {number} [options.faultTimeoutMs=3000] - heartbeat timeout before fault declared
   * @param {number} [options.faultCheckIntervalMs=1000] - fault detector polling interval
   * @param {number} [options.viewChangeTimeoutMs=5000] - max time for a view change
   * @param {Function} [options.audit] - audit callback (event, info) => void
   * @param {Function} [options.engineFactory] - factory to create consensus engines
   * @param {object} [options.policy] - policy limits from crypto-policy-engine
   */
  constructor(options = {}) {
    if (!options.coordinatorId) {
      throw new HsmAdapterError('INVALID_INPUT', 'coordinatorId is required');
    }
    if (!options.nodeId) {
      throw new HsmAdapterError('INVALID_INPUT', 'nodeId is required');
    }

    this.coordinatorId = options.coordinatorId;
    this.nodeId = options.nodeId;
    this.maxGroups = options.maxGroups || 64;
    this.faultTimeoutMs = options.faultTimeoutMs || 3000;
    this.faultCheckIntervalMs = options.faultCheckIntervalMs || 1000;
    this.viewChangeTimeoutMs = options.viewChangeTimeoutMs || 5000;
    this._audit = options.audit || null;
    this._engineFactory = options.engineFactory || null;
    this._policy = options.policy || {};

    // Track 118: Read boolean attributes from options (previously missing)
    this.requireQuorumForProposals = options.requireQuorumForProposals !== false;
    this.allowDynamicGroupCreation = options.allowDynamicGroupCreation !== false;
    this.allowCrossGroupRouting = options.allowCrossGroupRouting !== false;

    // Track 118: Validate config against policy at construction time
    this._policyEngine = options.policyEngine || new CryptoPolicyEngine({ default: {} });
    this._policyEngine.validate('default', 'distributedConsensusCoordinator', {
      maxGroups: this.maxGroups,
      faultTimeoutMs: this.faultTimeoutMs,
      faultCheckIntervalMs: this.faultCheckIntervalMs,
      viewChangeTimeoutMs: this.viewChangeTimeoutMs,
      requireQuorumForProposals: this.requireQuorumForProposals,
      allowDynamicGroupCreation: this.allowDynamicGroupCreation,
      allowCrossGroupRouting: this.allowCrossGroupRouting,
    });

    // Group registry: groupId -> { engine, state, keyRange, topic, nodes, lastHeartbeat, leaderId }
    this._groups = new Map();

    // Node health tracker: nodeId -> { lastSeen, healthy, groups }
    this._nodeHealth = new Map();

    // Active view changes: groupId -> { startTime, candidateId, votes }
    this._viewChanges = new Map();

    // Fault detector timer
    this._faultTimer = null;
    this._started = false;
  }

  /**
   * Start the coordinator — begins fault detection polling.
   */
  start() {
    if (this._started) return;
    this._started = true;
    this._resetFaultTimer();
    this._emitAudit(COORDINATOR_EVENT.GROUP_CREATED, {
      coordinatorId: this.coordinatorId,
      message: 'coordinator started',
    });
  }

  /**
   * Stop the coordinator and clean up timers.
   */
  stop() {
    this._started = false;
    if (this._faultTimer) {
      clearTimeout(this._faultTimer);
      this._faultTimer = null;
    }
  }

  /**
   * Create a new consensus group.
   * @param {object} options
   * @param {string} options.groupId - unique group identifier
   * @param {string[]} options.clusterNodes - node IDs in this group
   * @param {string} [options.topic] - topic name for topic-based routing
   * @param {object} [options.keyRange] - { start, end } for key-range routing
   * @param {object} [options.engineOptions] - additional options for the consensus engine
   * @returns {object} created group info
   */
  createGroup(options = {}) {
    if (!options.groupId) {
      throw new HsmAdapterError('INVALID_INPUT', 'groupId is required');
    }
    if (this._groups.has(options.groupId)) {
      throw new HsmAdapterError('GROUP_EXISTS', `group ${options.groupId} already exists`);
    }
    if (!this.allowDynamicGroupCreation) {
      hsmMetrics.incrementCounter('hsm_consensus_coord_proposals_rejected_total');
      throw new HsmAdapterError('GROUP_CREATION_BLOCKED', 'dynamic group creation is restricted by policy');
    }
    if (this._groups.size >= this.maxGroups) {
      throw new HsmAdapterError('MAX_GROUPS_EXCEEDED', `max ${this.maxGroups} groups reached`);
    }
    if (!Array.isArray(options.clusterNodes) || options.clusterNodes.length === 0) {
      throw new HsmAdapterError('INVALID_INPUT', 'clusterNodes must be a non-empty array');
    }
    if (!options.clusterNodes.includes(this.nodeId)) {
      throw new HsmAdapterError('INVALID_INPUT', `nodeId ${this.nodeId} must be in clusterNodes`);
    }

    // Create engine via factory or require the caller to set it later
    let engine = null;
    if (this._engineFactory) {
      engine = this._engineFactory({
        nodeId: this.nodeId,
        clusterNodes: options.clusterNodes,
        ...options.engineOptions,
      });
    }

    const group = {
      groupId: options.groupId,
      engine,
      state: GROUP_STATE.ACTIVE,
      topic: options.topic || null,
      keyRange: options.keyRange || null,
      nodes: new Set(options.clusterNodes),
      lastHeartbeat: Date.now(),
      leaderId: null,
      createdAt: Date.now(),
    };

    this._groups.set(options.groupId, group);

    // Register nodes in health tracker
    for (const nodeId of options.clusterNodes) {
      if (!this._nodeHealth.has(nodeId)) {
        this._nodeHealth.set(nodeId, {
          lastSeen: Date.now(),
          healthy: true,
          groups: new Set(),
        });
      }
      this._nodeHealth.get(nodeId).groups.add(options.groupId);
    }

    hsmMetrics.incrementCounter('hsm_consensus_coord_groups_created_total');
    this._emitAudit(COORDINATOR_EVENT.GROUP_CREATED, {
      groupId: options.groupId,
      nodes: options.clusterNodes,
      topic: options.topic || null,
    });

    return {
      groupId: options.groupId,
      state: group.state,
      nodes: options.clusterNodes,
      topic: group.topic,
      keyRange: group.keyRange,
    };
  }

  /**
   * Destroy a consensus group.
   * @param {string} groupId
   * @returns {boolean} true if destroyed
   */
  destroyGroup(groupId) {
    const group = this._groups.get(groupId);
    if (!group) {
      throw new HsmAdapterError('GROUP_NOT_FOUND', `group ${groupId} not found`);
    }

    if (group.engine && typeof group.engine.stop === 'function') {
      group.engine.stop();
    }

    group.state = GROUP_STATE.DESTROYED;
    this._groups.delete(groupId);

    // Remove group from node health tracker
    for (const nodeId of group.nodes) {
      const health = this._nodeHealth.get(nodeId);
      if (health) {
        health.groups.delete(groupId);
        if (health.groups.size === 0) {
          this._nodeHealth.delete(nodeId);
        }
      }
    }

    hsmMetrics.incrementCounter('hsm_consensus_coord_groups_destroyed_total');
    this._emitAudit(COORDINATOR_EVENT.GROUP_DESTROYED, { groupId });

    return true;
  }

  /**
   * Route a proposal to the appropriate consensus group.
   * @param {object} proposal
   * @param {string} [proposal.groupId] - explicit group ID
   * @param {string} [proposal.topic] - topic for topic-based routing
   * @param {string} [proposal.key] - key for key-range routing
   * @param {object} proposal.command - the command to propose
   * @returns {object} routing result
   */
  routeProposal(proposal = {}) {
    let targetGroup = null;

    // Explicit group ID
    if (proposal.groupId) {
      targetGroup = this._groups.get(proposal.groupId);
      if (!targetGroup) {
        hsmMetrics.incrementCounter('hsm_consensus_coord_proposals_rejected_total');
        this._emitAudit(COORDINATOR_EVENT.PROPOSAL_REJECTED, {
          reason: 'group_not_found',
          groupId: proposal.groupId,
        });
        return { accepted: false, reason: 'group_not_found', groupId: proposal.groupId };
      }
    }
    // Topic-based routing
    else if (proposal.topic) {
      for (const group of this._groups.values()) {
        if (group.topic === proposal.topic && group.state === GROUP_STATE.ACTIVE) {
          targetGroup = group;
          break;
        }
      }
      if (!targetGroup) {
        hsmMetrics.incrementCounter('hsm_consensus_coord_proposals_rejected_total');
        this._emitAudit(COORDINATOR_EVENT.PROPOSAL_REJECTED, {
          reason: 'no_group_for_topic',
          topic: proposal.topic,
        });
        return { accepted: false, reason: 'no_group_for_topic', topic: proposal.topic };
      }
    }
    // Key-range routing
    else if (proposal.key) {
      for (const group of this._groups.values()) {
        if (group.keyRange && group.state === GROUP_STATE.ACTIVE) {
          if (proposal.key >= group.keyRange.start && proposal.key <= group.keyRange.end) {
            targetGroup = group;
            break;
          }
        }
      }
      if (!targetGroup) {
        hsmMetrics.incrementCounter('hsm_consensus_coord_proposals_rejected_total');
        this._emitAudit(COORDINATOR_EVENT.PROPOSAL_REJECTED, {
          reason: 'no_group_for_key',
          key: proposal.key,
        });
        return { accepted: false, reason: 'no_group_for_key', key: proposal.key };
      }
    } else {
      hsmMetrics.incrementCounter('hsm_consensus_coord_proposals_rejected_total');
      this._emitAudit(COORDINATOR_EVENT.PROPOSAL_REJECTED, {
        reason: 'no_routing_key',
      });
      return { accepted: false, reason: 'no_routing_key' };
    }

    // Check group state
    if (targetGroup.state !== GROUP_STATE.ACTIVE) {
      hsmMetrics.incrementCounter('hsm_consensus_coord_proposals_rejected_total');
      this._emitAudit(COORDINATOR_EVENT.PROPOSAL_REJECTED, {
        reason: 'group_not_active',
        groupId: targetGroup.groupId,
        state: targetGroup.state,
      });
      return { accepted: false, reason: 'group_not_active', groupId: targetGroup.groupId };
    }

    // Check quorum — only if policy requires it
    let healthyNodes = 0;
    let minQuorum = 0;
    if (this.requireQuorumForProposals) {
      healthyNodes = this._countHealthyNodes(targetGroup);
      minQuorum = Math.floor(targetGroup.nodes.size / 2) + 1;
      if (healthyNodes < minQuorum) {
        hsmMetrics.incrementCounter('hsm_consensus_coord_proposals_rejected_total');
        hsmMetrics.incrementCounter('hsm_consensus_coord_quorum_denied_total');
        this._emitAudit(COORDINATOR_EVENT.QUORUM_DENIED, {
          groupId: targetGroup.groupId,
          healthyNodes,
          minQuorum,
        });
        return {
          accepted: false,
          reason: 'quorum_not_met',
          groupId: targetGroup.groupId,
          healthyNodes,
          minQuorum,
        };
      }
    }

    // Check cross-group routing — if proposal targets a different group
    if (!this.allowCrossGroupRouting && proposal.crossGroup) {
      hsmMetrics.incrementCounter('hsm_consensus_coord_proposals_rejected_total');
      this._emitAudit(COORDINATOR_EVENT.PROPOSAL_REJECTED, {
        reason: 'cross_group_routing_blocked',
        groupId: targetGroup.groupId,
      });
      return { accepted: false, reason: 'cross_group_routing_blocked', groupId: targetGroup.groupId };
    }

    hsmMetrics.incrementCounter('hsm_consensus_coord_proposals_routed_total');
    hsmMetrics.incrementCounter('hsm_consensus_coord_quorum_verified_total');
    this._emitAudit(COORDINATOR_EVENT.PROPOSAL_ROUTED, {
      groupId: targetGroup.groupId,
    });
    this._emitAudit(COORDINATOR_EVENT.QUORUM_VERIFIED, {
      groupId: targetGroup.groupId,
      healthyNodes,
      minQuorum,
    });

    return {
      accepted: true,
      groupId: targetGroup.groupId,
      healthyNodes,
      minQuorum,
    };
  }

  /**
   * Record a heartbeat from a node for a specific group.
   * @param {string} nodeId
   * @param {string} groupId
   * @param {object} [info] - additional info (leaderId, term, etc.)
   */
  recordHeartbeat(nodeId, groupId, info = {}) {
    const group = this._groups.get(groupId);
    if (!group) {
      throw new HsmAdapterError('GROUP_NOT_FOUND', `group ${groupId} not found`);
    }
    if (!group.nodes.has(nodeId)) {
      throw new HsmAdapterError('NODE_NOT_IN_GROUP', `node ${nodeId} not in group ${groupId}`);
    }

    group.lastHeartbeat = Date.now();
    if (info.leaderId) {
      group.leaderId = info.leaderId;
    }

    const health = this._nodeHealth.get(nodeId);
    if (health) {
      health.lastSeen = Date.now();
      health.healthy = true;
    }
  }

  /**
   * Initiate a view change for a group (leader reconfiguration).
   * @param {string} groupId
   * @param {string} failedLeaderId - the leader that failed
   * @param {string} candidateId - the node initiating the view change
   * @returns {object} view change result
   */
  initiateViewChange(groupId, failedLeaderId, candidateId) {
    const group = this._groups.get(groupId);
    if (!group) {
      throw new HsmAdapterError('GROUP_NOT_FOUND', `group ${groupId} not found`);
    }
    if (this._viewChanges.has(groupId)) {
      hsmMetrics.incrementCounter('hsm_consensus_coord_view_change_aborted_total');
      this._emitAudit(COORDINATOR_EVENT.VIEW_CHANGE_ABORTED, {
        groupId,
        reason: 'view_change_in_progress',
      });
      return { accepted: false, reason: 'view_change_in_progress' };
    }

    const viewChange = {
      startTime: Date.now(),
      failedLeaderId,
      candidateId,
      votes: new Set([candidateId]),
      groupId,
    };

    this._viewChanges.set(groupId, viewChange);
    group.state = GROUP_STATE.RECONFIGURING;

    hsmMetrics.incrementCounter('hsm_consensus_coord_view_change_started_total');
    this._emitAudit(COORDINATOR_EVENT.VIEW_CHANGE_STARTED, {
      groupId,
      failedLeaderId,
      candidateId,
    });

    return { accepted: true, groupId, candidateId };
  }

  /**
   * Cast a vote for an ongoing view change.
   * @param {string} groupId
   * @param {string} voterId
   * @param {string} candidateId
   * @returns {object} vote result
   */
  castViewChangeVote(groupId, voterId, candidateId) {
    const viewChange = this._viewChanges.get(groupId);
    if (!viewChange) {
      return { accepted: false, reason: 'no_view_change_in_progress' };
    }
    if (viewChange.candidateId !== candidateId) {
      return { accepted: false, reason: 'candidate_mismatch' };
    }

    viewChange.votes.add(voterId);

    const group = this._groups.get(groupId);
    if (!group) return { accepted: false, reason: 'group_not_found' };

    const minQuorum = Math.floor(group.nodes.size / 2) + 1;
    if (viewChange.votes.size >= minQuorum) {
      // View change complete
      group.state = GROUP_STATE.ACTIVE;
      group.leaderId = candidateId;
      this._viewChanges.delete(groupId);

      hsmMetrics.incrementCounter('hsm_consensus_coord_view_change_completed_total');
      this._emitAudit(COORDINATOR_EVENT.VIEW_CHANGE_COMPLETED, {
        groupId,
        newLeaderId: candidateId,
        votes: viewChange.votes.size,
      });

      return { accepted: true, completed: true, newLeaderId: candidateId };
    }

    return { accepted: true, completed: false, votes: viewChange.votes.size, minQuorum };
  }

  /**
   * Check for view change timeouts.
   * @returns {string[]} group IDs whose view changes timed out
   */
  checkViewChangeTimeouts() {
    const now = Date.now();
    const timedOut = [];

    for (const [groupId, viewChange] of this._viewChanges) {
      if (now - viewChange.startTime > this.viewChangeTimeoutMs) {
        const group = this._groups.get(groupId);
        if (group) {
          group.state = GROUP_STATE.DEGRADED;
        }
        this._viewChanges.delete(groupId);
        timedOut.push(groupId);

        hsmMetrics.incrementCounter('hsm_consensus_coord_view_change_aborted_total');
        this._emitAudit(COORDINATOR_EVENT.VIEW_CHANGE_ABORTED, {
          groupId,
          reason: 'timeout',
        });
      }
    }

    return timedOut;
  }

  /**
   * Get aggregated state from all consensus groups.
   * @returns {object} unified state
   */
  getAggregatedState() {
    const groups = [];
    let totalActive = 0;
    let totalDegraded = 0;
    let totalReconfiguring = 0;

    for (const [groupId, group] of this._groups) {
      const stateInfo = {
        groupId,
        state: group.state,
        leaderId: group.leaderId,
        nodeCount: group.nodes.size,
        topic: group.topic,
        keyRange: group.keyRange,
        lastHeartbeat: group.lastHeartbeat,
      };
      groups.push(stateInfo);

      if (group.state === GROUP_STATE.ACTIVE) totalActive++;
      else if (group.state === GROUP_STATE.DEGRADED) totalDegraded++;
      else if (group.state === GROUP_STATE.RECONFIGURING) totalReconfiguring++;
    }

    const healthyNodes = Array.from(this._nodeHealth.values()).filter(h => h.healthy).length;
    const totalNodes = this._nodeHealth.size;

    return {
      coordinatorId: this.coordinatorId,
      totalGroups: this._groups.size,
      totalActive,
      totalDegraded,
      totalReconfiguring,
      activeViewChanges: this._viewChanges.size,
      healthyNodes,
      totalNodes,
      groups,
    };
  }

  /**
   * Get a specific group's info.
   * @param {string} groupId
   * @returns {object|null}
   */
  getGroup(groupId) {
    const group = this._groups.get(groupId);
    if (!group) return null;
    return {
      groupId: group.groupId,
      state: group.state,
      topic: group.topic,
      keyRange: group.keyRange,
      nodes: Array.from(group.nodes),
      leaderId: group.leaderId,
      lastHeartbeat: group.lastHeartbeat,
      createdAt: group.createdAt,
    };
  }

  /**
   * List all group IDs.
   * @returns {string[]}
   */
  listGroups() {
    return Array.from(this._groups.keys());
  }

  // ── Internal helpers ──────────────────────────────────────────

  _countHealthyNodes(group) {
    let count = 0;
    for (const nodeId of group.nodes) {
      const health = this._nodeHealth.get(nodeId);
      if (health && health.healthy) count++;
    }
    return count;
  }

  _resetFaultTimer() {
    if (this._faultTimer) clearTimeout(this._faultTimer);
    if (!this._started) return;

    this._faultTimer = setTimeout(() => {
      this._runFaultDetection();
      this._resetFaultTimer();
    }, this.faultCheckIntervalMs);
  }

  _runFaultDetection() {
    const now = Date.now();

    for (const [nodeId, health] of this._nodeHealth) {
      if (now - health.lastSeen > this.faultTimeoutMs && health.healthy) {
        health.healthy = false;
        hsmMetrics.incrementCounter('hsm_consensus_coord_faults_detected_total');
        this._emitAudit(COORDINATOR_EVENT.FAULT_DETECTED, {
          nodeId,
          lastSeen: health.lastSeen,
          elapsed: now - health.lastSeen,
        });

        // Mark affected groups as degraded if they lost their leader
        for (const groupId of health.groups) {
          const group = this._groups.get(groupId);
          if (group && group.leaderId === nodeId && group.state === GROUP_STATE.ACTIVE) {
            group.state = GROUP_STATE.DEGRADED;
          }
        }
      }
      // Recovery — node came back
      else if (now - health.lastSeen <= this.faultTimeoutMs && !health.healthy) {
        health.healthy = true;
      }
    }

    // Check for view change timeouts
    this.checkViewChangeTimeouts();
  }

  _emitAudit(event, info) {
    if (this._audit) {
      try {
        this._audit(event, info);
      } catch {
        /* ignore audit errors */
      }
    }
  }
}

module.exports = {
  DistributedConsensusCoordinator,
  GROUP_STATE,
  COORDINATOR_EVENT,
};
