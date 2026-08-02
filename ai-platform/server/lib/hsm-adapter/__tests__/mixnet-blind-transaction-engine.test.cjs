'use strict';

/**
 * Track 60: Multi-Asset Sharded Mixnets and Blind Confidential Transactions tests.
 */
const {
  MixnetBlindTransactionEngine,
  DEFAULT_OPTIONS,
  NODE_STATUS,
  TX_STATUS,
  SHARD_STATUS,
  POOL_STATUS,
} = require('../mixnet-blind-transaction-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

describe('Track 60: MixnetBlindTransactionEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new MixnetBlindTransactionEngine({
      maxNodes: 20,
      maxShards: 8,
      maxPoolSize: 10,
      minRelayHops: 3,
      maxRelayHops: 5,
      maxPendingTransactions: 100,
    });
  });

  // Helper: register N nodes
  function registerNodes(engine, count, shardId = 'shard-0') {
    for (let i = 0; i < count; i++) {
      engine.registerNode({
        nodeId: `node-${i}`,
        enclaveId: `enclave-${i}`,
        shardId,
      });
    }
  }

  // Helper: create a transaction
  function createTx(engine, txId = 'tx-1', asset = 'BTC', amount = 100n) {
    return engine.createTransaction({
      txId,
      asset,
      amount,
      senderId: 'alice',
      recipientId: 'bob',
      shardId: 'shard-0',
    });
  }

  describe('registerNode', () => {
    test('registers a mix node', () => {
      const result = engine.registerNode({
        nodeId: 'n1',
        enclaveId: 'e1',
        shardId: 'shard-0',
      });
      expect(result.nodeId).toBe('n1');
      expect(result.status).toBe(NODE_STATUS.ACTIVE);
      expect(result.publicKey).toBeDefined();
    });

    test('rejects null config', () => {
      expect(() => engine.registerNode(null)).toThrow(HsmAdapterError);
    });

    test('rejects missing nodeId', () => {
      expect(() => engine.registerNode({ enclaveId: 'e1' }))
        .toThrow(HsmAdapterError);
    });

    test('rejects duplicate nodeId', () => {
      engine.registerNode({ nodeId: 'n1', enclaveId: 'e1' });
      expect(() => engine.registerNode({ nodeId: 'n1', enclaveId: 'e2' }))
        .toThrow(HsmAdapterError);
    });

    test('rejects missing enclaveId', () => {
      expect(() => engine.registerNode({ nodeId: 'n1' }))
        .toThrow(HsmAdapterError);
    });

    test('rejects when max nodes reached', () => {
      for (let i = 0; i < 20; i++) {
        engine.registerNode({ nodeId: `n${i}`, enclaveId: `e${i}` });
      }
      expect(() => engine.registerNode({ nodeId: 'n20', enclaveId: 'e20' }))
        .toThrow(HsmAdapterError);
    });
  });

  describe('createTransaction', () => {
    test('creates a blind transaction', () => {
      const result = createTx(engine);
      expect(result.txId).toBe('tx-1');
      expect(result.asset).toBe('BTC');
      expect(result.status).toBe(TX_STATUS.PENDING);
    });

    test('rejects null config', () => {
      expect(() => engine.createTransaction(null)).toThrow(HsmAdapterError);
    });

    test('rejects missing txId', () => {
      expect(() => engine.createTransaction({
        asset: 'BTC', amount: 100n, senderId: 'a', recipientId: 'b',
      })).toThrow(HsmAdapterError);
    });

    test('rejects duplicate txId', () => {
      createTx(engine);
      expect(() => createTx(engine)).toThrow(HsmAdapterError);
    });

    test('rejects unsupported asset', () => {
      expect(() => engine.createTransaction({
        txId: 'tx-1', asset: 'DOGE', amount: 100n,
        senderId: 'a', recipientId: 'b',
      })).toThrow(HsmAdapterError);
    });

    test('rejects zero amount', () => {
      expect(() => engine.createTransaction({
        txId: 'tx-1', asset: 'BTC', amount: 0n,
        senderId: 'a', recipientId: 'b',
      })).toThrow(HsmAdapterError);
    });

    test('rejects negative amount', () => {
      expect(() => engine.createTransaction({
        txId: 'tx-1', asset: 'BTC', amount: -100n,
        senderId: 'a', recipientId: 'b',
      })).toThrow(HsmAdapterError);
    });

    test('rejects missing senderId', () => {
      expect(() => engine.createTransaction({
        txId: 'tx-1', asset: 'BTC', amount: 100n,
        recipientId: 'b',
      })).toThrow(HsmAdapterError);
    });

    test('rejects missing recipientId', () => {
      expect(() => engine.createTransaction({
        txId: 'tx-1', asset: 'BTC', amount: 100n,
        senderId: 'a',
      })).toThrow(HsmAdapterError);
    });

    test('accepts number amount', () => {
      const result = engine.createTransaction({
        txId: 'tx-1', asset: 'BTC', amount: 100,
        senderId: 'a', recipientId: 'b',
      });
      expect(result.txId).toBe('tx-1');
    });
  });

  describe('createOnionPath', () => {
    test('creates an onion routing path', () => {
      registerNodes(engine, 5);
      createTx(engine);
      const result = engine.createOnionPath('tx-1', 3);
      expect(result.txId).toBe('tx-1');
      expect(result.hopCount).toBe(3);
      expect(result.path.length).toBe(3);
    });

    test('rejects unknown transaction', () => {
      expect(() => engine.createOnionPath('unknown')).toThrow(HsmAdapterError);
    });

    test('rejects too few hops', () => {
      registerNodes(engine, 5);
      createTx(engine);
      expect(() => engine.createOnionPath('tx-1', 1)).toThrow(HsmAdapterError);
    });

    test('rejects too many hops', () => {
      registerNodes(engine, 10);
      createTx(engine);
      expect(() => engine.createOnionPath('tx-1', 10)).toThrow(HsmAdapterError);
    });

    test('rejects when insufficient active nodes', () => {
      registerNodes(engine, 2);
      createTx(engine);
      expect(() => engine.createOnionPath('tx-1', 3)).toThrow(HsmAdapterError);
    });
  });

  describe('mixTransaction', () => {
    test('mixes a transaction through the mixnet', () => {
      registerNodes(engine, 5);
      createTx(engine);
      engine.createOnionPath('tx-1', 3);
      const result = engine.mixTransaction('tx-1');
      expect(result.status).toBe(TX_STATUS.MIXED);
      expect(result.hopCount).toBe(3);
      expect(result.zkProof).toBeDefined();
    });

    test('rejects unknown transaction', () => {
      expect(() => engine.mixTransaction('unknown')).toThrow(HsmAdapterError);
    });

    test('rejects transaction without onion path', () => {
      createTx(engine);
      expect(() => engine.mixTransaction('tx-1')).toThrow(HsmAdapterError);
    });

    test('rejects transaction not in routing status', () => {
      registerNodes(engine, 5);
      createTx(engine);
      engine.createOnionPath('tx-1', 3);
      engine.mixTransaction('tx-1');
      expect(() => engine.mixTransaction('tx-1')).toThrow(HsmAdapterError);
    });
  });

  describe('confirmTransaction', () => {
    test('confirms a mixed transaction', () => {
      registerNodes(engine, 5);
      createTx(engine);
      engine.createOnionPath('tx-1', 3);
      engine.mixTransaction('tx-1');
      const result = engine.confirmTransaction('tx-1');
      expect(result.status).toBe(TX_STATUS.CONFIRMED);
      expect(result.confirmedAt).toBeDefined();
    });

    test('rejects unknown transaction', () => {
      expect(() => engine.confirmTransaction('unknown')).toThrow(HsmAdapterError);
    });

    test('rejects unmixed transaction', () => {
      createTx(engine);
      expect(() => engine.confirmTransaction('tx-1')).toThrow(HsmAdapterError);
    });
  });

  describe('createPool', () => {
    test('creates a transaction pool', () => {
      const result = engine.createPool('pool-1', 'shard-0');
      expect(result.poolId).toBe('pool-1');
      expect(result.shardId).toBe('shard-0');
      expect(result.status).toBe(POOL_STATUS.OPEN);
    });

    test('rejects missing poolId', () => {
      expect(() => engine.createPool('', 'shard-0')).toThrow(HsmAdapterError);
    });

    test('rejects duplicate poolId', () => {
      engine.createPool('pool-1', 'shard-0');
      expect(() => engine.createPool('pool-1', 'shard-0'))
        .toThrow(HsmAdapterError);
    });
  });

  describe('addToPool', () => {
    test('adds a transaction to a pool', () => {
      engine.createPool('pool-1', 'shard-0');
      createTx(engine);
      const result = engine.addToPool('pool-1', 'tx-1');
      expect(result.poolSize).toBe(1);
    });

    test('rejects unknown pool', () => {
      createTx(engine);
      expect(() => engine.addToPool('unknown', 'tx-1'))
        .toThrow(HsmAdapterError);
    });

    test('rejects unknown transaction', () => {
      engine.createPool('pool-1', 'shard-0');
      expect(() => engine.addToPool('pool-1', 'unknown'))
        .toThrow(HsmAdapterError);
    });

    test('rejects shard mismatch', () => {
      engine.createPool('pool-1', 'shard-0');
      engine.createTransaction({
        txId: 'tx-1', asset: 'BTC', amount: 100n,
        senderId: 'a', recipientId: 'b', shardId: 'shard-1',
      });
      expect(() => engine.addToPool('pool-1', 'tx-1'))
        .toThrow(HsmAdapterError);
    });
  });

  describe('shufflePool', () => {
    test('shuffles a pool', () => {
      engine.createPool('pool-1', 'shard-0');
      for (let i = 0; i < 3; i++) {
        createTx(engine, `tx-${i}`);
        engine.addToPool('pool-1', `tx-${i}`);
      }
      const result = engine.shufflePool('pool-1');
      expect(result.txCount).toBe(3);
      expect(result.shuffledAt).toBeDefined();
    });

    test('rejects unknown pool', () => {
      expect(() => engine.shufflePool('unknown')).toThrow(HsmAdapterError);
    });

    test('rejects pool with too few transactions', () => {
      engine.createPool('pool-1', 'shard-0');
      createTx(engine);
      engine.addToPool('pool-1', 'tx-1');
      expect(() => engine.shufflePool('pool-1')).toThrow(HsmAdapterError);
    });
  });

  describe('flushPool', () => {
    test('flushes a shuffled pool', () => {
      engine.createPool('pool-1', 'shard-0');
      for (let i = 0; i < 3; i++) {
        createTx(engine, `tx-${i}`);
        engine.addToPool('pool-1', `tx-${i}`);
      }
      engine.shufflePool('pool-1');
      const result = engine.flushPool('pool-1');
      expect(result.flushedCount).toBe(3);
    });

    test('rejects unknown pool', () => {
      expect(() => engine.flushPool('unknown')).toThrow(HsmAdapterError);
    });

    test('rejects pool that is not closed', () => {
      engine.createPool('pool-1', 'shard-0');
      expect(() => engine.flushPool('pool-1')).toThrow(HsmAdapterError);
    });
  });

  describe('banNode', () => {
    test('bans a compromised node', () => {
      engine.registerNode({ nodeId: 'n1', enclaveId: 'e1' });
      const result = engine.banNode('n1');
      expect(result.banned).toBe(true);
      const node = engine.getNode('n1');
      expect(node.status).toBe(NODE_STATUS.BANNED);
    });

    test('rejects unknown node', () => {
      expect(() => engine.banNode('unknown')).toThrow(HsmAdapterError);
    });
  });

  describe('getNode', () => {
    test('returns node info', () => {
      engine.registerNode({ nodeId: 'n1', enclaveId: 'e1', shardId: 's0' });
      const node = engine.getNode('n1');
      expect(node).not.toBeNull();
      expect(node.nodeId).toBe('n1');
      expect(node.enclaveId).toBe('e1');
    });

    test('returns null for unknown node', () => {
      expect(engine.getNode('unknown')).toBeNull();
    });
  });

  describe('getNodes', () => {
    test('returns all nodes', () => {
      engine.registerNode({ nodeId: 'n1', enclaveId: 'e1' });
      engine.registerNode({ nodeId: 'n2', enclaveId: 'e2' });
      expect(engine.getNodes().length).toBe(2);
    });
  });

  describe('getTransaction', () => {
    test('returns transaction info without private data', () => {
      createTx(engine);
      const tx = engine.getTransaction('tx-1');
      expect(tx).not.toBeNull();
      expect(tx.txId).toBe('tx-1');
      expect(tx.senderId).toBeUndefined();
      expect(tx.recipientId).toBeUndefined();
    });

    test('returns null for unknown transaction', () => {
      expect(engine.getTransaction('unknown')).toBeNull();
    });
  });

  describe('getPool', () => {
    test('returns pool info', () => {
      engine.createPool('pool-1', 'shard-0');
      const pool = engine.getPool('pool-1');
      expect(pool).not.toBeNull();
      expect(pool.poolId).toBe('pool-1');
    });

    test('returns null for unknown pool', () => {
      expect(engine.getPool('unknown')).toBeNull();
    });
  });

  describe('getShard', () => {
    test('returns shard info', () => {
      engine.registerNode({ nodeId: 'n1', enclaveId: 'e1', shardId: 's0' });
      const shard = engine.getShard('s0');
      expect(shard).not.toBeNull();
      expect(shard.shardId).toBe('s0');
      expect(shard.nodeCount).toBe(1);
    });

    test('returns null for unknown shard', () => {
      expect(engine.getShard('unknown')).toBeNull();
    });
  });

  describe('getShards', () => {
    test('returns all shards', () => {
      engine.registerNode({ nodeId: 'n1', enclaveId: 'e1', shardId: 's0' });
      engine.registerNode({ nodeId: 'n2', enclaveId: 'e2', shardId: 's1' });
      expect(engine.getShards().length).toBe(2);
    });
  });

  describe('getCompletedTransactions', () => {
    test('returns completed transactions', () => {
      registerNodes(engine, 5);
      createTx(engine);
      engine.createOnionPath('tx-1', 3);
      engine.mixTransaction('tx-1');
      engine.confirmTransaction('tx-1');
      expect(engine.getCompletedTransactions().length).toBe(1);
    });
  });

  describe('getStats', () => {
    test('returns summary statistics', () => {
      engine.registerNode({ nodeId: 'n1', enclaveId: 'e1' });
      createTx(engine);
      const stats = engine.getStats();
      expect(stats.totalNodes).toBe(1);
      expect(stats.totalTransactions).toBe(1);
    });
  });

  describe('reset', () => {
    test('clears all state', () => {
      engine.registerNode({ nodeId: 'n1', enclaveId: 'e1' });
      createTx(engine);
      engine.reset();
      expect(engine.getStats().totalNodes).toBe(0);
      expect(engine.getStats().totalTransactions).toBe(0);
    });
  });

  describe('full mixnet flow', () => {
    test('complete register -> create -> route -> mix -> confirm flow', () => {
      // Register nodes across shards
      for (let i = 0; i < 7; i++) {
        engine.registerNode({
          nodeId: `mix-node-${i}`,
          enclaveId: `enclave-${i}`,
          shardId: 'shard-0',
        });
      }
      // Create multiple transactions
      const assets = ['BTC', 'ETH', 'USDC'];
      for (let i = 0; i < 3; i++) {
        engine.createTransaction({
          txId: `tx-${i}`,
          asset: assets[i],
          amount: BigInt(100 + i * 50),
          senderId: `sender-${i}`,
          recipientId: `recipient-${i}`,
          shardId: 'shard-0',
        });
      }
      // Create onion paths and mix each transaction
      for (let i = 0; i < 3; i++) {
        engine.createOnionPath(`tx-${i}`, 3);
        const mixResult = engine.mixTransaction(`tx-${i}`);
        expect(mixResult.status).toBe(TX_STATUS.MIXED);
        expect(mixResult.zkProof).toBeDefined();
      }
      // Confirm all transactions
      for (let i = 0; i < 3; i++) {
        const result = engine.confirmTransaction(`tx-${i}`);
        expect(result.status).toBe(TX_STATUS.CONFIRMED);
      }
      // Verify stats
      const stats = engine.getStats();
      expect(stats.totalNodes).toBe(7);
      expect(stats.totalTransactions).toBe(3);
      expect(stats.completedTransactions).toBe(3);
      expect(stats.mixCount).toBe(3);
    });

    test('pool-based batch mixing flow', () => {
      // Register nodes
      registerNodes(engine, 5);
      // Create pool
      engine.createPool('batch-pool', 'shard-0');
      // Add transactions to pool
      for (let i = 0; i < 5; i++) {
        createTx(engine, `pool-tx-${i}`);
        engine.addToPool('batch-pool', `pool-tx-${i}`);
      }
      // Shuffle pool
      const shuffleResult = engine.shufflePool('batch-pool');
      expect(shuffleResult.txCount).toBe(5);
      // Flush pool
      const flushResult = engine.flushPool('batch-pool');
      expect(flushResult.flushedCount).toBe(5);
      // Verify all transactions confirmed
      for (let i = 0; i < 5; i++) {
        const tx = engine.getTransaction(`pool-tx-${i}`);
        expect(tx.status).toBe(TX_STATUS.CONFIRMED);
      }
      // Verify stats
      const stats = engine.getStats();
      expect(stats.shuffleCount).toBe(1);
    });
  });
});
