"use strict";

/**
 * Track 34 Phase 6: Log compaction & snapshotting tests.
 */
const crypto = require("crypto");
const {
  ClusterConsensusEngine,
  NODE_STATE,
  CONSENSUS_EVENT,
} = require("../cluster-consensus-engine.cjs");
const { CryptoPolicyEngine } = require("../crypto-policy-engine.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");

function generateKeyPair() {
  return crypto.generateKeyPairSync("ed25519");
}

function signPayload(payload, privateKey) {
  const data = Buffer.from(JSON.stringify(payload), "utf8");
  return crypto.sign(null, data, privateKey).toString("base64");
}

// Helper: create a leader engine and populate the log with N committed entries
async function createLeaderWithLog(nodeId, clusterNodes, count, options = {}) {
  const engine = new ClusterConsensusEngine({
    nodeId,
    clusterNodes,
    ...options,
  });
  engine.start();
  await engine.startElection();
  for (let i = 0; i < count; i++) {
    await engine.appendAndReplicate({ operation: "test", seq: i });
  }
  return engine;
}

describe("Track 34 Phase 6 snapshotting — createSnapshot", () => {
  test("createSnapshot truncates log prefix and stores state", async () => {
    let stateValue = { counter: 5 };
    const engine = new ClusterConsensusEngine({
      nodeId: "node-a",
      clusterNodes: ["node-a", "node-b", "node-c"],
      captureSnapshotState: () => ({ ...stateValue }),
    });
    engine.start();
    await engine.startElection();

    // Add 5 committed entries
    for (let i = 0; i < 5; i++) {
      await engine.appendAndReplicate({ operation: "test", seq: i });
    }
    expect(engine.getState().logLength).toBe(5);
    expect(engine.getState().commitIndex).toBe(5);

    const result = engine.createSnapshot();
    expect(result.lastSnapshotIndex).toBe(5);
    expect(result.truncatedEntries).toBe(5);
    expect(result.snapshotState).toEqual({ counter: 5 });
    expect(engine.getState().logLength).toBe(0);
    expect(engine.getState().lastSnapshotIndex).toBe(5);
    expect(engine.getState().hasSnapshot).toBe(true);

    engine.stop();
  });

  test("createSnapshot rejects when commitIndex is 0", () => {
    const engine = new ClusterConsensusEngine({
      nodeId: "node-a",
      clusterNodes: ["node-a", "node-b"],
    });
    expect(() => engine.createSnapshot()).toThrow(HsmAdapterError);
    expect(() => engine.createSnapshot()).toThrow("commitIndex=0");
  });

  test("createSnapshot rejects when commitIndex already covered by snapshot", async () => {
    const engine = new ClusterConsensusEngine({
      nodeId: "node-a",
      clusterNodes: ["node-a", "node-b", "node-c"],
      captureSnapshotState: () => ({}),
    });
    engine.start();
    await engine.startElection();
    for (let i = 0; i < 3; i++) {
      await engine.appendAndReplicate({ operation: "test", seq: i });
    }
    engine.createSnapshot();
    // Try to snapshot again at same index
    expect(() => engine.createSnapshot()).toThrow(HsmAdapterError);
    expect(() => engine.createSnapshot()).toThrow("already covered");

    engine.stop();
  });

  test("createSnapshot uses stateOverride when provided", async () => {
    const engine = new ClusterConsensusEngine({
      nodeId: "node-a",
      clusterNodes: ["node-a", "node-b", "node-c"],
    });
    engine.start();
    await engine.startElection();
    for (let i = 0; i < 3; i++) {
      await engine.appendAndReplicate({ operation: "test", seq: i });
    }
    const customState = { custom: true };
    const result = engine.createSnapshot(customState);
    expect(result.snapshotState).toEqual({ custom: true });

    engine.stop();
  });

  test("createSnapshot records correct lastSnapshotTerm", async () => {
    const engine = new ClusterConsensusEngine({
      nodeId: "node-a",
      clusterNodes: ["node-a", "node-b", "node-c"],
      captureSnapshotState: () => null,
    });
    engine.start();
    await engine.startElection();
    await engine.appendAndReplicate({ operation: "test" });
    const termBefore = engine.getState().term;
    const result = engine.createSnapshot();
    expect(result.lastSnapshotTerm).toBe(termBefore);

    engine.stop();
  });
});

describe("Track 34 Phase 6 snapshotting — maybeCompact", () => {
  test("maybeCompact returns null when below threshold", async () => {
    const engine = new ClusterConsensusEngine({
      nodeId: "node-a",
      clusterNodes: ["node-a", "node-b", "node-c"],
      snapshotThreshold: 10,
      captureSnapshotState: () => ({}),
    });
    engine.start();
    await engine.startElection();
    for (let i = 0; i < 5; i++) {
      await engine.appendAndReplicate({ operation: "test", seq: i });
    }
    expect(engine.maybeCompact()).toBeNull();
    engine.stop();
  });

  test("maybeCompact triggers compaction when threshold exceeded", async () => {
    const engine = new ClusterConsensusEngine({
      nodeId: "node-a",
      clusterNodes: ["node-a", "node-b", "node-c"],
      snapshotThreshold: 5,
      captureSnapshotState: () => ({ compacted: true }),
    });
    engine.start();
    await engine.startElection();
    for (let i = 0; i < 10; i++) {
      await engine.appendAndReplicate({ operation: "test", seq: i });
    }
    const result = engine.maybeCompact();
    expect(result).not.toBeNull();
    expect(result.lastSnapshotIndex).toBe(10);
    expect(engine.getState().logLength).toBe(0);
    engine.stop();
  });
});

describe("Track 34 Phase 6 snapshotting — post-compaction operations", () => {
  test("can append new entries after snapshot", async () => {
    const engine = new ClusterConsensusEngine({
      nodeId: "node-a",
      clusterNodes: ["node-a", "node-b", "node-c"],
      captureSnapshotState: () => ({}),
    });
    engine.start();
    await engine.startElection();
    for (let i = 0; i < 5; i++) {
      await engine.appendAndReplicate({ operation: "test", seq: i });
    }
    engine.createSnapshot();
    expect(engine.getState().logLength).toBe(0);

    // Append new entry — index should continue from 6
    const result = await engine.appendAndReplicate({
      operation: "post-snapshot",
    });
    expect(result.index).toBe(6);
    expect(engine.getState().logLength).toBe(1);

    engine.stop();
  });

  test("getState includes snapshot info", async () => {
    const engine = new ClusterConsensusEngine({
      nodeId: "node-a",
      clusterNodes: ["node-a", "node-b", "node-c"],
      captureSnapshotState: () => ({ data: "test" }),
    });
    engine.start();
    await engine.startElection();
    await engine.appendAndReplicate({ operation: "test" });

    const stateBefore = engine.getState();
    expect(stateBefore.lastSnapshotIndex).toBe(0);
    expect(stateBefore.hasSnapshot).toBe(false);

    engine.createSnapshot();

    const stateAfter = engine.getState();
    expect(stateAfter.lastSnapshotIndex).toBe(1);
    expect(stateAfter.hasSnapshot).toBe(true);

    engine.stop();
  });

  test("election uses absolute log index after snapshot", async () => {
    const engine = new ClusterConsensusEngine({
      nodeId: "node-a",
      clusterNodes: ["node-a", "node-b", "node-c"],
      captureSnapshotState: () => ({}),
    });
    engine.start();
    await engine.startElection();
    for (let i = 0; i < 5; i++) {
      await engine.appendAndReplicate({ operation: "test", seq: i });
    }
    engine.createSnapshot();
    await engine.appendAndReplicate({ operation: "post" });

    // The last log index should be 6 (5 snapshot + 1 new)
    const state = engine.getState();
    expect(state.lastSnapshotIndex).toBe(5);
    expect(state.logLength).toBe(1);

    engine.stop();
  });
});

describe("Track 34 Phase 6 snapshotting — installSnapshot", () => {
  test("follower installs snapshot from leader", async () => {
    const leaderKeys = generateKeyPair();
    const follower = new ClusterConsensusEngine({
      nodeId: "node-b",
      clusterNodes: ["node-a", "node-b", "node-c"],
      peerPublicKeys: new Map([["node-a", leaderKeys.publicKey]]),
      requireRpcSigning: true,
      replayWindowMs: 60000,
    });
    follower.start();

    const snapshotState = { counter: 42, keys: ["k1", "k2"] };
    const payload = {
      term: 1,
      leaderId: "node-a",
      lastIncludedIndex: 10,
      lastIncludedTerm: 1,
      state: snapshotState,
      nonce: 1,
      timestamp: Date.now(),
    };
    const sig = signPayload(payload, leaderKeys.privateKey);
    const result = follower.installSnapshot({ ...payload, signature: sig });

    expect(result.success).toBe(true);
    expect(result.matchIndex).toBe(10);
    expect(follower.getState().lastSnapshotIndex).toBe(10);
    expect(follower.getState().hasSnapshot).toBe(true);

    const snap = follower.getSnapshot();
    expect(snap.state).toEqual(snapshotState);

    follower.stop();
  });

  test("installSnapshot rejects stale term", async () => {
    const leaderKeys = generateKeyPair();
    const follower = new ClusterConsensusEngine({
      nodeId: "node-b",
      clusterNodes: ["node-a", "node-b", "node-c"],
      peerPublicKeys: new Map([["node-a", leaderKeys.publicKey]]),
      requireRpcSigning: true,
      replayWindowMs: 60000,
    });
    follower.start();
    // Advance follower's term beyond leader's via direct appendEntries with higher term
    const aePayload = {
      term: 5,
      leaderId: "node-a",
      entries: [],
      leaderCommit: 0,
      nonce: 1,
      timestamp: Date.now(),
    };
    follower.appendEntries({
      ...aePayload,
      signature: signPayload(aePayload, leaderKeys.privateKey),
    });
    expect(follower.getState().term).toBe(5);

    const payload = {
      term: 1,
      leaderId: "node-a",
      lastIncludedIndex: 10,
      lastIncludedTerm: 1,
      state: {},
      nonce: 2,
      timestamp: Date.now(),
    };
    const sig = signPayload(payload, leaderKeys.privateKey);
    const result = follower.installSnapshot({ ...payload, signature: sig });
    expect(result.success).toBe(false);

    follower.stop();
  });

  test("installSnapshot rejects older snapshot", async () => {
    const leaderKeys = generateKeyPair();
    const follower = new ClusterConsensusEngine({
      nodeId: "node-b",
      clusterNodes: ["node-a", "node-b", "node-c"],
      peerPublicKeys: new Map([["node-a", leaderKeys.publicKey]]),
      requireRpcSigning: true,
      replayWindowMs: 60000,
    });
    follower.start();

    // First install a snapshot at index 20
    const payload1 = {
      term: 1,
      leaderId: "node-a",
      lastIncludedIndex: 20,
      lastIncludedTerm: 1,
      state: { v: 1 },
      nonce: 1,
      timestamp: Date.now(),
    };
    follower.installSnapshot({
      ...payload1,
      signature: signPayload(payload1, leaderKeys.privateKey),
    });
    expect(follower.getState().lastSnapshotIndex).toBe(20);

    // Try to install an older snapshot at index 10
    const payload2 = {
      term: 1,
      leaderId: "node-a",
      lastIncludedIndex: 10,
      lastIncludedTerm: 1,
      state: { v: 2 },
      nonce: 2,
      timestamp: Date.now(),
    };
    const result = follower.installSnapshot({
      ...payload2,
      signature: signPayload(payload2, leaderKeys.privateKey),
    });
    expect(result.success).toBe(false);
    expect(result.reason).toBe("snapshot_older");
    expect(follower.getState().lastSnapshotIndex).toBe(20);

    follower.stop();
  });

  test("installSnapshot rejects invalid signature", async () => {
    const leaderKeys = generateKeyPair();
    const attackerKeys = generateKeyPair();
    const follower = new ClusterConsensusEngine({
      nodeId: "node-b",
      clusterNodes: ["node-a", "node-b", "node-c"],
      peerPublicKeys: new Map([["node-a", leaderKeys.publicKey]]),
      requireRpcSigning: true,
      replayWindowMs: 60000,
    });
    follower.start();

    const payload = {
      term: 1,
      leaderId: "node-a",
      lastIncludedIndex: 10,
      lastIncludedTerm: 1,
      state: {},
      nonce: 1,
      timestamp: Date.now(),
    };
    // Sign with attacker's key
    const sig = signPayload(payload, attackerKeys.privateKey);
    const result = follower.installSnapshot({ ...payload, signature: sig });
    expect(result.success).toBe(false);
    expect(result.reason).toBe("signature_invalid");

    follower.stop();
  });

  test("installSnapshot rejects missing inputs", () => {
    const follower = new ClusterConsensusEngine({
      nodeId: "node-b",
      clusterNodes: ["node-a", "node-b", "node-c"],
    });
    expect(() => follower.installSnapshot({})).toThrow(HsmAdapterError);
    expect(() =>
      follower.installSnapshot({ term: 1, leaderId: "node-a" }),
    ).toThrow(HsmAdapterError);
  });

  test("installSnapshot rejects unknown leader", () => {
    const follower = new ClusterConsensusEngine({
      nodeId: "node-b",
      clusterNodes: ["node-a", "node-b", "node-c"],
    });
    expect(() =>
      follower.installSnapshot({
        term: 1,
        leaderId: "node-z",
        lastIncludedIndex: 10,
        lastIncludedTerm: 1,
      }),
    ).toThrow(HsmAdapterError);
  });

  test("installSnapshot restores state via callback", async () => {
    const leaderKeys = generateKeyPair();
    let restoredState = null;
    const follower = new ClusterConsensusEngine({
      nodeId: "node-b",
      clusterNodes: ["node-a", "node-b", "node-c"],
      peerPublicKeys: new Map([["node-a", leaderKeys.publicKey]]),
      requireRpcSigning: true,
      replayWindowMs: 60000,
      restoreSnapshotState: (state) => {
        restoredState = state;
      },
    });
    follower.start();

    const snapshotState = { restored: true };
    const payload = {
      term: 1,
      leaderId: "node-a",
      lastIncludedIndex: 5,
      lastIncludedTerm: 1,
      state: snapshotState,
      nonce: 1,
      timestamp: Date.now(),
    };
    follower.installSnapshot({
      ...payload,
      signature: signPayload(payload, leaderKeys.privateKey),
    });
    expect(restoredState).toEqual(snapshotState);

    follower.stop();
  });

  test("installSnapshot keeps compatible log entries after snapshot point", async () => {
    const leaderKeys = generateKeyPair();
    const follower = new ClusterConsensusEngine({
      nodeId: "node-b",
      clusterNodes: ["node-a", "node-b", "node-c"],
      peerPublicKeys: new Map([["node-a", leaderKeys.publicKey]]),
      requireRpcSigning: true,
      replayWindowMs: 60000,
    });
    follower.start();

    // Follower has entries at indices 1-15
    for (let i = 0; i < 15; i++) {
      follower._log.push({
        term: 1,
        index: i + 1,
        command: { seq: i },
        committed: false,
      });
    }

    // Install snapshot at index 10 — entries 11-15 should be preserved
    const payload = {
      term: 1,
      leaderId: "node-a",
      lastIncludedIndex: 10,
      lastIncludedTerm: 1,
      state: {},
      nonce: 1,
      timestamp: Date.now(),
    };
    const result = follower.installSnapshot({
      ...payload,
      signature: signPayload(payload, leaderKeys.privateKey),
    });
    expect(result.success).toBe(true);
    expect(follower.getState().logLength).toBe(5);
    expect(follower.getState().lastSnapshotIndex).toBe(10);

    follower.stop();
  });
});

describe("Track 34 Phase 6 snapshotting — getSnapshot", () => {
  test("getSnapshot returns null when no snapshot exists", () => {
    const engine = new ClusterConsensusEngine({
      nodeId: "node-a",
      clusterNodes: ["node-a", "node-b"],
    });
    expect(engine.getSnapshot()).toBeNull();
  });

  test("getSnapshot returns snapshot data after createSnapshot", async () => {
    const engine = new ClusterConsensusEngine({
      nodeId: "node-a",
      clusterNodes: ["node-a", "node-b", "node-c"],
      captureSnapshotState: () => ({ data: "test" }),
    });
    engine.start();
    await engine.startElection();
    await engine.appendAndReplicate({ operation: "test" });
    engine.createSnapshot();

    const snap = engine.getSnapshot();
    expect(snap).not.toBeNull();
    expect(snap.lastIncludedIndex).toBe(1);
    expect(snap.state).toEqual({ data: "test" });

    engine.stop();
  });
});

describe("Track 34 Phase 6 snapshotting — audit events", () => {
  test("SNAPSHOT_CREATED event emitted on createSnapshot", async () => {
    const events = [];
    const engine = new ClusterConsensusEngine({
      nodeId: "node-a",
      clusterNodes: ["node-a", "node-b", "node-c"],
      captureSnapshotState: () => ({}),
      audit: (event, info) => events.push({ event, info }),
    });
    engine.start();
    await engine.startElection();
    await engine.appendAndReplicate({ operation: "test" });
    engine.createSnapshot();

    expect(
      events.some((e) => e.event === CONSENSUS_EVENT.SNAPSHOT_CREATED),
    ).toBe(true);
    engine.stop();
  });

  test("SNAPSHOT_INSTALLED event emitted on installSnapshot", async () => {
    const leaderKeys = generateKeyPair();
    const events = [];
    const follower = new ClusterConsensusEngine({
      nodeId: "node-b",
      clusterNodes: ["node-a", "node-b", "node-c"],
      peerPublicKeys: new Map([["node-a", leaderKeys.publicKey]]),
      requireRpcSigning: true,
      replayWindowMs: 60000,
      audit: (event, info) => events.push({ event, info }),
    });
    follower.start();

    const payload = {
      term: 1,
      leaderId: "node-a",
      lastIncludedIndex: 5,
      lastIncludedTerm: 1,
      state: {},
      nonce: 1,
      timestamp: Date.now(),
    };
    follower.installSnapshot({
      ...payload,
      signature: signPayload(payload, leaderKeys.privateKey),
    });
    expect(
      events.some((e) => e.event === CONSENSUS_EVENT.SNAPSHOT_INSTALLED),
    ).toBe(true);
    follower.stop();
  });

  test("SNAPSHOT_REJECTED event emitted on rejected snapshot", async () => {
    const leaderKeys = generateKeyPair();
    const events = [];
    const follower = new ClusterConsensusEngine({
      nodeId: "node-b",
      clusterNodes: ["node-a", "node-b", "node-c"],
      peerPublicKeys: new Map([["node-a", leaderKeys.publicKey]]),
      requireRpcSigning: true,
      replayWindowMs: 60000,
      audit: (event, info) => events.push({ event, info }),
    });
    follower.start();

    // Install at index 20 first
    const p1 = {
      term: 1,
      leaderId: "node-a",
      lastIncludedIndex: 20,
      lastIncludedTerm: 1,
      state: {},
      nonce: 1,
      timestamp: Date.now(),
    };
    follower.installSnapshot({
      ...p1,
      signature: signPayload(p1, leaderKeys.privateKey),
    });

    // Try older snapshot
    const p2 = {
      term: 1,
      leaderId: "node-a",
      lastIncludedIndex: 10,
      lastIncludedTerm: 1,
      state: {},
      nonce: 2,
      timestamp: Date.now(),
    };
    follower.installSnapshot({
      ...p2,
      signature: signPayload(p2, leaderKeys.privateKey),
    });

    expect(
      events.some((e) => e.event === CONSENSUS_EVENT.SNAPSHOT_REJECTED),
    ).toBe(true);
    follower.stop();
  });
});

describe("Track 34 Phase 6 snapshotting — Prometheus metrics", () => {
  test("createSnapshot increments hsm_consensus_snapshot_created_total", async () => {
    const metrics = require("../hsm-metrics.cjs");
    metrics.reset();
    const engine = new ClusterConsensusEngine({
      nodeId: "node-a",
      clusterNodes: ["node-a", "node-b", "node-c"],
      captureSnapshotState: () => ({}),
    });
    engine.start();
    await engine.startElection();
    await engine.appendAndReplicate({ operation: "test" });
    engine.createSnapshot();

    const m = metrics.getMetrics();
    expect(m.hsm_consensus_snapshot_created_total).toBeGreaterThan(0);
    engine.stop();
  });

  test("installSnapshot increments hsm_consensus_snapshot_installed_total", async () => {
    const metrics = require("../hsm-metrics.cjs");
    metrics.reset();
    const leaderKeys = generateKeyPair();
    const follower = new ClusterConsensusEngine({
      nodeId: "node-b",
      clusterNodes: ["node-a", "node-b", "node-c"],
      peerPublicKeys: new Map([["node-a", leaderKeys.publicKey]]),
      requireRpcSigning: true,
      replayWindowMs: 60000,
    });
    follower.start();

    const payload = {
      term: 1,
      leaderId: "node-a",
      lastIncludedIndex: 5,
      lastIncludedTerm: 1,
      state: {},
      nonce: 1,
      timestamp: Date.now(),
    };
    follower.installSnapshot({
      ...payload,
      signature: signPayload(payload, leaderKeys.privateKey),
    });

    const m = metrics.getMetrics();
    expect(m.hsm_consensus_snapshot_installed_total).toBeGreaterThan(0);
    follower.stop();
  });

  test("rejected snapshot increments hsm_consensus_snapshot_rejected_total", async () => {
    const metrics = require("../hsm-metrics.cjs");
    metrics.reset();
    const leaderKeys = generateKeyPair();
    const attackerKeys = generateKeyPair();
    const follower = new ClusterConsensusEngine({
      nodeId: "node-b",
      clusterNodes: ["node-a", "node-b", "node-c"],
      peerPublicKeys: new Map([["node-a", leaderKeys.publicKey]]),
      requireRpcSigning: true,
      replayWindowMs: 60000,
    });
    follower.start();

    const payload = {
      term: 1,
      leaderId: "node-a",
      lastIncludedIndex: 5,
      lastIncludedTerm: 1,
      state: {},
      nonce: 1,
      timestamp: Date.now(),
    };
    // Sign with wrong key
    follower.installSnapshot({
      ...payload,
      signature: signPayload(payload, attackerKeys.privateKey),
    });

    const m = metrics.getMetrics();
    expect(m.hsm_consensus_snapshot_rejected_total).toBeGreaterThan(0);
    follower.stop();
  });
});

describe("Track 34 Phase 6 snapshotting — policy validation", () => {
  test("validates enableSnapshotCompaction policy", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "consensus", {
        enableSnapshotCompaction: true,
      }),
    ).not.toThrow();
  });

  test("tenant with enableSnapshotCompaction blocks disabling", () => {
    const engine = new CryptoPolicyEngine({
      default: {},
      tenants: {
        "t-strict": {
          consensus: { enableSnapshotCompaction: true },
        },
      },
    });
    expect(() =>
      engine.validate("t-strict", "consensus", {
        enableSnapshotCompaction: false,
      }),
    ).toThrow(HsmAdapterError);
  });

  test("validates snapshotThreshold below minimum", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "consensus", {
        snapshotThreshold: 5, // default min is 10
      }),
    ).toThrow(HsmAdapterError);
  });

  test("validates snapshotThreshold above maximum", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "consensus", {
        snapshotThreshold: 50000, // default max is 10000
      }),
    ).toThrow(HsmAdapterError);
  });

  test("validates snapshotThreshold within bounds", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "consensus", {
        snapshotThreshold: 100,
      }),
    ).not.toThrow();
  });

  test("tenant can tighten snapshot threshold bounds", () => {
    const engine = new CryptoPolicyEngine({
      default: {},
      tenants: {
        "t-tight": {
          consensus: { snapshotThresholdMin: 50, snapshotThresholdMax: 500 },
        },
      },
    });
    // Below tenant min
    expect(() =>
      engine.validate("t-tight", "consensus", {
        snapshotThreshold: 30,
      }),
    ).toThrow(HsmAdapterError);
    // Above tenant max
    expect(() =>
      engine.validate("t-tight", "consensus", {
        snapshotThreshold: 600,
      }),
    ).toThrow(HsmAdapterError);
    // Within bounds
    expect(() =>
      engine.validate("t-tight", "consensus", {
        snapshotThreshold: 100,
      }),
    ).not.toThrow();
  });
});

describe("Track 34 Phase 6 snapshotting — end-to-end compaction flow", () => {
  test("leader compacts, continues appending, follower catches up via snapshot", async () => {
    const leaderKeys = generateKeyPair();
    let leaderCounter = 0;
    const leader = new ClusterConsensusEngine({
      nodeId: "node-a",
      clusterNodes: ["node-a", "node-b", "node-c"],
      signingKeyPair: {
        privateKey: leaderKeys.privateKey,
        publicKey: leaderKeys.publicKey,
      },
      captureSnapshotState: () => ({ counter: leaderCounter }),
      snapshotThreshold: 5,
    });
    leader.start();
    await leader.startElection();

    // Append 5 entries and compact
    for (let i = 0; i < 5; i++) {
      leaderCounter++;
      await leader.appendAndReplicate({ operation: "increment" });
    }
    const snapResult = leader.createSnapshot();
    expect(snapResult.lastSnapshotIndex).toBe(5);

    // Continue appending after compaction
    leaderCounter++;
    const postResult = await leader.appendAndReplicate({
      operation: "increment",
    });
    expect(postResult.index).toBe(6);

    // Follower receives snapshot
    const follower = new ClusterConsensusEngine({
      nodeId: "node-b",
      clusterNodes: ["node-a", "node-b", "node-c"],
      peerPublicKeys: new Map([["node-a", leaderKeys.publicKey]]),
      requireRpcSigning: true,
      replayWindowMs: 60000,
      restoreSnapshotState: (state) => {
        leaderCounter = state.counter;
      },
    });
    follower.start();

    const snap = leader.getSnapshot();
    const payload = {
      term: leader.getState().term,
      leaderId: "node-a",
      lastIncludedIndex: snap.lastIncludedIndex,
      lastIncludedTerm: snap.lastIncludedTerm,
      state: snap.state,
      nonce: 1,
      timestamp: Date.now(),
    };
    const installResult = follower.installSnapshot({
      ...payload,
      signature: signPayload(payload, leaderKeys.privateKey),
    });
    expect(installResult.success).toBe(true);
    expect(follower.getState().lastSnapshotIndex).toBe(5);

    // Follower should now accept appendEntries for entry 6
    const aePayload = {
      term: leader.getState().term,
      leaderId: "node-a",
      entries: [
        {
          term: leader.getState().term,
          index: 6,
          command: { operation: "increment" },
        },
      ],
      leaderCommit: 6,
      nonce: 2,
      timestamp: Date.now(),
    };
    const aeResult = follower.appendEntries({
      ...aePayload,
      signature: signPayload(aePayload, leaderKeys.privateKey),
    });
    expect(aeResult.success).toBe(true);
    expect(follower.getState().logLength).toBe(1);

    leader.stop();
    follower.stop();
  });
});
