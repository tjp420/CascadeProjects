"use strict";

/**
 * Tests for GET /api/vault/consensus/status — Consensus telemetry endpoint.
 *
 * Verifies that the route:
 *   1. Returns 200 with JSON consensus state and counters
 *   2. Includes all expected consensus counter names
 *   3. Returns engine state when an engine is registered
 *   4. Returns null engine when no engine is registered
 *   5. Requires admin:all authorization
 *   6. Returns 403 for non-admin users
 */

const express = require("express");
const request = require("supertest");

// Mock authorize so we can control admin access
jest.mock("../../middleware/authorize.cjs", () => ({
  authorize: function (permission) {
    return function mockAuthorize(req, res, next) {
      const perms = (req.user && req.user.permissions) || [];
      if (perms.includes(permission)) {
        return next();
      }
      return res.status(403).json({
        success: false,
        error: "insufficient_permissions",
        required: permission,
      });
    };
  },
}));

// Mock admin-throttle to pass through
jest.mock("../../lib/admin-throttle.cjs", () => ({
  middleware: function (req, res, next) {
    next();
  },
}));

// Mock hsm-vault to avoid requiring real HSM infrastructure
jest.mock("../../lib/hsm-vault.cjs", () => ({
  deriveWithFailover: jest.fn().mockResolvedValue(Buffer.alloc(32)),
  getHsmVersions: jest
    .fn()
    .mockReturnValue({ primary: "test", secondary: "test" }),
}));

const hsmMetrics = require("../../lib/hsm-adapter/hsm-metrics.cjs");
const baseAdapter = require("../../lib/hsm-adapter/base-adapter.cjs");

function buildApp(user) {
  const app = express();
  const router = require("../../routes/hsm-vault-routes.cjs");
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  app.use("/api/vault", router);
  return app;
}

describe("GET /api/vault/consensus/status", () => {
  beforeEach(() => {
    hsmMetrics.reset();
    // Clear any registered engine
    baseAdapter.registerConsensusEngine(null);
  });

  afterEach(() => {
    baseAdapter.registerConsensusEngine(null);
  });

  test("returns 200 with JSON consensus state for admin", async () => {
    const app = buildApp({
      id: "admin1",
      role: "admin",
      permissions: ["admin:all"],
    });

    const res = await request(app).get("/api/vault/consensus/status");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.timestamp).toBe("number");
    expect(res.body.engine).toBeNull();
    expect(typeof res.body.counters).toBe("object");
  });

  test("includes all expected consensus counter names", async () => {
    const app = buildApp({
      id: "admin1",
      role: "admin",
      permissions: ["admin:all"],
    });

    // Increment some counters to have non-zero values
    hsmMetrics.incrementCounter("hsm_consensus_leader_elections_total", 3);
    hsmMetrics.incrementCounter("hsm_consensus_log_committed_total", 5);
    hsmMetrics.incrementCounter("hsm_consensus_snapshot_created_total", 2);
    hsmMetrics.incrementCounter("hsm_consensus_outbound_signed_total", 10);

    const res = await request(app).get("/api/vault/consensus/status");

    const expectedCounters = [
      "hsm_consensus_leader_elections_total",
      "hsm_consensus_leader_elections_won_total",
      "hsm_consensus_quorum_lost_total",
      "hsm_consensus_log_replicated_total",
      "hsm_consensus_log_committed_total",
      "hsm_consensus_heartbeats_sent_total",
      "hsm_consensus_rpc_signed_total",
      "hsm_consensus_rpc_verified_total",
      "hsm_consensus_signature_invalid_total",
      "hsm_consensus_peer_key_unknown_total",
      "hsm_consensus_replay_detected_total",
      "hsm_consensus_nonce_stale_total",
      "hsm_consensus_timestamp_expired_total",
      "hsm_consensus_peer_key_added_total",
      "hsm_consensus_peer_key_revoked_total",
      "hsm_consensus_peer_key_rotation_blocked_total",
      "hsm_consensus_snapshot_created_total",
      "hsm_consensus_snapshot_installed_total",
      "hsm_consensus_snapshot_rejected_total",
      "hsm_consensus_outbound_signed_total",
      "hsm_consensus_outbound_sign_failed_total",
    ];

    for (const name of expectedCounters) {
      expect(res.body.counters).toHaveProperty(name);
      expect(typeof res.body.counters[name]).toBe("number");
    }

    // Verify specific incremented values
    expect(res.body.counters.hsm_consensus_leader_elections_total).toBe(3);
    expect(res.body.counters.hsm_consensus_log_committed_total).toBe(5);
    expect(res.body.counters.hsm_consensus_snapshot_created_total).toBe(2);
    expect(res.body.counters.hsm_consensus_outbound_signed_total).toBe(10);
  });

  test("returns engine state when consensus engine is registered", async () => {
    // Create a mock engine with getState
    const mockEngine = {
      nodeId: "node-a",
      getState: () => ({
        nodeId: "node-a",
        state: "LEADER",
        term: 5,
        leaderId: "node-a",
        votedFor: "node-a",
        votesReceived: ["node-a", "node-b", "node-c"],
        commitIndex: 42,
        lastAppliedIndex: 42,
        logLength: 3,
        quorumNodes: 3,
        clusterSize: 3,
        lastSnapshotIndex: 10,
        lastSnapshotTerm: 3,
        hasSnapshot: true,
      }),
    };

    baseAdapter.registerConsensusEngine(mockEngine);

    const app = buildApp({
      id: "admin1",
      role: "admin",
      permissions: ["admin:all"],
    });
    const res = await request(app).get("/api/vault/consensus/status");

    expect(res.status).toBe(200);
    expect(res.body.engine).not.toBeNull();
    expect(res.body.engine.nodeId).toBe("node-a");
    expect(res.body.engine.state).toBe("LEADER");
    expect(res.body.engine.term).toBe(5);
    expect(res.body.engine.commitIndex).toBe(42);
    expect(res.body.engine.clusterSize).toBe(3);
    expect(res.body.engine.hasSnapshot).toBe(true);
    expect(res.body.engine.lastSnapshotIndex).toBe(10);
  });

  test("returns null engine when no engine is registered", async () => {
    const app = buildApp({
      id: "admin1",
      role: "admin",
      permissions: ["admin:all"],
    });
    const res = await request(app).get("/api/vault/consensus/status");

    expect(res.status).toBe(200);
    expect(res.body.engine).toBeNull();
  });

  test("returns 403 for non-admin users", async () => {
    const app = buildApp({ id: "user1", role: "viewer", permissions: [] });
    const res = await request(app).get("/api/vault/consensus/status");

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("insufficient_permissions");
  });

  test("returns 403 without user context", async () => {
    const app = buildApp(null);
    const res = await request(app).get("/api/vault/consensus/status");

    expect(res.status).toBe(403);
  });

  test("counters only include hsm_consensus_ prefixed keys", async () => {
    const app = buildApp({
      id: "admin1",
      role: "admin",
      permissions: ["admin:all"],
    });

    // Increment non-consensus counters
    hsmMetrics.incrementCounter("hsm_wrap_total", 10);
    hsmMetrics.incrementCounter("hsm_unwrap_total", 5);
    // Increment consensus counters
    hsmMetrics.incrementCounter("hsm_consensus_heartbeats_sent_total", 7);

    const res = await request(app).get("/api/vault/consensus/status");

    expect(res.body.counters).not.toHaveProperty("hsm_wrap_total");
    expect(res.body.counters).not.toHaveProperty("hsm_unwrap_total");
    expect(res.body.counters).toHaveProperty(
      "hsm_consensus_heartbeats_sent_total",
      7,
    );
  });

  test("handles engine without getState gracefully", async () => {
    // Register a non-engine object
    baseAdapter.registerConsensusEngine({ notAnEngine: true });

    const app = buildApp({
      id: "admin1",
      role: "admin",
      permissions: ["admin:all"],
    });
    const res = await request(app).get("/api/vault/consensus/status");

    expect(res.status).toBe(200);
    expect(res.body.engine).toBeNull();
  });

  test("timestamp is recent (within 5 seconds)", async () => {
    const app = buildApp({
      id: "admin1",
      role: "admin",
      permissions: ["admin:all"],
    });
    const before = Date.now();
    const res = await request(app).get("/api/vault/consensus/status");
    const after = Date.now();

    expect(res.body.timestamp).toBeGreaterThanOrEqual(before);
    expect(res.body.timestamp).toBeLessThanOrEqual(after);
  });
});

describe("base-adapter consensus engine registry", () => {
  afterEach(() => {
    baseAdapter.registerConsensusEngine(null);
  });

  test("registerConsensusEngine and getConsensusEngine work", () => {
    const mock = { nodeId: "test", getState: () => ({}) };
    baseAdapter.registerConsensusEngine(mock);
    expect(baseAdapter.getConsensusEngine()).toBe(mock);
  });

  test("registerConsensusEngine(null) clears the registry", () => {
    const mock = { nodeId: "test", getState: () => ({}) };
    baseAdapter.registerConsensusEngine(mock);
    expect(baseAdapter.getConsensusEngine()).toBe(mock);
    baseAdapter.registerConsensusEngine(null);
    expect(baseAdapter.getConsensusEngine()).toBeNull();
  });

  test("getConsensusEngine returns null when nothing registered", () => {
    baseAdapter.registerConsensusEngine(null);
    expect(baseAdapter.getConsensusEngine()).toBeNull();
  });
});
