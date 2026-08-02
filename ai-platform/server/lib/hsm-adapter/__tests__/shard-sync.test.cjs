'use strict';

/**
 * Track 32: Shard sync tests.
 */
const crypto = require('crypto');
const { ShardVectorClock } = require('../shard-vector-clock.cjs');
const { KeyShardSyncOrchestrator, _canonicalPacketString } = require('../key-shard-sync-orchestrator.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

function sign(packet, nodeId) {
  const payload = _canonicalPacketString(packet, nodeId);
  return crypto.createHash('sha256').update(payload).digest('hex');
}

describe('Track 32 shard sync', () => {
  test('3-node cluster reaches quorum and commits', () => {
    const events = [];
    const clock = new ShardVectorClock({ audit: (event, info) => events.push({ event, info }) });
    const nodes = ['node-a', 'node-b', 'node-c'];
    const orchestrator = new KeyShardSyncOrchestrator({
      clusterNodes: nodes,
      minClusterQuorum: 3,
      maxAllowedDriftMs: 60000,
      allowedConsensusModes: ['pbft'],
      audit: (event, info) => events.push({ event, info }),
    });

    const packet = {
      packetId: 'p1',
      shardId: 'shard-1',
      sequence: 1,
      payloadHash: 'deadbeef',
      timestamp: Date.now(),
      originNode: 'node-a',
      consensusMode: 'pbft',
    };

    clock.init(packet.shardId);
    clock.validate(packet.shardId, packet.sequence);

    orchestrator.initiate(packet);
    expect(events.some((e) => e.event === 'SHARD_SYNC_INITIATED')).toBe(true);

    for (const node of nodes) {
      orchestrator.respond(packet.packetId, node, sign(packet, node));
    }

    const committed = orchestrator.commit(packet.packetId);
    expect(committed.committed).toBe(true);
    clock.advance(packet.shardId, packet.sequence);
    expect(clock.get(packet.shardId)).toBe(packet.sequence);
    expect(events.some((e) => e.event === 'NODE_CONSENSUS_COMMITTED')).toBe(true);
  });

  test('vector clock rejects rollback', () => {
    const clock = new ShardVectorClock();
    clock.init('shard-1', 5);
    expect(() => clock.validate('shard-1', 5)).toThrow(HsmAdapterError);
    expect(() => clock.validate('shard-1', 3)).toThrow(HsmAdapterError);
    expect(() => clock.validate('shard-1', 6)).not.toThrow();
  });

  test('orchestrator rejects malicious node', () => {
    const nodes = ['node-a', 'node-b', 'node-c'];
    const orchestrator = new KeyShardSyncOrchestrator({
      clusterNodes: nodes,
      minClusterQuorum: 3,
      allowedConsensusModes: ['pbft'],
    });

    const packet = {
      packetId: 'p2',
      shardId: 'shard-1',
      sequence: 1,
      payloadHash: 'deadbeef',
      timestamp: Date.now(),
      originNode: 'node-a',
      consensusMode: 'pbft',
    };

    orchestrator.initiate(packet);
    expect(() => orchestrator.respond(packet.packetId, 'node-b', 'invalid-sig')).toThrow(HsmAdapterError);
  });

  test('orchestrator rejects unauthorized node and consensus mode', () => {
    const orchestrator = new KeyShardSyncOrchestrator({
      clusterNodes: ['node-a', 'node-b'],
      allowedConsensusModes: ['pbft'],
    });

    expect(() => orchestrator.initiate({
      packetId: 'p3',
      shardId: 'shard-1',
      sequence: 1,
      payloadHash: 'h',
      timestamp: Date.now(),
      originNode: 'node-z',
      consensusMode: 'pbft',
    })).toThrow(HsmAdapterError);

    expect(() => orchestrator.initiate({
      packetId: 'p4',
      shardId: 'shard-1',
      sequence: 1,
      payloadHash: 'h',
      timestamp: Date.now(),
      originNode: 'node-a',
      consensusMode: 'raft',
    })).toThrow(HsmAdapterError);
  });

  test('orchestrator rejects insufficient quorum', () => {
    const orchestrator = new KeyShardSyncOrchestrator({
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      minClusterQuorum: 3,
      allowedConsensusModes: ['pbft'],
    });

    const packet = {
      packetId: 'p5',
      shardId: 'shard-1',
      sequence: 1,
      payloadHash: 'deadbeef',
      timestamp: Date.now(),
      originNode: 'node-a',
      consensusMode: 'pbft',
    };

    orchestrator.initiate(packet);
    orchestrator.respond(packet.packetId, 'node-a', sign(packet, 'node-a'));
    expect(() => orchestrator.commit(packet.packetId)).toThrow(HsmAdapterError);
  });

  test('CryptoPolicyEngine validates shardSync configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'shardSync', {
      minClusterQuorum: 3,
      maxAllowedDriftMs: 300000,
      consensusMode: 'pbft',
      maxInFlightProposals: 100,
      bft: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'shardSync', { minClusterQuorum: 2 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'shardSync', { maxAllowedDriftMs: 600000 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'shardSync', { consensusMode: 'raft' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'shardSync', { maxInFlightProposals: 200 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'shardSync', { bft: false })).toThrow(HsmAdapterError);
  });
});
