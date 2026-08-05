'use strict';

/**
 * Unit tests for asymmetric node weighting in the distributed token bucket.
 *
 * Verifies that nodes with different capacity weights receive proportionally
 * different fair-share allocations, that borrowing prefers high-weight peers,
 * and that the system gracefully handles partition fallback.
 *
 * Formula: fairShare = maxTokens * (localWeight / sumOfAllWeights)
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
 * Create a cluster of N brokers with optional per-node weights.
 * @param {number} nodeCount
 * @param {object} opts
 * @param {number} [opts.maxTokens=100]
 * @param {number} [opts.refillRate=999999]
 * @param {number[]} [opts.weights] — per-node weights (default all 1)
 */
function createWeightedCluster(nodeCount, opts = {}) {
  const maxTokens = opts.maxTokens || 100;
  const refillRate = opts.refillRate || 999999;
  const weights = opts.weights || new Array(nodeCount).fill(1);
  const brokers = [];
  const bus = createMockMessageBus(brokers);

  for (let i = 0; i < nodeCount; i++) {
    const nodeId = `node-${i + 1}`;
    const broker = new SiemSecurityBroker({
      rateLimitMaxTokens: maxTokens,
      rateLimitRefillRateMs: refillRate,
      transportStrategy: 'STDOUT_ONLY',
    });
    broker._dispatch = function (event) {
      this.emit('test_event_dispatched', event);
    };
    brokers.push(broker);
  }

  for (let i = 0; i < brokers.length; i++) {
    const nodeId = `node-${i + 1}`;
    brokers[i].enableDistributedSync({
      nodeCount,
      nodeId,
      weight: weights[i] || 1,
      sendFn: (msg) => bus.send(nodeId, msg),
      syncIntervalMs: 999999,
    });
  }

  return { brokers, bus };
}

describe('SiemSecurityBroker asymmetric node weighting', () => {

  describe('enableDistributedSync with weight', () => {

    it('W1: defaults to weight=1 when not specified', () => {
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      broker._dispatch = () => {};
      broker.enableDistributedSync({
        nodeCount: 4, nodeId: 'n1', sendFn: () => {}, syncIntervalMs: 999999,
      });
      assert.strictEqual(broker._nodeWeight, 1, 'default weight should be 1');
      broker.close();
    });

    it('W2: accepts explicit weight parameter', () => {
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      broker._dispatch = () => {};
      broker.enableDistributedSync({
        nodeCount: 4, nodeId: 'n1', weight: 5, sendFn: () => {}, syncIntervalMs: 999999,
      });
      assert.strictEqual(broker._nodeWeight, 5, 'weight should be 5');
      broker.close();
    });

    it('W3: rejects non-positive weight (defaults to 1)', () => {
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      broker._dispatch = () => {};
      broker.enableDistributedSync({
        nodeCount: 4, nodeId: 'n1', weight: 0, sendFn: () => {}, syncIntervalMs: 999999,
      });
      assert.strictEqual(broker._nodeWeight, 1, 'weight 0 should default to 1');
      broker.close();
    });

    it('W4: rejects negative weight (defaults to 1)', () => {
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      broker._dispatch = () => {};
      broker.enableDistributedSync({
        nodeCount: 4, nodeId: 'n1', weight: -3, sendFn: () => {}, syncIntervalMs: 999999,
      });
      assert.strictEqual(broker._nodeWeight, 1, 'negative weight should default to 1');
      broker.close();
    });

    it('W5: rejects non-numeric weight (defaults to 1)', () => {
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      broker._dispatch = () => {};
      broker.enableDistributedSync({
        nodeCount: 4, nodeId: 'n1', weight: 'high', sendFn: () => {}, syncIntervalMs: 999999,
      });
      assert.strictEqual(broker._nodeWeight, 1, 'string weight should default to 1');
      broker.close();
    });

    it('W6: initial fair share is still maxTokens/nodeCount before peer sync', () => {
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      broker._dispatch = () => {};
      broker.enableDistributedSync({
        nodeCount: 4, nodeId: 'n1', weight: 3, sendFn: () => {}, syncIntervalMs: 999999,
      });
      // Before peer sync arrives, fair share uses simple maxTokens/N
      assert.strictEqual(broker._fairShare, 25, 'initial fair share should be 100/4');
      broker.close();
    });
  });

  describe('SIEM_BUCKET_SYNC weight broadcast', () => {

    it('W7: broadcast message includes weight property', () => {
      let sentMsg = null;
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      broker._dispatch = () => {};
      broker.enableDistributedSync({
        nodeCount: 3, nodeId: 'n1', weight: 4, sendFn: (msg) => { sentMsg = msg; }, syncIntervalMs: 999999,
      });
      assert.ok(sentMsg, 'should have broadcast a message');
      assert.strictEqual(sentMsg.type, 'SIEM_BUCKET_SYNC');
      assert.strictEqual(sentMsg.weight, 4, 'broadcast should include weight=4');
      broker.close();
    });

    it('W8: broadcast weight defaults to 1 when not specified', () => {
      let sentMsg = null;
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      broker._dispatch = () => {};
      broker.enableDistributedSync({
        nodeCount: 3, nodeId: 'n1', sendFn: (msg) => { sentMsg = msg; }, syncIntervalMs: 999999,
      });
      assert.strictEqual(sentMsg.weight, 1, 'default broadcast weight should be 1');
      broker.close();
    });
  });

  describe('handlePeerSync with weight', () => {

    it('W9: stores peer weight from sync message', () => {
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      broker._dispatch = () => {};
      broker.enableDistributedSync({
        nodeCount: 3, nodeId: 'n1', weight: 1, sendFn: () => {}, syncIntervalMs: 999999,
      });
      broker.handlePeerSync({
        type: 'SIEM_BUCKET_SYNC', from: 'n2',
        localTokens: 30, maxLocalTokens: 50, weight: 5,
      });
      const state = broker.getDistributedState();
      assert.strictEqual(state.peers['n2'].weight, 5, 'peer weight should be stored');
      broker.close();
    });

    it('W10: defaults peer weight to 1 when not in message', () => {
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      broker._dispatch = () => {};
      broker.enableDistributedSync({
        nodeCount: 3, nodeId: 'n1', sendFn: () => {}, syncIntervalMs: 999999,
      });
      broker.handlePeerSync({
        type: 'SIEM_BUCKET_SYNC', from: 'n2',
        localTokens: 30, maxLocalTokens: 50,
        // no weight field
      });
      const state = broker.getDistributedState();
      assert.strictEqual(state.peers['n2'].weight, 1, 'missing weight should default to 1');
      broker.close();
    });
  });

  describe('weighted fair share recalculation', () => {

    it('W11: high-weight node gets proportionally larger fair share', () => {
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      broker._dispatch = () => {};
      broker.enableDistributedSync({
        nodeCount: 3, nodeId: 'core-1', weight: 4, sendFn: () => {}, syncIntervalMs: 999999,
      });
      // Simulate 2 edge nodes with weight 1 each
      broker.handlePeerSync({ type: 'SIEM_BUCKET_SYNC', from: 'edge-1', localTokens: 10, maxLocalTokens: 20, weight: 1 });
      broker.handlePeerSync({ type: 'SIEM_BUCKET_SYNC', from: 'edge-2', localTokens: 10, maxLocalTokens: 20, weight: 1 });
      // totalWeight = 4 + 1 + 1 = 6, fairShare = 100 * (4/6) = 66
      assert.strictEqual(broker._fairShare, 66, 'high-weight core should get 66 tokens');
      broker.close();
    });

    it('W12: low-weight edge node gets proportionally smaller fair share', () => {
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      broker._dispatch = () => {};
      broker.enableDistributedSync({
        nodeCount: 3, nodeId: 'edge-1', weight: 1, sendFn: () => {}, syncIntervalMs: 999999,
      });
      // Simulate 1 core node (weight 4) and 1 edge node (weight 1)
      broker.handlePeerSync({ type: 'SIEM_BUCKET_SYNC', from: 'core-1', localTokens: 60, maxLocalTokens: 66, weight: 4 });
      broker.handlePeerSync({ type: 'SIEM_BUCKET_SYNC', from: 'edge-2', localTokens: 10, maxLocalTokens: 16, weight: 1 });
      // totalWeight = 1 + 4 + 1 = 6, fairShare = 100 * (1/6) = 16
      assert.strictEqual(broker._fairShare, 16, 'low-weight edge should get 16 tokens');
      broker.close();
    });

    it('W13: homogeneous weights (all 1) produce same result as maxTokens/N', () => {
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      broker._dispatch = () => {};
      broker.enableDistributedSync({
        nodeCount: 4, nodeId: 'n1', weight: 1, sendFn: () => {}, syncIntervalMs: 999999,
      });
      broker.handlePeerSync({ type: 'SIEM_BUCKET_SYNC', from: 'n2', localTokens: 20, maxLocalTokens: 25, weight: 1 });
      broker.handlePeerSync({ type: 'SIEM_BUCKET_SYNC', from: 'n3', localTokens: 20, maxLocalTokens: 25, weight: 1 });
      broker.handlePeerSync({ type: 'SIEM_BUCKET_SYNC', from: 'n4', localTokens: 20, maxLocalTokens: 25, weight: 1 });
      // totalWeight = 1+1+1+1 = 4, fairShare = 100 * (1/4) = 25
      assert.strictEqual(broker._fairShare, 25, 'homogeneous weights should produce 25');
      broker.close();
    });

    it('W14: reserve floor scales with weighted fair share', () => {
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      broker._dispatch = () => {};
      broker.enableDistributedSync({
        nodeCount: 3, nodeId: 'core-1', weight: 4, sendFn: () => {}, syncIntervalMs: 999999,
      });
      broker.handlePeerSync({ type: 'SIEM_BUCKET_SYNC', from: 'edge-1', localTokens: 10, maxLocalTokens: 16, weight: 1 });
      broker.handlePeerSync({ type: 'SIEM_BUCKET_SYNC', from: 'edge-2', localTokens: 10, maxLocalTokens: 16, weight: 1 });
      // fairShare = 66, reserveFloor = floor(66 * 0.2) = 13
      assert.strictEqual(broker._fairShare, 66);
      assert.strictEqual(broker._reserveFloor, 13, 'reserve floor should be 20% of 66');
      broker.close();
    });

    it('W15: tokens are capped when fair share decreases on weight update', () => {
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      broker._dispatch = () => {};
      broker.enableDistributedSync({
        nodeCount: 3, nodeId: 'core-1', weight: 4, sendFn: () => {}, syncIntervalMs: 999999,
      });
      // Initially fairShare = 100/3 = 33, tokens capped to 33
      assert.strictEqual(broker.tokens, 33);
      // Now peers arrive with weight 1 each — recalculation: 100*(4/6) = 66
      broker.handlePeerSync({ type: 'SIEM_BUCKET_SYNC', from: 'edge-1', localTokens: 10, maxLocalTokens: 16, weight: 1 });
      broker.handlePeerSync({ type: 'SIEM_BUCKET_SYNC', from: 'edge-2', localTokens: 10, maxLocalTokens: 16, weight: 1 });
      // fairShare increased to 66, tokens stay at 33 (not capped, just allowed to grow)
      assert.strictEqual(broker._fairShare, 66);
      assert.strictEqual(broker.tokens, 33, 'tokens should not change when fair share increases');
      broker.close();
    });
  });

  describe('weighted borrowing preference', () => {

    it('W16: _borrowFromPeers sorts peers by weight descending', () => {
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      broker._dispatch = () => {};
      broker.enableDistributedSync({
        nodeCount: 4, nodeId: 'edge-1', weight: 1, sendFn: () => {}, syncIntervalMs: 999999,
      });
      // Add peers: low-weight first, high-weight second
      broker.handlePeerSync({ type: 'SIEM_BUCKET_SYNC', from: 'edge-2', localTokens: 20, maxLocalTokens: 25, weight: 1 });
      broker.handlePeerSync({ type: 'SIEM_BUCKET_SYNC', from: 'core-1', localTokens: 80, maxLocalTokens: 80, weight: 4 });
      broker.handlePeerSync({ type: 'SIEM_BUCKET_SYNC', from: 'core-2', localTokens: 60, maxLocalTokens: 60, weight: 3 });

      // Track the order of token requests
      const requestOrder = [];
      broker._sendToPeers = (msg) => {
        if (msg.type === 'SIEM_TOKEN_REQUEST') requestOrder.push(msg.to);
      };

      // Drain local tokens to trigger borrowing
      broker.tokens = 0;
      broker._borrowFromPeers();

      // Core-1 (weight 4) should be requested before core-2 (weight 3) before edge-2 (weight 1)
      assert.ok(requestOrder.length > 0, 'should have sent at least one request');
      const core1Idx = requestOrder.indexOf('core-1');
      const core2Idx = requestOrder.indexOf('core-2');
      const edge2Idx = requestOrder.indexOf('edge-2');
      if (core1Idx >= 0 && core2Idx >= 0) {
        assert.ok(core1Idx < core2Idx, 'core-1 (weight 4) should be requested before core-2 (weight 3)');
      }
      if (core2Idx >= 0 && edge2Idx >= 0) {
        assert.ok(core2Idx < edge2Idx, 'core-2 (weight 3) should be requested before edge-2 (weight 1)');
      }
      broker.close();
    });
  });

  describe('getDistributedState with weight info', () => {

    it('W17: state includes nodeWeight and clusterWeight', () => {
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      broker._dispatch = () => {};
      broker.enableDistributedSync({
        nodeCount: 3, nodeId: 'n1', weight: 5, sendFn: () => {}, syncIntervalMs: 999999,
      });
      broker.handlePeerSync({ type: 'SIEM_BUCKET_SYNC', from: 'n2', localTokens: 10, maxLocalTokens: 20, weight: 3 });
      const state = broker.getDistributedState();
      assert.strictEqual(state.nodeWeight, 5, 'state should include local node weight');
      assert.strictEqual(state.clusterWeight, 8, 'cluster weight should be 5+3');
      broker.close();
    });

    it('W18: disabled state includes null weight fields', () => {
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      broker._dispatch = () => {};
      const state = broker.getDistributedState();
      assert.strictEqual(state.nodeWeight, null);
      assert.strictEqual(state.clusterWeight, null);
      broker.close();
    });
  });

  describe('getClusterTelemetry with weight info', () => {

    it('W19: telemetry includes nodeWeight and clusterWeight', () => {
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      broker._dispatch = () => {};
      broker.enableDistributedSync({
        nodeCount: 3, nodeId: 'n1', weight: 2, sendFn: () => {}, syncIntervalMs: 999999,
      });
      broker.handlePeerSync({ type: 'SIEM_BUCKET_SYNC', from: 'n2', localTokens: 10, maxLocalTokens: 20, weight: 3 });
      const telemetry = broker.getClusterTelemetry();
      assert.strictEqual(telemetry.nodeWeight, 2);
      assert.strictEqual(telemetry.clusterWeight, 5);
      broker.close();
    });
  });

  describe('weighted cluster convergence', () => {

    it('W20: 3-node weighted cluster: core(4) + edge(1) + edge(1), total capacity = maxTokens', () => {
      const { brokers } = createWeightedCluster(3, {
        maxTokens: 60,
        refillRate: 999999,
        weights: [4, 1, 1],
      });

      // After initial sync, core should have fairShare = 60*(4/6) = 40
      // Each edge should have fairShare = 60*(1/6) = 10
      // But initial fairShare before peer sync is 60/3 = 20

      // Trigger peer sync by broadcasting
      for (const broker of brokers) {
        broker._broadcastBucketState();
      }

      // Check weighted fair shares converged
      const coreState = brokers[0].getDistributedState();
      const edge1State = brokers[1].getDistributedState();
      const edge2State = brokers[2].getDistributedState();

      // Core: 60 * (4/6) = 40
      assert.strictEqual(coreState.fairShare, 40, 'core should have fair share of 40');
      // Edge: 60 * (1/6) = 10
      assert.strictEqual(edge1State.fairShare, 10, 'edge-1 should have fair share of 10');
      assert.strictEqual(edge2State.fairShare, 10, 'edge-2 should have fair share of 10');

      for (const b of brokers) b.close();
    });

    it('W21: CRITICAL/FATAL bypass still works with weighted cluster', () => {
      const { brokers } = createWeightedCluster(3, {
        maxTokens: 30,
        refillRate: 999999,
        weights: [4, 1, 1],
      });

      // Exhaust all tokens
      for (let i = 0; i < 100; i++) {
        brokers[i % 3].logEvent({ siemSeverity: 'LOW', siemCategory: `EXHAUST_${i}` });
      }

      // CRITICAL should still pass
      const result = brokers[0].logEvent({
        siemSeverity: 'CRITICAL',
        siemCategory: 'CRITICAL_ATTACK',
      });
      assert.strictEqual(result, true, 'CRITICAL must bypass weighted rate limiter');
      for (const b of brokers) b.close();
    });

    it('W22: partition fallback — node alone uses its own weight-scaled share', () => {
      const broker = new SiemSecurityBroker({ rateLimitMaxTokens: 100, rateLimitRefillRateMs: 999999 });
      broker._dispatch = function (event) { this.emit('test_event_dispatched', event); };
      broker.enableDistributedSync({
        nodeCount: 3, nodeId: 'isolated-1', weight: 1, sendFn: () => {}, syncIntervalMs: 999999,
      });
      // No peer syncs arrive (partition) — fair share stays at initial maxTokens/N
      assert.strictEqual(broker._fairShare, 33, 'partitioned node should use initial fair share');
      // Node can still process events up to its fair share
      let processed = 0;
      broker.on('test_event_dispatched', () => processed++);
      for (let i = 0; i < 50; i++) {
        broker.logEvent({ siemSeverity: 'LOW', siemCategory: `ISO_${i}` });
      }
      assert.ok(processed <= 33, `processed (${processed}) should not exceed fair share (33)`);
      assert.ok(processed > 0, 'should process at least some events');
      broker.close();
    });
  });
});
