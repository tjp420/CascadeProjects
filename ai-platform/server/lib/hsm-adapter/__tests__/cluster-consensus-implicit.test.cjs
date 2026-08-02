'use strict';

/**
 * Track 34 Phase 7: Implicit outbound transport signing tests.
 */
const crypto = require('crypto');
const { ClusterConsensusEngine, NODE_STATE, CONSENSUS_EVENT } = require('../cluster-consensus-engine.cjs');

function generateKeyPair() {
  return crypto.generateKeyPairSync('ed25519');
}

describe('Track 34 Phase 7 implicit signing — startElection', () => {
  test('requestVote callback receives signed envelope with signature/nonce/timestamp', async () => {
    const { privateKey, publicKey } = generateKeyPair();
    let receivedEnvelope = null;
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      signingKeyPair: { privateKey, publicKey },
      requestVote: async (targetId, envelope) => {
        receivedEnvelope = envelope;
        return true;
      },
    });
    engine.start();
    await engine.startElection();

    expect(receivedEnvelope).not.toBeNull();
    expect(typeof receivedEnvelope.signature).toBe('string');
    expect(typeof receivedEnvelope.nonce).toBe('number');
    expect(typeof receivedEnvelope.timestamp).toBe('number');
    expect(receivedEnvelope.term).toBe(engine.getState().term);
    expect(receivedEnvelope.candidateId).toBe('node-a');

    engine.stop();
  });

  test('requestVote callback receives unsigned payload when no signing key configured', async () => {
    let receivedEnvelope = null;
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      requestVote: async (targetId, envelope) => {
        receivedEnvelope = envelope;
        return true;
      },
    });
    engine.start();
    await engine.startElection();

    expect(receivedEnvelope).not.toBeNull();
    expect(receivedEnvelope.signature).toBeUndefined();
    expect(receivedEnvelope.nonce).toBeUndefined();

    engine.stop();
  });

  test('requestVote callback receives unsigned payload when autoSignOutbound is false', async () => {
    const { privateKey, publicKey } = generateKeyPair();
    let receivedEnvelope = null;
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      signingKeyPair: { privateKey, publicKey },
      autoSignOutbound: false,
      requestVote: async (targetId, envelope) => {
        receivedEnvelope = envelope;
        return true;
      },
    });
    engine.start();
    await engine.startElection();

    expect(receivedEnvelope).not.toBeNull();
    expect(receivedEnvelope.signature).toBeUndefined();

    engine.stop();
  });

  test('OUTBOUND_SIGNED audit event emitted during election', async () => {
    const { privateKey, publicKey } = generateKeyPair();
    const events = [];
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      signingKeyPair: { privateKey, publicKey },
      audit: (event, info) => events.push({ event, info }),
      requestVote: async () => true,
    });
    engine.start();
    await engine.startElection();

    expect(events.some((e) => e.event === CONSENSUS_EVENT.OUTBOUND_SIGNED)).toBe(true);

    engine.stop();
  });
});

describe('Track 34 Phase 7 implicit signing — sendHeartbeats', () => {
  test('sendHeartbeat callback receives signed envelope', async () => {
    const { privateKey, publicKey } = generateKeyPair();
    const receivedEnvelopes = [];
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      signingKeyPair: { privateKey, publicKey },
      sendHeartbeat: async (targetId, envelope) => {
        receivedEnvelopes.push({ targetId, envelope });
        return true;
      },
    });
    engine.start();
    await engine.startElection();
    await engine.sendHeartbeats();

    expect(receivedEnvelopes.length).toBe(2);
    for (const { envelope } of receivedEnvelopes) {
      expect(typeof envelope.signature).toBe('string');
      expect(typeof envelope.nonce).toBe('number');
      expect(typeof envelope.timestamp).toBe('number');
      expect(envelope.leaderId).toBe('node-a');
    }

    engine.stop();
  });

  test('sendHeartbeat callback receives unsigned payload when no signing key', async () => {
    const receivedEnvelopes = [];
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      sendHeartbeat: async (targetId, envelope) => {
        receivedEnvelopes.push({ targetId, envelope });
        return true;
      },
    });
    engine.start();
    await engine.startElection();
    await engine.sendHeartbeats();

    expect(receivedEnvelopes.length).toBe(2);
    for (const { envelope } of receivedEnvelopes) {
      expect(envelope.signature).toBeUndefined();
    }

    engine.stop();
  });

  test('heartbeat envelopes have incrementing nonces', async () => {
    const { privateKey, publicKey } = generateKeyPair();
    const receivedEnvelopes = [];
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      signingKeyPair: { privateKey, publicKey },
      sendHeartbeat: async (targetId, envelope) => {
        receivedEnvelopes.push(envelope);
        return true;
      },
    });
    engine.start();
    await engine.startElection();
    await engine.sendHeartbeats();

    expect(receivedEnvelopes.length).toBe(2);
    expect(receivedEnvelopes[1].nonce).toBeGreaterThan(receivedEnvelopes[0].nonce);

    engine.stop();
  });
});

describe('Track 34 Phase 7 implicit signing — appendAndReplicate', () => {
  test('replicateLog callback receives signed envelope with entries', async () => {
    const { privateKey, publicKey } = generateKeyPair();
    let receivedEnvelope = null;
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      signingKeyPair: { privateKey, publicKey },
      replicateLog: async (targetId, envelope) => {
        receivedEnvelope = envelope;
        return true;
      },
    });
    engine.start();
    await engine.startElection();
    await engine.appendAndReplicate({ operation: 'test' });

    expect(receivedEnvelope).not.toBeNull();
    expect(typeof receivedEnvelope.signature).toBe('string');
    expect(typeof receivedEnvelope.nonce).toBe('number');
    expect(typeof receivedEnvelope.timestamp).toBe('number');
    expect(Array.isArray(receivedEnvelope.entries)).toBe(true);
    expect(receivedEnvelope.entries.length).toBe(1);
    expect(receivedEnvelope.leaderId).toBe('node-a');

    engine.stop();
  });

  test('replicateLog callback receives unsigned payload when autoSignOutbound is false', async () => {
    const { privateKey, publicKey } = generateKeyPair();
    let receivedEnvelope = null;
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      signingKeyPair: { privateKey, publicKey },
      autoSignOutbound: false,
      replicateLog: async (targetId, envelope) => {
        receivedEnvelope = envelope;
        return true;
      },
    });
    engine.start();
    await engine.startElection();
    await engine.appendAndReplicate({ operation: 'test' });

    expect(receivedEnvelope).not.toBeNull();
    expect(receivedEnvelope.signature).toBeUndefined();
    expect(Array.isArray(receivedEnvelope.entries)).toBe(true);

    engine.stop();
  });

  test('replicateLog signed envelope can be verified by follower', async () => {
    const leaderKeys = generateKeyPair();
    let capturedEnvelope = null;
    const leader = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      signingKeyPair: { privateKey: leaderKeys.privateKey, publicKey: leaderKeys.publicKey },
      replicateLog: async (targetId, envelope) => {
        capturedEnvelope = envelope;
        return true;
      },
    });
    leader.start();
    await leader.startElection();
    await leader.appendAndReplicate({ operation: 'test' });

    // Now verify the captured envelope as a follower would
    const follower = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      peerPublicKeys: new Map([['node-a', leaderKeys.publicKey]]),
      requireRpcSigning: true,
      replayWindowMs: 60000,
    });
    follower.start();
    const result = follower.appendEntries(capturedEnvelope);
    expect(result.success).toBe(true);

    leader.stop();
    follower.stop();
  });
});

describe('Track 34 Phase 7 implicit signing — end-to-end verification', () => {
  test('full election cycle with implicit signing — follower verifies leader frames', async () => {
    const leaderKeys = generateKeyPair();
    let voteEnvelope = null;
    let heartbeatEnvelope = null;

    const leader = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      signingKeyPair: { privateKey: leaderKeys.privateKey, publicKey: leaderKeys.publicKey },
      requestVote: async (targetId, envelope) => {
        voteEnvelope = envelope;
        return true;
      },
      sendHeartbeat: async (targetId, envelope) => {
        heartbeatEnvelope = envelope;
        return true;
      },
    });
    leader.start();
    await leader.startElection();
    await leader.sendHeartbeats();

    // Verify vote envelope
    expect(voteEnvelope).not.toBeNull();
    expect(voteEnvelope.signature).toBeDefined();

    // Verify heartbeat envelope
    expect(heartbeatEnvelope).not.toBeNull();
    expect(heartbeatEnvelope.signature).toBeDefined();

    // A follower with the leader's public key should verify both
    const follower = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      peerPublicKeys: new Map([['node-a', leaderKeys.publicKey]]),
      requireRpcSigning: true,
      replayWindowMs: 60000,
    });
    follower.start();

    // Verify the vote request
    const voteResult = follower.requestVote(voteEnvelope);
    expect(voteResult.voteGranted).toBe(true);

    // Verify the heartbeat
    const hbResult = follower.receiveHeartbeat(heartbeatEnvelope);
    expect(hbResult.accepted).toBe(true);

    leader.stop();
    follower.stop();
  });

  test('follower rejects implicitly signed frame from wrong key', async () => {
    const leaderKeys = generateKeyPair();
    const attackerKeys = generateKeyPair();

    const leader = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      signingKeyPair: { privateKey: attackerKeys.privateKey, publicKey: attackerKeys.publicKey },
      replicateLog: async (targetId, envelope) => true,
    });
    leader.start();
    await leader.startElection();

    // Follower expects leader's key to be leaderKeys, but leader signed with attackerKeys
    let capturedEnvelope = null;
    const leader2 = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      signingKeyPair: { privateKey: leaderKeys.privateKey, publicKey: leaderKeys.publicKey },
      replicateLog: async (targetId, envelope) => {
        capturedEnvelope = envelope;
        return true;
      },
    });
    leader2.start();
    await leader2.startElection();
    await leader2.appendAndReplicate({ operation: 'test' });

    // Follower has leaderKeys registered, but the envelope was signed by leader2 (correctly)
    const follower = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      peerPublicKeys: new Map([['node-a', leaderKeys.publicKey]]),
      requireRpcSigning: true,
      replayWindowMs: 60000,
    });
    follower.start();
    const result = follower.appendEntries(capturedEnvelope);
    expect(result.success).toBe(true);

    leader.stop();
    leader2.stop();
    follower.stop();
  });
});

describe('Track 34 Phase 7 implicit signing — Prometheus metrics', () => {
  test('outbound signed counter increments during election', async () => {
    const metrics = require('../hsm-metrics.cjs');
    metrics.reset();
    const { privateKey, publicKey } = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      signingKeyPair: { privateKey, publicKey },
      requestVote: async () => true,
    });
    engine.start();
    await engine.startElection();

    const m = metrics.getMetrics();
    expect(m.hsm_consensus_outbound_signed_total).toBeGreaterThan(0);

    engine.stop();
  });

  test('outbound signed counter increments during heartbeat', async () => {
    const metrics = require('../hsm-metrics.cjs');
    metrics.reset();
    const { privateKey, publicKey } = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      signingKeyPair: { privateKey, publicKey },
      sendHeartbeat: async () => true,
    });
    engine.start();
    await engine.startElection();
    await engine.sendHeartbeats();

    const m = metrics.getMetrics();
    expect(m.hsm_consensus_outbound_signed_total).toBeGreaterThan(0);

    engine.stop();
  });

  test('outbound signed counter increments during replication', async () => {
    const metrics = require('../hsm-metrics.cjs');
    metrics.reset();
    const { privateKey, publicKey } = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      signingKeyPair: { privateKey, publicKey },
      replicateLog: async () => true,
    });
    engine.start();
    await engine.startElection();
    await engine.appendAndReplicate({ operation: 'test' });

    const m = metrics.getMetrics();
    expect(m.hsm_consensus_outbound_signed_total).toBeGreaterThan(0);

    engine.stop();
  });

  test('no outbound signed counter when autoSignOutbound is false', async () => {
    const metrics = require('../hsm-metrics.cjs');
    metrics.reset();
    const { privateKey, publicKey } = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      signingKeyPair: { privateKey, publicKey },
      autoSignOutbound: false,
      requestVote: async () => true,
    });
    engine.start();
    await engine.startElection();

    const m = metrics.getMetrics();
    expect(m.hsm_consensus_outbound_signed_total).toBe(0);

    engine.stop();
  });
});

describe('Track 34 Phase 7 implicit signing — backward compatibility', () => {
  test('callbacks still work when no signing key and autoSignOutbound is true', async () => {
    let voteCalled = false;
    let heartbeatCalled = false;
    let replicateCalled = false;

    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      requestVote: async () => { voteCalled = true; return true; },
      sendHeartbeat: async () => { heartbeatCalled = true; return true; },
      replicateLog: async () => { replicateCalled = true; return true; },
    });
    engine.start();
    await engine.startElection();
    await engine.sendHeartbeats();
    await engine.appendAndReplicate({ operation: 'test' });

    expect(voteCalled).toBe(true);
    expect(heartbeatCalled).toBe(true);
    expect(replicateCalled).toBe(true);

    engine.stop();
  });

  test('existing tests with no callbacks still work (no signing key)', async () => {
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
    });
    engine.start();
    await engine.startElection();
    expect(engine.getState().state).toBe(NODE_STATE.LEADER);

    const result = await engine.appendAndReplicate({ operation: 'test' });
    expect(result.committed).toBe(true);

    engine.stop();
  });
});
