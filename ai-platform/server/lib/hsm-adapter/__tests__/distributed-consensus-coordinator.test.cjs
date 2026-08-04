'use strict';

/**
 * Tests for Track 40: Distributed Consensus Coordinator.
 *
 * Verifies:
 *   1. Group creation and destruction
 *   2. Cross-group proposal routing (by groupId, topic, key range)
 *   3. Fault detection via heartbeat timeout
 *   4. View change coordination
 *   5. Quorum verification
 *   6. Aggregated state tracking
 *   7. Policy enforcement
 */

const { DistributedConsensusCoordinator, GROUP_STATE, COORDINATOR_EVENT } = require('../distributed-consensus-coordinator.cjs');
const hsmMetrics = require('../../hsm-adapter/hsm-metrics.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');

describe('DistributedConsensusCoordinator', () => {
  let coordinator;
  let auditLog;

  // Permissive policy engine for testing (allows low timeouts)
  const permissivePolicyEngine = new CryptoPolicyEngine({
    default: {},
    tenants: {
      default: {
        distributedConsensusCoordinator: {
          maxGroups: 64,
          faultTimeoutMs: 1,
          faultCheckIntervalMs: 100000,
          viewChangeTimeoutMs: 1,
          requireQuorumForProposals: true,
          allowDynamicGroupCreation: true,
          allowCrossGroupRouting: true,
        },
      },
    },
  });

  beforeEach(() => {
    hsmMetrics.reset();
    auditLog = [];
    coordinator = new DistributedConsensusCoordinator({
      coordinatorId: 'coord-1',
      nodeId: 'node-A',
      maxGroups: 8,
      faultTimeoutMs: 100,
      faultCheckIntervalMs: 50,
      viewChangeTimeoutMs: 200,
      audit: (event, info) => auditLog.push({ event, info }),
      policyEngine: permissivePolicyEngine,
    });
  });

  afterEach(() => {
    coordinator.stop();
  });

  describe('constructor', () => {
    test('requires coordinatorId', () => {
      expect(() => new DistributedConsensusCoordinator({ nodeId: 'n1' })).toThrow();
    });

    test('requires nodeId', () => {
      expect(() => new DistributedConsensusCoordinator({ coordinatorId: 'c1' })).toThrow();
    });

    test('creates coordinator with defaults', () => {
      const c = new DistributedConsensusCoordinator({ coordinatorId: 'c1', nodeId: 'n1' });
      expect(c.coordinatorId).toBe('c1');
      expect(c.nodeId).toBe('n1');
      expect(c.maxGroups).toBe(64);
    });
  });

  describe('createGroup', () => {
    test('creates a consensus group', () => {
      const result = coordinator.createGroup({
        groupId: 'group-1',
        clusterNodes: ['node-A', 'node-B', 'node-C'],
      });

      expect(result.groupId).toBe('group-1');
      expect(result.state).toBe(GROUP_STATE.ACTIVE);
      expect(result.nodes).toEqual(['node-A', 'node-B', 'node-C']);
    });

    test('requires groupId', () => {
      expect(() => coordinator.createGroup({ clusterNodes: ['node-A'] })).toThrow();
    });

    test('rejects duplicate group ID', () => {
      coordinator.createGroup({ groupId: 'g1', clusterNodes: ['node-A', 'node-B'] });
      expect(() => coordinator.createGroup({ groupId: 'g1', clusterNodes: ['node-A', 'node-B'] })).toThrow();
    });

    test('rejects when max groups exceeded', () => {
      const smallCoord = new DistributedConsensusCoordinator({
        coordinatorId: 'coord-small',
        nodeId: 'node-A',
        maxGroups: 2,
        policyEngine: permissivePolicyEngine,
      });
      smallCoord.createGroup({ groupId: 'g1', clusterNodes: ['node-A', 'node-B'] });
      smallCoord.createGroup({ groupId: 'g2', clusterNodes: ['node-A', 'node-B'] });
      expect(() => smallCoord.createGroup({ groupId: 'g3', clusterNodes: ['node-A', 'node-B'] })).toThrow();
      smallCoord.stop();
    });

    test('requires nodeId in clusterNodes', () => {
      expect(() => coordinator.createGroup({ groupId: 'g1', clusterNodes: ['node-B', 'node-C'] })).toThrow();
    });

    test('requires non-empty clusterNodes', () => {
      expect(() => coordinator.createGroup({ groupId: 'g1', clusterNodes: [] })).toThrow();
    });

    test('registers nodes in health tracker', () => {
      coordinator.createGroup({ groupId: 'g1', clusterNodes: ['node-A', 'node-B', 'node-C'] });
      const state = coordinator.getAggregatedState();
      expect(state.totalNodes).toBe(3);
      expect(state.healthyNodes).toBe(3);
    });

    test('increments groups_created metric', () => {
      coordinator.createGroup({ groupId: 'g1', clusterNodes: ['node-A', 'node-B'] });
      const metrics = hsmMetrics.getMetrics();
      expect(metrics.hsm_consensus_coord_groups_created_total).toBe(1);
    });

    test('emits GROUP_CREATED audit event', () => {
      coordinator.createGroup({ groupId: 'g1', clusterNodes: ['node-A', 'node-B'] });
      expect(auditLog.some(e => e.event === COORDINATOR_EVENT.GROUP_CREATED)).toBe(true);
    });
  });

  describe('destroyGroup', () => {
    test('destroys an existing group', () => {
      coordinator.createGroup({ groupId: 'g1', clusterNodes: ['node-A', 'node-B'] });
      expect(coordinator.destroyGroup('g1')).toBe(true);
      expect(coordinator.listGroups()).not.toContain('g1');
    });

    test('throws for non-existent group', () => {
      expect(() => coordinator.destroyGroup('nonexistent')).toThrow();
    });

    test('increments groups_destroyed metric', () => {
      coordinator.createGroup({ groupId: 'g1', clusterNodes: ['node-A', 'node-B'] });
      coordinator.destroyGroup('g1');
      const metrics = hsmMetrics.getMetrics();
      expect(metrics.hsm_consensus_coord_groups_destroyed_total).toBe(1);
    });
  });

  describe('routeProposal', () => {
    beforeEach(() => {
      coordinator.createGroup({
        groupId: 'group-east',
        clusterNodes: ['node-A', 'node-B', 'node-C'],
        topic: 'east-region',
        keyRange: { start: 'a', end: 'm' },
      });
      coordinator.createGroup({
        groupId: 'group-west',
        clusterNodes: ['node-A', 'node-D', 'node-E'],
        topic: 'west-region',
        keyRange: { start: 'n', end: 'z' },
      });
    });

    test('routes by explicit groupId', () => {
      const result = coordinator.routeProposal({ groupId: 'group-east', command: { type: 'put' } });
      expect(result.accepted).toBe(true);
      expect(result.groupId).toBe('group-east');
    });

    test('routes by topic', () => {
      const result = coordinator.routeProposal({ topic: 'west-region', command: { type: 'put' } });
      expect(result.accepted).toBe(true);
      expect(result.groupId).toBe('group-west');
    });

    test('routes by key range', () => {
      const result = coordinator.routeProposal({ key: 'f', command: { type: 'put' } });
      expect(result.accepted).toBe(true);
      expect(result.groupId).toBe('group-east');
    });

    test('routes key in west range correctly', () => {
      const result = coordinator.routeProposal({ key: 'r', command: { type: 'put' } });
      expect(result.accepted).toBe(true);
      expect(result.groupId).toBe('group-west');
    });

    test('rejects for non-existent group', () => {
      const result = coordinator.routeProposal({ groupId: 'nonexistent', command: {} });
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('group_not_found');
    });

    test('rejects for unknown topic', () => {
      const result = coordinator.routeProposal({ topic: 'unknown-topic', command: {} });
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('no_group_for_topic');
    });

    test('rejects for key with no matching range', () => {
      const result = coordinator.routeProposal({ key: '0', command: {} });
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('no_group_for_key');
    });

    test('rejects when no routing key provided', () => {
      const result = coordinator.routeProposal({ command: {} });
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('no_routing_key');
    });

    test('rejects when group is not active', () => {
      // Mark group as degraded by simulating a fault
      coordinator.createGroup({
        groupId: 'group-solo',
        clusterNodes: ['node-A', 'node-B', 'node-C'],
      });
      // Manually set group state to degraded via internal access
      const group = coordinator._groups.get('group-solo');
      group.state = GROUP_STATE.DEGRADED;

      const result = coordinator.routeProposal({ groupId: 'group-solo', command: {} });
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('group_not_active');
    });

    test('increments proposals_routed metric on success', () => {
      coordinator.routeProposal({ groupId: 'group-east', command: {} });
      const metrics = hsmMetrics.getMetrics();
      expect(metrics.hsm_consensus_coord_proposals_routed_total).toBe(1);
    });

    test('increments proposals_rejected metric on failure', () => {
      coordinator.routeProposal({ groupId: 'nonexistent', command: {} });
      const metrics = hsmMetrics.getMetrics();
      expect(metrics.hsm_consensus_coord_proposals_rejected_total).toBe(1);
    });
  });

  describe('quorum verification', () => {
    test('rejects proposal when quorum not met', () => {
      coordinator.createGroup({
        groupId: 'g1',
        clusterNodes: ['node-A', 'node-B', 'node-C', 'node-D', 'node-E'],
      });

      // Mark 3 of 5 nodes as unhealthy (only 2 healthy, need 3 for quorum)
      coordinator._nodeHealth.get('node-B').healthy = false;
      coordinator._nodeHealth.get('node-C').healthy = false;
      coordinator._nodeHealth.get('node-D').healthy = false;

      const result = coordinator.routeProposal({ groupId: 'g1', command: {} });
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('quorum_not_met');
      expect(result.healthyNodes).toBe(2);
      expect(result.minQuorum).toBe(3);
    });

    test('increments quorum_denied metric', () => {
      coordinator.createGroup({
        groupId: 'g1',
        clusterNodes: ['node-A', 'node-B', 'node-C'],
      });
      coordinator._nodeHealth.get('node-B').healthy = false;
      coordinator._nodeHealth.get('node-C').healthy = false;

      coordinator.routeProposal({ groupId: 'g1', command: {} });
      const metrics = hsmMetrics.getMetrics();
      expect(metrics.hsm_consensus_coord_quorum_denied_total).toBe(1);
    });
  });

  describe('view change', () => {
    beforeEach(() => {
      coordinator.createGroup({
        groupId: 'g1',
        clusterNodes: ['node-A', 'node-B', 'node-C', 'node-D', 'node-E'],
      });
    });

    test('initiates a view change', () => {
      const result = coordinator.initiateViewChange('g1', 'node-B', 'node-A');
      expect(result.accepted).toBe(true);
      expect(result.candidateId).toBe('node-A');
    });

    test('rejects duplicate view change for same group', () => {
      coordinator.initiateViewChange('g1', 'node-B', 'node-A');
      const result = coordinator.initiateViewChange('g1', 'node-B', 'node-C');
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('view_change_in_progress');
    });

    test('completes view change when quorum of votes received', () => {
      // 5 nodes → quorum = 3. Candidate starts with 1 vote (itself).
      coordinator.initiateViewChange('g1', 'node-B', 'node-A');

      // 1 vote from candidate + 1 from node-B = 2 votes (not yet quorum)
      const r1 = coordinator.castViewChangeVote('g1', 'node-B', 'node-A');
      expect(r1.completed).toBe(false);

      // 1 + 1 + 1 from node-C = 3 votes = quorum → completed
      const r2 = coordinator.castViewChangeVote('g1', 'node-C', 'node-A');
      expect(r2.completed).toBe(true);
      expect(r2.newLeaderId).toBe('node-A');
    });

    test('rejects vote for wrong candidate', () => {
      coordinator.initiateViewChange('g1', 'node-B', 'node-A');
      const result = coordinator.castViewChangeVote('g1', 'node-C', 'node-D');
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('candidate_mismatch');
    });

    test('rejects vote when no view change in progress', () => {
      const result = coordinator.castViewChangeVote('g1', 'node-C', 'node-A');
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('no_view_change_in_progress');
    });

    test('increments view_change_started metric', () => {
      coordinator.initiateViewChange('g1', 'node-B', 'node-A');
      const metrics = hsmMetrics.getMetrics();
      expect(metrics.hsm_consensus_coord_view_change_started_total).toBe(1);
    });

    test('increments view_change_completed metric', () => {
      coordinator.initiateViewChange('g1', 'node-B', 'node-A');
      coordinator.castViewChangeVote('g1', 'node-B', 'node-A');
      coordinator.castViewChangeVote('g1', 'node-C', 'node-A');
      coordinator.castViewChangeVote('g1', 'node-D', 'node-A');
      const metrics = hsmMetrics.getMetrics();
      expect(metrics.hsm_consensus_coord_view_change_completed_total).toBe(1);
    });

    test('aborts view change on timeout', () => {
      coordinator.initiateViewChange('g1', 'node-B', 'node-A');

      // Simulate timeout by backdating the view change start time
      const viewChange = coordinator._viewChanges.get('g1');
      viewChange.startTime = Date.now() - 300; // viewChangeTimeoutMs = 200

      const timedOut = coordinator.checkViewChangeTimeouts();
      expect(timedOut).toContain('g1');
      const metrics = hsmMetrics.getMetrics();
      expect(metrics.hsm_consensus_coord_view_change_aborted_total).toBe(1);
    });
  });

  describe('fault detection', () => {
    test('detects node failure after timeout', () => {
      coordinator.createGroup({
        groupId: 'g1',
        clusterNodes: ['node-A', 'node-B', 'node-C'],
      });

      // Simulate stale lastSeen for node-B and node-C (beyond faultTimeoutMs)
      const now = Date.now();
      coordinator._nodeHealth.get('node-B').lastSeen = now - 500;
      coordinator._nodeHealth.get('node-C').lastSeen = now - 500;

      // Run fault detection synchronously
      coordinator._runFaultDetection();

      const state = coordinator.getAggregatedState();
      expect(state.healthyNodes).toBe(1); // only node-A
      const metrics = hsmMetrics.getMetrics();
      expect(metrics.hsm_consensus_coord_faults_detected_total).toBeGreaterThan(0);
    });

    test('marks group as degraded when leader fails', () => {
      coordinator.createGroup({
        groupId: 'g1',
        clusterNodes: ['node-A', 'node-B', 'node-C'],
      });

      // Set node-B as leader
      const group = coordinator._groups.get('g1');
      group.leaderId = 'node-B';

      // Simulate stale lastSeen for node-B (the leader)
      const now = Date.now();
      coordinator._nodeHealth.get('node-B').lastSeen = now - 500;

      // Run fault detection synchronously
      coordinator._runFaultDetection();

      const updatedGroup = coordinator.getGroup('g1');
      expect(updatedGroup.state).toBe(GROUP_STATE.DEGRADED);
    });
  });

  describe('getAggregatedState', () => {
    test('returns unified state from all groups', () => {
      coordinator.createGroup({ groupId: 'g1', clusterNodes: ['node-A', 'node-B'] });
      coordinator.createGroup({ groupId: 'g2', clusterNodes: ['node-A', 'node-C'] });

      const state = coordinator.getAggregatedState();
      expect(state.coordinatorId).toBe('coord-1');
      expect(state.totalGroups).toBe(2);
      expect(state.totalActive).toBe(2);
      expect(state.totalDegraded).toBe(0);
      expect(state.groups.length).toBe(2);
    });

    test('tracks degraded and reconfiguring groups', () => {
      coordinator.createGroup({ groupId: 'g1', clusterNodes: ['node-A', 'node-B'] });
      coordinator.createGroup({ groupId: 'g2', clusterNodes: ['node-A', 'node-C'] });

      coordinator._groups.get('g1').state = GROUP_STATE.DEGRADED;
      coordinator._groups.get('g2').state = GROUP_STATE.RECONFIGURING;

      const state = coordinator.getAggregatedState();
      expect(state.totalDegraded).toBe(1);
      expect(state.totalReconfiguring).toBe(1);
      expect(state.totalActive).toBe(0);
    });
  });

  describe('recordHeartbeat', () => {
    test('updates node health on heartbeat', () => {
      coordinator.createGroup({ groupId: 'g1', clusterNodes: ['node-A', 'node-B'] });

      coordinator.recordHeartbeat('node-B', 'g1', { leaderId: 'node-A' });

      const health = coordinator._nodeHealth.get('node-B');
      expect(health.healthy).toBe(true);
      expect(health.lastSeen).toBeGreaterThan(0);

      const group = coordinator.getGroup('g1');
      expect(group.leaderId).toBe('node-A');
    });

    test('throws for unknown group', () => {
      expect(() => coordinator.recordHeartbeat('node-B', 'nonexistent')).toThrow();
    });

    test('throws for node not in group', () => {
      coordinator.createGroup({ groupId: 'g1', clusterNodes: ['node-A', 'node-B'] });
      expect(() => coordinator.recordHeartbeat('node-Z', 'g1')).toThrow();
    });
  });

  describe('getGroup', () => {
    test('returns group info', () => {
      coordinator.createGroup({
        groupId: 'g1',
        clusterNodes: ['node-A', 'node-B'],
        topic: 'test-topic',
      });

      const info = coordinator.getGroup('g1');
      expect(info.groupId).toBe('g1');
      expect(info.topic).toBe('test-topic');
      expect(info.nodes).toEqual(['node-A', 'node-B']);
    });

    test('returns null for non-existent group', () => {
      expect(coordinator.getGroup('nonexistent')).toBeNull();
    });
  });

  describe('listGroups', () => {
    test('returns all group IDs', () => {
      coordinator.createGroup({ groupId: 'g1', clusterNodes: ['node-A', 'node-B'] });
      coordinator.createGroup({ groupId: 'g2', clusterNodes: ['node-A', 'node-C'] });

      expect(coordinator.listGroups()).toEqual(expect.arrayContaining(['g1', 'g2']));
    });
  });
});
