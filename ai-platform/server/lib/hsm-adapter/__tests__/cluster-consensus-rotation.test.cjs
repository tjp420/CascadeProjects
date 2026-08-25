"use strict";

/**
 * Track 34 Phase 5: Peer key rotation tests.
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

describe("Track 34 Phase 5 peer key rotation — addPeerKey", () => {
  test("leader can add a new peer key via quorum-gated consensus", async () => {
    const events = [];
    const consensus = new ClusterConsensusEngine({
      nodeId: "node-a",
      clusterNodes: ["node-a", "node-b", "node-c"],
      audit: (event, info) => events.push({ event, info }),
    });
    consensus.start();
    await consensus.startElection();
    expect(consensus.getState().state).toBe(NODE_STATE.LEADER);

    const newKeys = generateKeyPair();
    const result = await consensus.addPeerKey("node-d", newKeys.publicKey);
    expect(result.committed).toBe(true);
    expect(consensus.hasPeerKey("node-d")).toBe(true);
    expect(events.some((e) => e.event === CONSENSUS_EVENT.PEER_KEY_ADDED)).toBe(
      true,
    );

    consensus.stop();
  });

  test("follower cannot add a peer key", async () => {
    const events = [];
    const consensus = new ClusterConsensusEngine({
      nodeId: "node-b",
      clusterNodes: ["node-a", "node-b", "node-c"],
      audit: (event, info) => events.push({ event, info }),
    });
    consensus.start();
    // node-b is follower — no election

    const newKeys = generateKeyPair();
    await expect(
      consensus.addPeerKey("node-d", newKeys.publicKey),
    ).rejects.toThrow(HsmAdapterError);
    await expect(
      consensus.addPeerKey("node-d", newKeys.publicKey),
    ).rejects.toThrow("not leader");
    expect(
      events.some((e) => e.event === CONSENSUS_EVENT.PEER_KEY_ROTATION_BLOCKED),
    ).toBe(true);
    expect(consensus.hasPeerKey("node-d")).toBe(false);

    consensus.stop();
  });

  test("addPeerKey rejects invalid inputs", async () => {
    const consensus = new ClusterConsensusEngine({
      nodeId: "node-a",
      clusterNodes: ["node-a", "node-b"],
    });
    consensus.start();
    await consensus.startElection();

    await expect(
      consensus.addPeerKey("", generateKeyPair().publicKey),
    ).rejects.toThrow(HsmAdapterError);
    await expect(consensus.addPeerKey("node-d", null)).rejects.toThrow(
      HsmAdapterError,
    );

    consensus.stop();
  });

  test("addPeerKey updates existing key (rotation)", async () => {
    const oldKeys = generateKeyPair();
    const consensus = new ClusterConsensusEngine({
      nodeId: "node-a",
      clusterNodes: ["node-a", "node-b", "node-c"],
      peerPublicKeys: new Map([["node-b", oldKeys.publicKey]]),
    });
    consensus.start();
    await consensus.startElection();

    expect(consensus.hasPeerKey("node-b")).toBe(true);

    // Rotate node-b's key
    const newKeys = generateKeyPair();
    const result = await consensus.addPeerKey("node-b", newKeys.publicKey);
    expect(result.committed).toBe(true);
    expect(consensus.hasPeerKey("node-b")).toBe(true);

    // Old key should no longer verify, new key should
    const payload = {
      term: 1,
      candidateId: "node-b",
      nonce: 1,
      timestamp: Date.now(),
    };
    const oldSig = signPayload(payload, oldKeys.privateKey);
    expect(consensus.verifyRpcFrame(payload, "node-b", oldSig)).toBe(false);

    const newSig = signPayload(payload, newKeys.privateKey);
    expect(consensus.verifyRpcFrame(payload, "node-b", newSig)).toBe(true);

    consensus.stop();
  });
});

describe("Track 34 Phase 5 peer key rotation — revokePeerKey", () => {
  test("leader can revoke a peer key via quorum-gated consensus", async () => {
    const events = [];
    const peerKeys = generateKeyPair();
    const consensus = new ClusterConsensusEngine({
      nodeId: "node-a",
      clusterNodes: ["node-a", "node-b", "node-c"],
      peerPublicKeys: new Map([["node-b", peerKeys.publicKey]]),
      audit: (event, info) => events.push({ event, info }),
    });
    consensus.start();
    await consensus.startElection();

    expect(consensus.hasPeerKey("node-b")).toBe(true);

    const result = await consensus.revokePeerKey("node-b");
    expect(result.committed).toBe(true);
    expect(consensus.hasPeerKey("node-b")).toBe(false);
    expect(
      events.some((e) => e.event === CONSENSUS_EVENT.PEER_KEY_REVOKED),
    ).toBe(true);

    consensus.stop();
  });

  test("follower cannot revoke a peer key", async () => {
    const events = [];
    const peerKeys = generateKeyPair();
    const consensus = new ClusterConsensusEngine({
      nodeId: "node-b",
      clusterNodes: ["node-a", "node-b", "node-c"],
      peerPublicKeys: new Map([["node-a", peerKeys.publicKey]]),
      audit: (event, info) => events.push({ event, info }),
    });
    consensus.start();

    await expect(consensus.revokePeerKey("node-a")).rejects.toThrow(
      HsmAdapterError,
    );
    await expect(consensus.revokePeerKey("node-a")).rejects.toThrow(
      "not leader",
    );
    expect(
      events.some((e) => e.event === CONSENSUS_EVENT.PEER_KEY_ROTATION_BLOCKED),
    ).toBe(true);
    expect(consensus.hasPeerKey("node-a")).toBe(true);

    consensus.stop();
  });

  test("revokePeerKey rejects unknown peer", async () => {
    const events = [];
    const consensus = new ClusterConsensusEngine({
      nodeId: "node-a",
      clusterNodes: ["node-a", "node-b", "node-c"],
      audit: (event, info) => events.push({ event, info }),
    });
    consensus.start();
    await consensus.startElection();

    await expect(consensus.revokePeerKey("node-z")).rejects.toThrow(
      HsmAdapterError,
    );
    expect(
      events.some((e) => e.event === CONSENSUS_EVENT.PEER_KEY_ROTATION_BLOCKED),
    ).toBe(true);

    consensus.stop();
  });

  test("revokePeerKey rejects invalid inputs", async () => {
    const consensus = new ClusterConsensusEngine({
      nodeId: "node-a",
      clusterNodes: ["node-a", "node-b"],
    });
    consensus.start();
    await consensus.startElection();

    await expect(consensus.revokePeerKey("")).rejects.toThrow(HsmAdapterError);

    consensus.stop();
  });

  test("revoked peer RPCs are rejected after revocation", async () => {
    const peerKeys = generateKeyPair();
    const consensus = new ClusterConsensusEngine({
      nodeId: "node-a",
      clusterNodes: ["node-a", "node-b", "node-c"],
      peerPublicKeys: new Map([["node-b", peerKeys.publicKey]]),
      requireRpcSigning: true,
      replayWindowMs: 60000,
    });
    consensus.start();
    await consensus.startElection();

    // node-b's RPCs should work before revocation
    const payload = {
      term: 1,
      candidateId: "node-b",
      nonce: 1,
      timestamp: Date.now(),
    };
    const sig = signPayload(payload, peerKeys.privateKey);
    expect(consensus.verifyRpcFrame(payload, "node-b", sig)).toBe(true);

    // Revoke
    await consensus.revokePeerKey("node-b");

    // Now node-b's RPCs should fail
    const payload2 = {
      term: 1,
      candidateId: "node-b",
      nonce: 2,
      timestamp: Date.now(),
    };
    const sig2 = signPayload(payload2, peerKeys.privateKey);
    expect(consensus.verifyRpcFrame(payload2, "node-b", sig2)).toBe(false);

    consensus.stop();
  });
});

describe("Track 34 Phase 5 peer key rotation — registry helpers", () => {
  test("getRegisteredPeers returns list of registered peer IDs", async () => {
    const keysB = generateKeyPair();
    const keysC = generateKeyPair();
    const consensus = new ClusterConsensusEngine({
      nodeId: "node-a",
      clusterNodes: ["node-a", "node-b", "node-c"],
      peerPublicKeys: new Map([
        ["node-b", keysB.publicKey],
        ["node-c", keysC.publicKey],
      ]),
    });
    consensus.start();
    await consensus.startElection();

    const peers = consensus.getRegisteredPeers();
    expect(peers).toContain("node-b");
    expect(peers).toContain("node-c");
    expect(peers.length).toBe(2);

    consensus.stop();
  });

  test("hasPeerKey returns false for unregistered peer", () => {
    const consensus = new ClusterConsensusEngine({
      nodeId: "node-a",
      clusterNodes: ["node-a", "node-b"],
    });
    expect(consensus.hasPeerKey("node-b")).toBe(false);
  });
});

describe("Track 34 Phase 5 peer key rotation — command application", () => {
  test("_applyConsensusCommand applies addPeerKey from committed log entry", () => {
    const consensus = new ClusterConsensusEngine({
      nodeId: "node-b",
      clusterNodes: ["node-a", "node-b", "node-c"],
    });
    const newKey = generateKeyPair().publicKey;
    // Simulate a committed log entry from leader
    consensus._log = [
      {
        term: 1,
        index: 1,
        command: {
          operation: "addPeerKey",
          nodeId: "node-d",
          publicKey: newKey,
        },
        committed: false,
      },
    ];
    consensus._commitIndex = 1;
    consensus._applyCommittedEntries();

    expect(consensus.hasPeerKey("node-d")).toBe(true);
  });

  test("_applyConsensusCommand applies revokePeerKey from committed log entry", () => {
    const peerKeys = generateKeyPair();
    const consensus = new ClusterConsensusEngine({
      nodeId: "node-b",
      clusterNodes: ["node-a", "node-b", "node-c"],
      peerPublicKeys: new Map([["node-a", peerKeys.publicKey]]),
    });
    consensus._log = [
      {
        term: 1,
        index: 1,
        command: { operation: "revokePeerKey", nodeId: "node-a" },
        committed: false,
      },
    ];
    consensus._commitIndex = 1;
    consensus._applyCommittedEntries();

    expect(consensus.hasPeerKey("node-a")).toBe(false);
  });

  test("_applyConsensusCommand ignores non-rotation commands", () => {
    const consensus = new ClusterConsensusEngine({
      nodeId: "node-b",
      clusterNodes: ["node-a", "node-b", "node-c"],
    });
    consensus._log = [
      {
        term: 1,
        index: 1,
        command: { operation: "createKEK", tenantId: "t1" },
        committed: false,
      },
    ];
    consensus._commitIndex = 1;
    expect(() => consensus._applyCommittedEntries()).not.toThrow();
  });
});

describe("Track 34 Phase 5 peer key rotation — Prometheus metrics", () => {
  test("addPeerKey increments hsm_consensus_peer_key_added_total", async () => {
    const metrics = require("../hsm-metrics.cjs");
    metrics.reset();
    const consensus = new ClusterConsensusEngine({
      nodeId: "node-a",
      clusterNodes: ["node-a", "node-b", "node-c"],
    });
    consensus.start();
    await consensus.startElection();
    await consensus.addPeerKey("node-d", generateKeyPair().publicKey);

    const m = metrics.getMetrics();
    expect(m.hsm_consensus_peer_key_added_total).toBeGreaterThan(0);

    consensus.stop();
  });

  test("revokePeerKey increments hsm_consensus_peer_key_revoked_total", async () => {
    const metrics = require("../hsm-metrics.cjs");
    metrics.reset();
    const peerKeys = generateKeyPair();
    const consensus = new ClusterConsensusEngine({
      nodeId: "node-a",
      clusterNodes: ["node-a", "node-b", "node-c"],
      peerPublicKeys: new Map([["node-b", peerKeys.publicKey]]),
    });
    consensus.start();
    await consensus.startElection();
    await consensus.revokePeerKey("node-b");

    const m = metrics.getMetrics();
    expect(m.hsm_consensus_peer_key_revoked_total).toBeGreaterThan(0);

    consensus.stop();
  });

  test("blocked rotation increments hsm_consensus_peer_key_rotation_blocked_total", async () => {
    const metrics = require("../hsm-metrics.cjs");
    metrics.reset();
    const consensus = new ClusterConsensusEngine({
      nodeId: "node-b",
      clusterNodes: ["node-a", "node-b", "node-c"],
    });
    consensus.start();
    // node-b is follower
    try {
      await consensus.addPeerKey("node-d", generateKeyPair().publicKey);
    } catch {}

    const m = metrics.getMetrics();
    expect(m.hsm_consensus_peer_key_rotation_blocked_total).toBeGreaterThan(0);

    consensus.stop();
  });
});

describe("Track 34 Phase 5 peer key rotation — policy validation", () => {
  test("validates enablePeerKeyRotation policy", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "consensus", {
        enablePeerKeyRotation: true,
      }),
    ).not.toThrow();
  });

  test("tenant with enablePeerKeyRotation blocks disabling", () => {
    const engine = new CryptoPolicyEngine({
      default: {},
      tenants: {
        "t-strict": {
          consensus: { enablePeerKeyRotation: true },
        },
      },
    });
    expect(() =>
      engine.validate("t-strict", "consensus", {
        enablePeerKeyRotation: false,
      }),
    ).toThrow(HsmAdapterError);
  });

  test("validates maxPeerKeyRotationRateMs lower bound", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "consensus", {
        maxPeerKeyRotationRateMs: 100, // below default 1000
      }),
    ).toThrow(HsmAdapterError);
  });

  test("validates maxPeerKeyRotationRateMs at policy minimum", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "consensus", {
        maxPeerKeyRotationRateMs: 1000,
      }),
    ).not.toThrow();
  });

  test("tenant can tighten rotation rate", () => {
    const engine = new CryptoPolicyEngine({
      default: {},
      tenants: {
        "t-tight": {
          consensus: { maxPeerKeyRotationRateMs: 5000 },
        },
      },
    });
    // 3000ms is below tenant's 5000 minimum, should fail
    expect(() =>
      engine.validate("t-tight", "consensus", {
        maxPeerKeyRotationRateMs: 3000,
      }),
    ).toThrow(HsmAdapterError);
    // 5000ms is at tenant minimum, should pass
    expect(() =>
      engine.validate("t-tight", "consensus", {
        maxPeerKeyRotationRateMs: 5000,
      }),
    ).not.toThrow();
  });
});
