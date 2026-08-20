"use strict";

/**
 * Integration test: distributed token bucket sync via cluster-keyring-sync IPC.
 *
 * Verifies that SIEM_BUCKET_SYNC, SIEM_TOKEN_REQUEST, and SIEM_TOKEN_GRANT
 * messages are correctly routed through _handleMessage to the broker's
 * distributed sync handlers, and that the cluster-wide rate limit
 * converges to maxTokens (not N × maxTokens) across N nodes.
 */

const assert = require("node:assert");
const { describe, it, beforeEach, afterEach } = require("node:test");
const path = require("path");

const SiemSecurityBroker = require(
  path.resolve(process.cwd(), "server", "lib", "siem", "siem-broker.cjs"),
);
const clusterSync = require(
  path.resolve(process.cwd(), "server", "lib", "cluster-keyring-sync.cjs"),
);

function createMockSocket(remoteAddress, remotePort) {
  return {
    remoteAddress,
    remotePort,
    destroyed: false,
    write: () => {},
    on: () => {},
    destroy() {
      this.destroyed = true;
    },
  };
}

describe("Distributed token bucket sync via cluster-keyring-sync IPC", () => {
  let broker;

  beforeEach(() => {
    broker = new SiemSecurityBroker({
      rateLimitMaxTokens: 60,
      rateLimitRefillRateMs: 999999,
      transportStrategy: "STDOUT_ONLY",
    });
    broker._dispatch = () => {}; // suppress output
    broker.enableDistributedSync({
      nodeCount: 3,
      nodeId: "node-1",
      sendFn: () => {}, // no-op for these tests
      syncIntervalMs: 999999,
    });
    clusterSync.setBroker(broker);
  });

  afterEach(() => {
    broker.close();
    clusterSync.setBroker(null);
  });

  it("routes SIEM_BUCKET_SYNC to broker.handlePeerSync", () => {
    const socket = createMockSocket("127.0.0.1", 7001);
    // We need to bypass the unknown-peer check. Use _handleMessage directly
    // with a known peer. First, add the peer to the cluster.
    // Since we can't easily set up the full cluster, we'll test the routing
    // by checking that the broker's peer state updates.

    // The schema validation will pass, but the unknown-peer check may reject.
    // SIEM_BUCKET_SYNC messages should be processed before the unknown-peer check
    // since they are in the same category as PING (not HEARTBEAT/KEY_COMMIT).

    // Actually, looking at _handleMessage, SIEM_BUCKET_SYNC is handled AFTER
    // the HEARTBEAT/KEY_COMMIT block, in the same section as PING.
    // It does not go through the unknown-peer check.
    clusterSync._handleMessage(
      {
        type: "SIEM_BUCKET_SYNC",
        from: "node-2",
        localTokens: 15,
        maxLocalTokens: 20,
      },
      socket,
    );

    const state = broker.getDistributedState();
    assert.strictEqual(state.peerCount, 1, "peer should be registered");
    assert.strictEqual(state.peers["node-2"].localTokens, 15);
  });

  it("routes SIEM_TOKEN_REQUEST to broker.handleTokenRequest", () => {
    const socket = createMockSocket("127.0.0.1", 7001);
    // broker has fairShare=20, tokens=20, reserveFloor=4
    // Request 10 tokens from node-2
    clusterSync._handleMessage(
      {
        type: "SIEM_TOKEN_REQUEST",
        from: "node-2",
        to: "node-1",
        requested: 10,
      },
      socket,
    );

    // broker should have granted some tokens (surplus = 20 - 4 = 16)
    assert.ok(
      broker.tokens < 20,
      "broker should have granted tokens from surplus",
    );
    assert.ok(broker.tokens >= 4, "broker should not drop below reserve floor");
  });

  it("routes SIEM_TOKEN_GRANT to broker.handleTokenGrant", () => {
    const socket = createMockSocket("127.0.0.1", 7001);
    broker.tokens = 0;
    clusterSync._handleMessage(
      {
        type: "SIEM_TOKEN_GRANT",
        from: "node-2",
        to: "node-1",
        granted: 10,
      },
      socket,
    );

    assert.strictEqual(
      broker.tokens,
      10,
      "broker should have received granted tokens",
    );
  });

  it("SIEM_TOKEN_GRANT for wrong node is ignored", () => {
    const socket = createMockSocket("127.0.0.1", 7001);
    broker.tokens = 0;
    clusterSync._handleMessage(
      {
        type: "SIEM_TOKEN_GRANT",
        from: "node-2",
        to: "node-3", // not us
        granted: 10,
      },
      socket,
    );

    assert.strictEqual(
      broker.tokens,
      0,
      "grant for wrong node should be ignored",
    );
  });

  it("does not crash when broker is not set", () => {
    clusterSync.setBroker(null);
    const socket = createMockSocket("127.0.0.1", 7001);
    // Should not throw
    clusterSync._handleMessage(
      {
        type: "SIEM_BUCKET_SYNC",
        from: "node-2",
        localTokens: 15,
        maxLocalTokens: 20,
      },
      socket,
    );
    assert.ok(true, "did not crash without broker");
  });

  it("does not crash when broker lacks distributed sync methods", () => {
    const simpleBroker = { logEvent: () => true };
    clusterSync.setBroker(simpleBroker);
    const socket = createMockSocket("127.0.0.1", 7001);
    // Should not throw — handlePeerSync check should guard
    clusterSync._handleMessage(
      {
        type: "SIEM_BUCKET_SYNC",
        from: "node-2",
        localTokens: 15,
        maxLocalTokens: 20,
      },
      socket,
    );
    assert.ok(true, "did not crash with simple broker");
  });
});

describe("Multi-node cluster rate limit convergence", () => {
  it("N=3 cluster: total processed events converge to maxTokens", () => {
    const maxTokens = 60;
    const nodeCount = 3;
    const fairShare = Math.floor(maxTokens / nodeCount); // 20

    // Create 3 brokers with a synchronous message bus
    const brokers = [];
    const bus = {
      send(fromId, msg) {
        for (const b of brokers) {
          if (b._nodeId === fromId) continue;
          if (msg.type === "SIEM_BUCKET_SYNC") b.handlePeerSync(msg);
          else if (msg.type === "SIEM_TOKEN_REQUEST") {
            // Peer processes request and may grant
            const granted = b.handleTokenRequest(msg);
            if (granted > 0) {
              // Grant message is sent back via sendFn
              // In our bus, handleTokenRequest already sends SIEM_TOKEN_GRANT
              // via the broker's own sendFn, which goes through bus.send
            }
          } else if (msg.type === "SIEM_TOKEN_GRANT") b.handleTokenGrant(msg);
        }
      },
    };

    for (let i = 0; i < nodeCount; i++) {
      const b = new SiemSecurityBroker({
        rateLimitMaxTokens: maxTokens,
        rateLimitRefillRateMs: 999999,
        transportStrategy: "STDOUT_ONLY",
      });
      b._dispatch = function (event) {
        this.emit("test_event_dispatched", event);
      };
      brokers.push(b);
    }

    // Enable distributed sync
    for (let i = 0; i < brokers.length; i++) {
      brokers[i].enableDistributedSync({
        nodeCount,
        nodeId: `node-${i + 1}`,
        sendFn: (msg) => bus.send(`node-${i + 1}`, msg),
        syncIntervalMs: 999999,
      });
    }

    // Broadcast initial state so all nodes know each other
    for (const b of brokers) {
      b._broadcastBucketState();
    }

    // Each broker should have fairShare tokens
    for (const b of brokers) {
      assert.strictEqual(
        b.tokens,
        fairShare,
        `each node should start with fair share (${fairShare})`,
      );
    }

    // Fire events round-robin
    let totalProcessed = 0;
    for (const b of brokers) {
      b.on("test_event_dispatched", () => totalProcessed++);
    }

    for (let i = 0; i < 300; i++) {
      brokers[i % nodeCount].logEvent({
        siemSeverity: "LOW",
        siemCategory: `E${i}`,
      });
    }

    // Total processed should not exceed maxTokens (cluster-wide limit)
    assert.ok(
      totalProcessed <= maxTokens,
      `total processed (${totalProcessed}) should not exceed maxTokens (${maxTokens})`,
    );
    assert.ok(
      totalProcessed >= fairShare,
      `at least one fair share (${totalProcessed}) should be processed`,
    );

    for (const b of brokers) b.close();
  });

  it("N=5 cluster: fair share = maxTokens / 5, total converges", () => {
    const maxTokens = 100;
    const nodeCount = 5;
    const fairShare = Math.floor(maxTokens / nodeCount); // 20

    const brokers = [];
    const bus = {
      send(fromId, msg) {
        for (const b of brokers) {
          if (b._nodeId === fromId) continue;
          if (msg.type === "SIEM_BUCKET_SYNC") b.handlePeerSync(msg);
          else if (msg.type === "SIEM_TOKEN_REQUEST") b.handleTokenRequest(msg);
          else if (msg.type === "SIEM_TOKEN_GRANT") b.handleTokenGrant(msg);
        }
      },
    };

    for (let i = 0; i < nodeCount; i++) {
      const b = new SiemSecurityBroker({
        rateLimitMaxTokens: maxTokens,
        rateLimitRefillRateMs: 999999,
        transportStrategy: "STDOUT_ONLY",
      });
      b._dispatch = function (event) {
        this.emit("test_event_dispatched", event);
      };
      brokers.push(b);
    }

    for (let i = 0; i < brokers.length; i++) {
      brokers[i].enableDistributedSync({
        nodeCount,
        nodeId: `node-${i + 1}`,
        sendFn: (msg) => bus.send(`node-${i + 1}`, msg),
        syncIntervalMs: 999999,
      });
    }

    for (const b of brokers) b._broadcastBucketState();

    let totalProcessed = 0;
    for (const b of brokers) {
      b.on("test_event_dispatched", () => totalProcessed++);
    }

    for (let i = 0; i < 500; i++) {
      brokers[i % nodeCount].logEvent({
        siemSeverity: "LOW",
        siemCategory: `E${i}`,
      });
    }

    assert.ok(
      totalProcessed <= maxTokens,
      `total processed (${totalProcessed}) should not exceed maxTokens (${maxTokens})`,
    );

    for (const b of brokers) b.close();
  });

  it("network partition: node falls back to fair share when peers unreachable", () => {
    const maxTokens = 60;
    const nodeCount = 3;
    const fairShare = 20;

    // Create a broker with no working sendFn (simulating partition)
    const broker = new SiemSecurityBroker({
      rateLimitMaxTokens: maxTokens,
      rateLimitRefillRateMs: 999999,
      transportStrategy: "STDOUT_ONLY",
    });
    broker._dispatch = function (event) {
      this.emit("test_event_dispatched", event);
    };
    broker.enableDistributedSync({
      nodeCount,
      nodeId: "node-1",
      sendFn: () => {}, // messages go nowhere (partition)
      syncIntervalMs: 999999,
    });

    let processed = 0;
    broker.on("test_event_dispatched", () => processed++);

    // Fire events — should only process fairShare (can't borrow from peers)
    for (let i = 0; i < 100; i++) {
      broker.logEvent({ siemSeverity: "LOW", siemCategory: `E${i}` });
    }

    assert.strictEqual(
      processed,
      fairShare,
      `partitioned node should process exactly fairShare (${fairShare}) events`,
    );
    broker.close();
  });
});
