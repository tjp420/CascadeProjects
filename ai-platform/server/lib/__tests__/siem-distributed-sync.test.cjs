'use strict';

/**
 * Unit tests for the distributed token bucket synchronization protocol.
 *
 * Verifies that N nodes with independent SiemSecurityBroker instances
 * converge to a cluster-wide rate limit of maxTokens (not N × maxTokens)
 * via gossip-based token sharing.
 */

const assert = require('node:assert');
const { describe, it, beforeEach, afterEach } = require('node:test');
const path = require('path');

const BROKER_PATH = path.resolve(process.cwd(), 'server', 'lib', 'siem', 'siem-broker.cjs');
const SiemSecurityBroker = require(BROKER_PATH);

/**
 * Create a mock inter-node message bus that connects N brokers.
 * Messages sent via sendFn are delivered synchronously to all other brokers.
 */
function createMockMessageBus(brokers) {
  const bus = {
    messages: [],
    send(fromNodeId, msg) {
      this.messages.push({ fromNodeId, msg });
      // Deliver to all other brokers synchronously
      for (const broker of brokers) {
        if (broker._nodeId === fromNodeId) continue;
        if (msg.type === 'SIEM_BUCKET_SYNC') broker.handlePeerSync(msg);
        else if (msg.type === 'SIEM_TOKEN_REQUEST') broker.handleTokenRequest(msg);
        else if (msg.type === 'SIEM_TOKEN_GRANT') broker.handleTokenGrant(msg);
      }
    },
  };
  return bus;
}

/**
 * Create a cluster of N brokers with distributed sync enabled.
 * Each broker gets a mock sendFn that routes messages through the bus.
 */
function createCluster(nodeCount, opts = {}) {
  const maxTokens = opts.maxTokens || 100;
  const refillRate = opts.refillRate || 10000;
  const brokers = [];
  const bus = createMockMessageBus(brokers);

  for (let i = 0; i < nodeCount; i++) {
    const nodeId = `node-${i + 1}`;
    const broker = new SiemSecurityBroker({
      rateLimitMaxTokens: maxTokens,
      rateLimitRefillRateMs: refillRate,
      transportStrategy: 'STDOUT_ONLY', // suppress stdout noise in tests
    });
    // Override _dispatch to prevent stdout writes during tests
    broker._dispatch = function (event) {
      this.emit('test_event_dispatched', event);
    };
    brokers.push(broker);
  }

  // Enable distributed sync on each broker
  for (const broker of brokers) {
    const nodeId = `node-${brokers.indexOf(broker) + 1}`;
    broker.enableDistributedSync({
      nodeCount,
      nodeId,
      sendFn: (msg) => bus.send(nodeId, msg),
      syncIntervalMs: 999999, // disable periodic timer in tests
    });
  }

  return { brokers, bus };
}

describe('SiemSecurityBroker distributed token bucket sync', () => {

  describe('enableDistributedSync', () => {
    it('sets fair share to maxTokens / nodeCount', () => {
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      broker._dispatch = () => {}; // suppress output
      broker.enableDistributedSync({
        nodeCount: 4,
        nodeId: 'node-1',
        sendFn: () => {},
        syncIntervalMs: 999999,
      });
      const state = broker.getDistributedState();
      assert.strictEqual(state.fairShare, 25, 'fair share should be 100/4');
      assert.strictEqual(state.nodeCount, 4);
      assert.strictEqual(state.enabled, true);
      broker.close();
    });

    it('caps local tokens to fair share on enable', () => {
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      broker._dispatch = () => {};
      // tokens start at 100 (maxTokens)
      broker.enableDistributedSync({
        nodeCount: 4,
        nodeId: 'node-1',
        sendFn: () => {},
        syncIntervalMs: 999999,
      });
      assert.strictEqual(broker.tokens, 25, 'tokens should be capped to fair share');
      broker.close();
    });

    it('throws on missing nodeCount', () => {
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      assert.throws(() => broker.enableDistributedSync({ nodeId: 'n1' }), /nodeCount/);
      broker.close();
    });

    it('handles nodeCount=1 (single node, fair share = maxTokens)', () => {
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      broker._dispatch = () => {};
      broker.enableDistributedSync({
        nodeCount: 1,
        nodeId: 'node-1',
        sendFn: () => {},
        syncIntervalMs: 999999,
      });
      assert.strictEqual(broker.getDistributedState().fairShare, 100);
      broker.close();
    });
  });

  describe('handlePeerSync', () => {
    it('records peer bucket state', () => {
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      broker._dispatch = () => {};
      broker.enableDistributedSync({
        nodeCount: 3, nodeId: 'node-1', sendFn: () => {}, syncIntervalMs: 999999,
      });
      broker.handlePeerSync({ type: 'SIEM_BUCKET_SYNC', from: 'node-2', localTokens: 15, maxLocalTokens: 33 });
      const state = broker.getDistributedState();
      assert.strictEqual(state.peerCount, 1);
      assert.strictEqual(state.peers['node-2'].localTokens, 15);
      broker.close();
    });

    it('ignores non-SIEM_BUCKET_SYNC messages', () => {
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      broker._dispatch = () => {};
      broker.enableDistributedSync({
        nodeCount: 3, nodeId: 'node-1', sendFn: () => {}, syncIntervalMs: 999999,
      });
      broker.handlePeerSync({ type: 'HEARTBEAT', from: 'node-2' });
      assert.strictEqual(broker.getDistributedState().peerCount, 0);
      broker.close();
    });
  });

  describe('handleTokenRequest', () => {
    it('grants tokens from surplus when above reserve floor', () => {
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      broker._dispatch = () => {};
      broker.enableDistributedSync({
        nodeCount: 4, nodeId: 'node-1', sendFn: () => {}, syncIntervalMs: 999999,
      });
      // fairShare=25, reserveFloor=5, tokens=25
      const granted = broker.handleTokenRequest({ type: 'SIEM_TOKEN_REQUEST', from: 'node-2', to: 'node-1', requested: 10 });
      assert.ok(granted > 0, 'should grant some tokens');
      assert.ok(broker.tokens >= 5, 'should not drop below reserve floor');
      broker.close();
    });

    it('grants zero when at reserve floor', () => {
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      broker._dispatch = () => {};
      broker.enableDistributedSync({
        nodeCount: 4, nodeId: 'node-1', sendFn: () => {}, syncIntervalMs: 999999,
      });
      // Drain to reserve floor
      broker.tokens = 5; // reserveFloor
      const granted = broker.handleTokenRequest({ type: 'SIEM_TOKEN_REQUEST', from: 'node-2', to: 'node-1', requested: 10 });
      assert.strictEqual(granted, 0, 'should not grant when at reserve floor');
      broker.close();
    });

    it('emits SIEM_TOKEN_GRANT response via sendFn', () => {
      let sentMsg = null;
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      broker._dispatch = () => {};
      broker.enableDistributedSync({
        nodeCount: 4, nodeId: 'node-1',
        sendFn: (msg) => { sentMsg = msg; },
        syncIntervalMs: 999999,
      });
      broker.handleTokenRequest({ type: 'SIEM_TOKEN_REQUEST', from: 'node-2', to: 'node-1', requested: 10 });
      assert.ok(sentMsg, 'should have sent a response');
      assert.strictEqual(sentMsg.type, 'SIEM_TOKEN_GRANT');
      assert.strictEqual(sentMsg.to, 'node-2');
      broker.close();
    });
  });

  describe('handleTokenGrant', () => {
    it('adds granted tokens to local bucket', () => {
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      broker._dispatch = () => {};
      broker.enableDistributedSync({
        nodeCount: 4, nodeId: 'node-1', sendFn: () => {}, syncIntervalMs: 999999,
      });
      broker.tokens = 0;
      broker.handleTokenGrant({ type: 'SIEM_TOKEN_GRANT', from: 'node-2', to: 'node-1', granted: 10 });
      assert.strictEqual(broker.tokens, 10, 'should have 10 tokens after grant');
      broker.close();
    });

    it('ignores grants for other nodes', () => {
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      broker._dispatch = () => {};
      broker.enableDistributedSync({
        nodeCount: 4, nodeId: 'node-1', sendFn: () => {}, syncIntervalMs: 999999,
      });
      broker.tokens = 0;
      broker.handleTokenGrant({ type: 'SIEM_TOKEN_GRANT', from: 'node-2', to: 'node-3', granted: 10 });
      assert.strictEqual(broker.tokens, 0, 'should not accept grants for other nodes');
      broker.close();
    });

    it('caps at maxTokens when grant would exceed capacity', () => {
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      broker._dispatch = () => {};
      broker.enableDistributedSync({
        nodeCount: 4, nodeId: 'node-1', sendFn: () => {}, syncIntervalMs: 999999,
      });
      broker.tokens = 90;
      broker.handleTokenGrant({ type: 'SIEM_TOKEN_GRANT', from: 'node-2', to: 'node-1', granted: 50 });
      assert.strictEqual(broker.tokens, 100, 'should cap at maxTokens');
      broker.close();
    });
  });

  describe('cluster-wide rate limit convergence', () => {
    it('N=3 nodes: total events before exhaustion ≈ maxTokens, not 3×maxTokens', () => {
      const { brokers } = createCluster(3, { maxTokens: 60, refillRate: 999999 });
      // Each node gets fairShare=20. Total cluster capacity = 60.
      // Without sync, each node would process 20 → total 60.
      // With sync, nodes can borrow from peers, but total is still capped at 60.

      let totalProcessed = 0;
      for (const broker of brokers) {
        broker.on('test_event_dispatched', () => totalProcessed++);
      }

      // Fire events round-robin across all 3 nodes
      let nodeIdx = 0;
      for (let i = 0; i < 200; i++) {
        const broker = brokers[nodeIdx % 3];
        broker.logEvent({ siemSeverity: 'LOW', siemCategory: `EVENT_${i}` });
        nodeIdx++;
      }

      // Without distributed sync, total would be 60 (3 × 20).
      // With sync, nodes can borrow, but total cluster capacity is still 60.
      // The exact number depends on how much borrowing happens synchronously.
      assert.ok(totalProcessed <= 60, `total processed (${totalProcessed}) should not exceed maxTokens (60)`);
      assert.ok(totalProcessed >= 20, `at least one fair share (${totalProcessed}) should be processed`);
      for (const broker of brokers) broker.close();
    });

    it('N=1 node: distributed sync does not change behavior', () => {
      const { brokers } = createCluster(1, { maxTokens: 50, refillRate: 999999 });
      const broker = brokers[0];
      let processed = 0;
      broker.on('test_event_dispatched', () => processed++);

      for (let i = 0; i < 100; i++) {
        broker.logEvent({ siemSeverity: 'LOW', siemCategory: `E${i}` });
      }
      assert.strictEqual(processed, 50, 'single node should process maxTokens events');
      broker.close();
    });

    it('CRITICAL/FATAL bypass distributed rate limiter', () => {
      const { brokers } = createCluster(3, { maxTokens: 30, refillRate: 999999 });
      const broker = brokers[0];
      // Exhaust all tokens across all nodes
      for (let i = 0; i < 100; i++) {
        brokers[i % 3].logEvent({ siemSeverity: 'LOW', siemCategory: `EXHAUST_${i}` });
      }
      // CRITICAL should still pass
      const result = broker.logEvent({
        siemSeverity: 'CRITICAL',
        siemCategory: 'CRITICAL_ATTACK',
      });
      assert.strictEqual(result, true, 'CRITICAL must bypass distributed rate limiter');
      for (const b of brokers) b.close();
    });
  });

  describe('getDistributedState', () => {
    it('returns complete state snapshot', () => {
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      broker._dispatch = () => {};
      broker.enableDistributedSync({
        nodeCount: 5, nodeId: 'node-3', sendFn: () => {}, syncIntervalMs: 999999,
      });
      broker.handlePeerSync({ type: 'SIEM_BUCKET_SYNC', from: 'node-1', localTokens: 10, maxLocalTokens: 20 });
      const state = broker.getDistributedState();
      assert.strictEqual(state.enabled, true);
      assert.strictEqual(state.nodeId, 'node-3');
      assert.strictEqual(state.nodeCount, 5);
      assert.strictEqual(state.fairShare, 20);
      assert.strictEqual(state.peerCount, 1);
      assert.ok(state.peers['node-1'], 'should have peer-1 state');
      broker.close();
    });

    it('returns disabled state when distributed sync is not enabled', () => {
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      broker._dispatch = () => {};
      const state = broker.getDistributedState();
      assert.strictEqual(state.enabled, false);
      broker.close();
    });
  });

  describe('close cleanup', () => {
    it('clears distributed sync timer on close', () => {
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      broker._dispatch = () => {};
      broker.enableDistributedSync({
        nodeCount: 3, nodeId: 'node-1', sendFn: () => {}, syncIntervalMs: 100,
      });
      assert.ok(broker._distSyncTimer, 'timer should exist');
      const timer = broker._distSyncTimer;
      broker.close();
      // After close(), the timer reference should be cleared or the timer destroyed
      // Node's clearInterval marks the timer as destroyed internally
      assert.ok(timer._destroyed || !broker._distSyncTimer, 'timer should be destroyed or cleared');
    });
  });
});
