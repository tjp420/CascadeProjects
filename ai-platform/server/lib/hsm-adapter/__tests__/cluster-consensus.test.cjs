'use strict';

/**
 * Track 34: Cluster consensus engine tests.
 */
const { ClusterConsensusEngine, NODE_STATE, CONSENSUS_EVENT } = require('../cluster-consensus-engine.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

describe('Track 34 cluster consensus engine', () => {
  test('constructs with valid cluster configuration', () => {
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
    });
    expect(engine.nodeId).toBe('node-a');
    expect(engine.clusterNodes.size).toBe(3);
    expect(engine.minQuorumNodes).toBe(2); // floor(3/2)+1
    expect(engine.getState().state).toBe(NODE_STATE.FOLLOWER);
  });

  test('rejects nodeId not in clusterNodes', () => {
    expect(() => new ClusterConsensusEngine({
      nodeId: 'node-x',
      clusterNodes: ['node-a', 'node-b'],
    })).toThrow(HsmAdapterError);
  });

  test('rejects empty clusterNodes', () => {
    expect(() => new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: [],
    })).toThrow(HsmAdapterError);
  });

  test('rejects missing nodeId', () => {
    expect(() => new ClusterConsensusEngine({
      clusterNodes: ['node-a'],
    })).toThrow(HsmAdapterError);
  });

  test('startElection transitions to candidate and increments term', async () => {
    const events = [];
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      audit: (event, info) => events.push({ event, info }),
    });
    engine.start();

    const result = await engine.startElection();
    expect(result.elected).toBe(true);
    expect(result.term).toBe(1);
    expect(result.votes).toBe(3);
    expect(engine.getState().state).toBe(NODE_STATE.LEADER);
    expect(engine.getState().term).toBe(1);
    expect(events.some((e) => e.event === CONSENSUS_EVENT.LEADER_ELECTED)).toBe(true);
    expect(events.some((e) => e.event === CONSENSUS_EVENT.VOTE_REQUESTED)).toBe(true);

    engine.stop();
  });

  test('leader can append and replicate log entries', async () => {
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
    });
    engine.start();
    await engine.startElection();

    const result = await engine.appendAndReplicate({ type: 'PUT', key: 'foo', value: 'bar' });
    expect(result.index).toBe(1);
    expect(result.committed).toBe(true);
    expect(result.replicas).toBe(3);
    expect(engine.getState().logLength).toBe(1);
    expect(engine.getState().commitIndex).toBe(1);

    engine.stop();
  });

  test('appendAndReplicate throws when not leader', async () => {
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
    });
    engine.start();

    await expect(engine.appendAndReplicate({ type: 'PUT' })).rejects.toThrow(HsmAdapterError);

    engine.stop();
  });

  test('receiveHeartbeat acknowledges valid leader', () => {
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
    });
    engine.start();

    const result = engine.receiveHeartbeat({ term: 1, leaderId: 'node-a', leaderCommit: 0 });
    expect(result.accepted).toBe(true);
    expect(engine.getState().leaderId).toBe('node-a');
    expect(engine.getState().state).toBe(NODE_STATE.FOLLOWER);

    engine.stop();
  });

  test('receiveHeartbeat rejects stale term', () => {
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
    });
    engine.start();
    // Advance term manually
    engine._currentTerm = 5;

    const result = engine.receiveHeartbeat({ term: 3, leaderId: 'node-a' });
    expect(result.accepted).toBe(false);
    expect(engine.getState().leaderId).toBeNull();

    engine.stop();
  });

  test('receiveHeartbeat rejects unknown leader', () => {
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
    });
    engine.start();

    expect(() => engine.receiveHeartbeat({ term: 1, leaderId: 'node-z' })).toThrow(HsmAdapterError);

    engine.stop();
  });

  test('requestVote grants vote for up-to-date candidate', () => {
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
    });
    engine.start();

    const result = engine.requestVote({ term: 1, candidateId: 'node-a', lastLogIndex: 0, lastLogTerm: 0 });
    expect(result.voteGranted).toBe(true);
    expect(engine.getState().votedFor).toBe('node-a');

    engine.stop();
  });

  test('requestVote rejects double voting in same term', () => {
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
    });
    engine.start();

    engine.requestVote({ term: 1, candidateId: 'node-a', lastLogIndex: 0, lastLogTerm: 0 });
    const result = engine.requestVote({ term: 1, candidateId: 'node-c', lastLogIndex: 0, lastLogTerm: 0 });
    expect(result.voteGranted).toBe(false);

    engine.stop();
  });

  test('requestVote rejects candidate with stale log', () => {
    const events = [];
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      audit: (event, info) => events.push({ event, info }),
    });
    engine.start();
    // Simulate that node-b has log entries at term 2
    engine._log = [{ term: 2, index: 1, command: {}, committed: false }];

    const result = engine.requestVote({ term: 3, candidateId: 'node-a', lastLogIndex: 0, lastLogTerm: 0 });
    expect(result.voteGranted).toBe(false);
    expect(events.some((e) => e.event === CONSENSUS_EVENT.VOTE_REJECTED)).toBe(true);

    engine.stop();
  });

  test('requestVote rejects unknown candidate', () => {
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
    });
    engine.start();

    expect(() => engine.requestVote({ term: 1, candidateId: 'node-z' })).toThrow(HsmAdapterError);

    engine.stop();
  });

  test('appendEntries appends entries from leader', () => {
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
    });
    engine.start();

    const result = engine.appendEntries({
      term: 1,
      leaderId: 'node-a',
      entries: [{ term: 1, index: 1, command: { type: 'PUT' } }],
      leaderCommit: 0,
    });
    expect(result.success).toBe(true);
    expect(result.matchIndex).toBe(1);
    expect(engine.getState().logLength).toBe(1);
    expect(engine.getState().leaderId).toBe('node-a');

    engine.stop();
  });

  test('appendEntries advances commit index from leaderCommit', () => {
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
    });
    engine.start();
    // Simulate existing log
    engine._log = [
      { term: 1, index: 1, command: {}, committed: false },
      { term: 1, index: 2, command: {}, committed: false },
    ];

    const result = engine.appendEntries({
      term: 1,
      leaderId: 'node-a',
      entries: [],
      leaderCommit: 2,
    });
    expect(result.success).toBe(true);
    expect(engine.getState().commitIndex).toBe(2);
    expect(engine.getState().lastAppliedIndex).toBe(2);

    engine.stop();
  });

  test('appendEntries rejects stale term', () => {
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
    });
    engine.start();
    engine._currentTerm = 5;

    const result = engine.appendEntries({ term: 3, leaderId: 'node-a', entries: [] });
    expect(result.success).toBe(false);

    engine.stop();
  });

  test('election fails when quorum is not reached', async () => {
    const events = [];
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c', 'node-d', 'node-e'],
      minQuorumNodes: 4, // require 4 out of 5
      requestVote: () => Promise.reject(new Error('unreachable')),
      audit: (event, info) => events.push({ event, info }),
    });
    engine.start();

    const result = await engine.startElection();
    expect(result.elected).toBe(false);
    expect(result.votes).toBe(1); // only self
    expect(engine.getState().state).toBe(NODE_STATE.CANDIDATE);
    expect(events.some((e) => e.event === CONSENSUS_EVENT.QUORUM_LOST)).toBe(true);

    engine.stop();
  });

  test('sendHeartbeats returns acked count when leader', async () => {
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      sendHeartbeat: () => Promise.resolve(true),
    });
    engine.start();
    await engine.startElection();

    const result = await engine.sendHeartbeats();
    expect(result.sent).toBe(2);
    expect(result.acked).toBe(2);

    engine.stop();
  });

  test('sendHeartbeats steps down when quorum lost', async () => {
    const events = [];
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c', 'node-d', 'node-e'],
      minQuorumNodes: 3,
      sendHeartbeat: () => Promise.resolve(false), // all fail
      audit: (event, info) => events.push({ event, info }),
    });
    engine.start();
    await engine.startElection();
    expect(engine.getState().state).toBe(NODE_STATE.LEADER);

    await engine.sendHeartbeats();
    expect(engine.getState().state).toBe(NODE_STATE.FOLLOWER);
    expect(events.some((e) => e.event === CONSENSUS_EVENT.QUORUM_LOST)).toBe(true);

    engine.stop();
  });

  test('sendHeartbeats returns 0 when not leader', async () => {
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
    });
    engine.start();

    const result = await engine.sendHeartbeats();
    expect(result.sent).toBe(0);
    expect(result.acked).toBe(0);

    engine.stop();
  });

  test('getState returns immutable snapshot', () => {
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
    });
    const state = engine.getState();
    expect(state.nodeId).toBe('node-a');
    expect(state.state).toBe(NODE_STATE.FOLLOWER);
    expect(state.term).toBe(0);
    expect(state.leaderId).toBeNull();
    expect(state.logLength).toBe(0);
    expect(state.clusterSize).toBe(3);
    expect(state.quorumNodes).toBe(2);
  });

  test('stop clears timers and prevents election', () => {
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
    });
    engine.start();
    engine.stop();
    expect(engine._started).toBe(false);
    expect(engine._electionTimer).toBeNull();
    expect(engine._heartbeatTimer).toBeNull();
  });

  test('startElection throws when engine not started', async () => {
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
    });
    await expect(engine.startElection()).rejects.toThrow(HsmAdapterError);
  });

  test('audit events include timestamp', async () => {
    const events = [];
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      audit: (event, info) => events.push({ event, info }),
    });
    engine.start();
    await engine.startElection();

    for (const e of events) {
      expect(typeof e.info.timestamp).toBe('number');
    }

    engine.stop();
  });
});

describe('Track 34 consensus policy validation', () => {
  test('CryptoPolicyEngine validates consensus configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'consensus', {
      minQuorumNodes: 2,
      heartbeatIntervalMs: 500,
      electionTimeoutMs: 1500,
      maxLogBatchSize: 32,
      consensusMode: 'raft',
      requireLeaderHeartbeat: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'consensus', { minQuorumNodes: 1 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'consensus', { heartbeatIntervalMs: 50 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'consensus', { heartbeatIntervalMs: 500, electionTimeoutMs: 400 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'consensus', { maxLogBatchSize: 100 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'consensus', { consensusMode: 'dictator' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'consensus', { requireLeaderHeartbeat: false })).toThrow(HsmAdapterError);
  });

  test('tenant-specific consensus policy overrides default', () => {
    const engine = new CryptoPolicyEngine({
      default: {},
      tenants: {
        't-large': {
          consensus: {
            minQuorumNodes: 5,
            heartbeatIntervalMs: 200,
            electionTimeoutMs: 1000,
            maxLogBatchSize: 128,
            allowedConsensusModes: ['raft', 'bft', 'paxos'],
          },
        },
      },
    });
    expect(() => engine.validate('t-large', 'consensus', {
      minQuorumNodes: 5,
      maxLogBatchSize: 128,
      consensusMode: 'paxos',
    })).not.toThrow();

    // Default tenant still restricted to minQuorumNodes=2
    expect(() => engine.validate('t1', 'consensus', {
      minQuorumNodes: 1,
    })).toThrow(HsmAdapterError);
  });

  test('consensus validation skips undefined numeric fields', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'consensus', {})).not.toThrow();
  });
});

describe('Track 34 consensus Prometheus metrics', () => {
  test('leader election increments hsm_consensus_leader_elections_total', async () => {
    const metrics = require('../hsm-metrics.cjs');
    metrics.reset();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
    });
    engine.start();
    await engine.startElection();

    const m = metrics.getMetrics();
    expect(m.hsm_consensus_leader_elections_total).toBeGreaterThan(0);
    expect(m.hsm_consensus_leader_elections_won_total).toBeGreaterThan(0);

    engine.stop();
  });

  test('log replication increments hsm_consensus_log_replicated_total', async () => {
    const metrics = require('../hsm-metrics.cjs');
    metrics.reset();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
    });
    engine.start();
    await engine.startElection();
    await engine.appendAndReplicate({ type: 'PUT' });

    const m = metrics.getMetrics();
    expect(m.hsm_consensus_log_replicated_total).toBeGreaterThan(0);
    expect(m.hsm_consensus_log_committed_total).toBeGreaterThan(0);

    engine.stop();
  });

  test('quorum loss increments hsm_consensus_quorum_lost_total', async () => {
    const metrics = require('../hsm-metrics.cjs');
    metrics.reset();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c', 'node-d', 'node-e'],
      minQuorumNodes: 4,
      requestVote: () => Promise.reject(new Error('unreachable')),
    });
    engine.start();
    await engine.startElection();

    const m = metrics.getMetrics();
    expect(m.hsm_consensus_quorum_lost_total).toBeGreaterThan(0);

    engine.stop();
  });
});
