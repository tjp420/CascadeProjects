"use strict";

/**
 * Tests for Track 40 Route Integration — Distributed Consensus Coordinator endpoints.
 */

const express = require("express");
const request = require("supertest");

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

jest.mock("../../lib/admin-throttle.cjs", () => ({
  middleware: function (req, res, next) {
    next();
  },
}));

jest.mock("../../lib/hsm-vault.cjs", () => ({
  deriveWithFailover: jest.fn().mockResolvedValue(Buffer.alloc(32)),
  getHsmVersions: jest
    .fn()
    .mockReturnValue({ primary: "test", secondary: "test" }),
  hsmHandshake: jest.fn().mockResolvedValue({ status: "ok" }),
  decryptWithHsm: jest.fn().mockResolvedValue("plaintext"),
  hsmRotate: jest.fn().mockResolvedValue({ rotated: true }),
}));

const hsmMetrics = require("../../lib/hsm-adapter/hsm-metrics.cjs");
const baseAdapter = require("../../lib/hsm-adapter/base-adapter.cjs");
const {
  DistributedConsensusCoordinator,
} = require("../../lib/hsm-adapter/distributed-consensus-coordinator.cjs");

function buildApp(user) {
  const app = express();
  app.use(express.json());
  const router = require("../../routes/hsm-vault-routes.cjs");
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  app.use("/api/vault", router);
  return app;
}

const ADMIN = { id: "admin1", role: "admin", permissions: ["admin:all"] };
const VIEWER = { id: "viewer1", role: "viewer", permissions: [] };

describe("Track 40: Consensus Coordinator Routes", () => {
  let coordinator;

  beforeEach(() => {
    hsmMetrics.reset();
    coordinator = new DistributedConsensusCoordinator({
      coordinatorId: "test-coord",
      nodeId: "node-A",
      maxGroups: 8,
    });
    baseAdapter.registerConsensusCoordinator(coordinator);
  });

  afterEach(() => {
    coordinator.stop();
    baseAdapter.registerConsensusCoordinator(null);
  });

  describe("GET /consensus/coordinator/status", () => {
    test("returns 200 with state and counters for admin", async () => {
      const app = buildApp(ADMIN);
      const res = await request(app).get(
        "/api/vault/consensus/coordinator/status",
      );
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.state.coordinatorId).toBe("test-coord");
      expect(res.body.counters).toBeDefined();
    });

    test("includes counters after operations", async () => {
      coordinator.createGroup({
        groupId: "g1",
        clusterNodes: ["node-A", "node-B"],
      });
      const app = buildApp(ADMIN);
      const res = await request(app).get(
        "/api/vault/consensus/coordinator/status",
      );
      expect(res.body.counters.hsm_consensus_coord_groups_created_total).toBe(
        1,
      );
    });

    test("returns 403 for non-admin", async () => {
      const app = buildApp(VIEWER);
      const res = await request(app).get(
        "/api/vault/consensus/coordinator/status",
      );
      expect(res.status).toBe(403);
    });

    test("returns 503 when no coordinator registered", async () => {
      baseAdapter.registerConsensusCoordinator(null);
      const app = buildApp(ADMIN);
      const res = await request(app).get(
        "/api/vault/consensus/coordinator/status",
      );
      expect(res.status).toBe(503);
    });
  });

  describe("GET /consensus/groups", () => {
    test("returns 200 with empty list", async () => {
      const app = buildApp(ADMIN);
      const res = await request(app).get("/api/vault/consensus/groups");
      expect(res.status).toBe(200);
      expect(res.body.groups).toEqual([]);
      expect(res.body.total).toBe(0);
    });

    test("returns 200 with groups after creation", async () => {
      coordinator.createGroup({
        groupId: "g1",
        clusterNodes: ["node-A", "node-B"],
      });
      coordinator.createGroup({
        groupId: "g2",
        clusterNodes: ["node-A", "node-C"],
      });
      const app = buildApp(ADMIN);
      const res = await request(app).get("/api/vault/consensus/groups");
      expect(res.body.total).toBe(2);
    });

    test("returns 403 for non-admin", async () => {
      const app = buildApp(VIEWER);
      const res = await request(app).get("/api/vault/consensus/groups");
      expect(res.status).toBe(403);
    });
  });

  describe("GET /consensus/groups/:groupId", () => {
    test("returns 200 with group state", async () => {
      coordinator.createGroup({
        groupId: "g1",
        clusterNodes: ["node-A", "node-B"],
        topic: "test",
      });
      const app = buildApp(ADMIN);
      const res = await request(app).get("/api/vault/consensus/groups/g1");
      expect(res.status).toBe(200);
      expect(res.body.group.groupId).toBe("g1");
      expect(res.body.group.topic).toBe("test");
    });

    test("returns 404 for non-existent group", async () => {
      const app = buildApp(ADMIN);
      const res = await request(app).get(
        "/api/vault/consensus/groups/nonexistent",
      );
      expect(res.status).toBe(404);
    });

    test("returns 403 for non-admin", async () => {
      const app = buildApp(VIEWER);
      const res = await request(app).get("/api/vault/consensus/groups/g1");
      expect(res.status).toBe(403);
    });
  });

  describe("POST /consensus/groups", () => {
    test("creates a group and returns 201", async () => {
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post("/api/vault/consensus/groups")
        .send({ groupId: "g1", clusterNodes: ["node-A", "node-B", "node-C"] });
      expect(res.status).toBe(201);
      expect(res.body.group.groupId).toBe("g1");
      expect(res.body.group.state).toBe("active");
    });

    test("creates a group with topic and keyRange", async () => {
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post("/api/vault/consensus/groups")
        .send({
          groupId: "g1",
          clusterNodes: ["node-A", "node-B"],
          topic: "east",
          keyRange: { start: "a", end: "m" },
        });
      expect(res.status).toBe(201);
      expect(res.body.group.topic).toBe("east");
    });

    test("returns 400 for missing groupId", async () => {
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post("/api/vault/consensus/groups")
        .send({ clusterNodes: ["node-A"] });
      expect(res.status).toBe(400);
    });

    test("returns 400 for missing clusterNodes", async () => {
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post("/api/vault/consensus/groups")
        .send({ groupId: "g1" });
      expect(res.status).toBe(400);
    });

    test("returns 409 for duplicate groupId", async () => {
      coordinator.createGroup({
        groupId: "g1",
        clusterNodes: ["node-A", "node-B"],
      });
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post("/api/vault/consensus/groups")
        .send({ groupId: "g1", clusterNodes: ["node-A", "node-B"] });
      expect(res.status).toBe(409);
    });

    test("returns 403 for non-admin", async () => {
      const app = buildApp(VIEWER);
      const res = await request(app)
        .post("/api/vault/consensus/groups")
        .send({ groupId: "g1", clusterNodes: ["node-A"] });
      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /consensus/groups/:groupId", () => {
    test("destroys a group and returns 200", async () => {
      coordinator.createGroup({
        groupId: "g1",
        clusterNodes: ["node-A", "node-B"],
      });
      const app = buildApp(ADMIN);
      const res = await request(app).delete("/api/vault/consensus/groups/g1");
      expect(res.status).toBe(200);
      expect(res.body.destroyed).toBe(true);
    });

    test("returns 404 for non-existent group", async () => {
      const app = buildApp(ADMIN);
      const res = await request(app).delete(
        "/api/vault/consensus/groups/nonexistent",
      );
      expect(res.status).toBe(404);
    });

    test("returns 403 for non-admin", async () => {
      const app = buildApp(VIEWER);
      const res = await request(app).delete("/api/vault/consensus/groups/g1");
      expect(res.status).toBe(403);
    });
  });

  describe("POST /consensus/proposals", () => {
    beforeEach(() => {
      coordinator.createGroup({
        groupId: "g1",
        clusterNodes: ["node-A", "node-B", "node-C"],
        topic: "east",
      });
    });

    test("routes by groupId and returns 200", async () => {
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post("/api/vault/consensus/proposals")
        .send({ groupId: "g1", command: { type: "put" } });
      expect(res.status).toBe(200);
      expect(res.body.accepted).toBe(true);
    });

    test("routes by topic and returns 200", async () => {
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post("/api/vault/consensus/proposals")
        .send({ topic: "east", command: {} });
      expect(res.status).toBe(200);
      expect(res.body.accepted).toBe(true);
    });

    test("returns 400 when no routing key", async () => {
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post("/api/vault/consensus/proposals")
        .send({ command: {} });
      expect(res.status).toBe(400);
    });

    test("returns 404 for non-existent group", async () => {
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post("/api/vault/consensus/proposals")
        .send({ groupId: "nonexistent", command: {} });
      expect(res.status).toBe(404);
    });

    test("returns 403 for non-admin", async () => {
      const app = buildApp(VIEWER);
      const res = await request(app)
        .post("/api/vault/consensus/proposals")
        .send({ groupId: "g1", command: {} });
      expect(res.status).toBe(403);
    });
  });

  describe("POST /consensus/heartbeat", () => {
    beforeEach(() => {
      coordinator.createGroup({
        groupId: "g1",
        clusterNodes: ["node-A", "node-B"],
      });
    });

    test("records heartbeat and returns 200", async () => {
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post("/api/vault/consensus/heartbeat")
        .send({ nodeId: "node-B", groupId: "g1", leaderId: "node-A" });
      expect(res.status).toBe(200);
      expect(res.body.nodeId).toBe("node-B");
    });

    test("returns 400 for missing params", async () => {
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post("/api/vault/consensus/heartbeat")
        .send({ nodeId: "node-B" });
      expect(res.status).toBe(400);
    });

    test("returns 404 for unknown group", async () => {
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post("/api/vault/consensus/heartbeat")
        .send({ nodeId: "node-B", groupId: "nonexistent" });
      expect(res.status).toBe(404);
    });

    test("returns 403 for non-admin", async () => {
      const app = buildApp(VIEWER);
      const res = await request(app)
        .post("/api/vault/consensus/heartbeat")
        .send({ nodeId: "node-B", groupId: "g1" });
      expect(res.status).toBe(403);
    });
  });

  describe("POST /consensus/view-change", () => {
    beforeEach(() => {
      coordinator.createGroup({
        groupId: "g1",
        clusterNodes: ["node-A", "node-B", "node-C", "node-D", "node-E"],
      });
    });

    test("initiates view change and returns 200", async () => {
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post("/api/vault/consensus/view-change")
        .send({
          groupId: "g1",
          failedLeaderId: "node-B",
          candidateId: "node-A",
        });
      expect(res.status).toBe(200);
      expect(res.body.accepted).toBe(true);
    });

    test("returns 400 for missing params", async () => {
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post("/api/vault/consensus/view-change")
        .send({ groupId: "g1", failedLeaderId: "node-B" });
      expect(res.status).toBe(400);
    });

    test("returns 404 for unknown group", async () => {
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post("/api/vault/consensus/view-change")
        .send({
          groupId: "nonexistent",
          failedLeaderId: "node-B",
          candidateId: "node-A",
        });
      expect(res.status).toBe(404);
    });

    test("returns 409 when already in progress", async () => {
      coordinator.initiateViewChange("g1", "node-B", "node-A");
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post("/api/vault/consensus/view-change")
        .send({
          groupId: "g1",
          failedLeaderId: "node-B",
          candidateId: "node-C",
        });
      expect(res.status).toBe(409);
    });

    test("returns 403 for non-admin", async () => {
      const app = buildApp(VIEWER);
      const res = await request(app)
        .post("/api/vault/consensus/view-change")
        .send({
          groupId: "g1",
          failedLeaderId: "node-B",
          candidateId: "node-A",
        });
      expect(res.status).toBe(403);
    });
  });

  describe("POST /consensus/view-change/vote", () => {
    beforeEach(() => {
      coordinator.createGroup({
        groupId: "g1",
        clusterNodes: ["node-A", "node-B", "node-C", "node-D", "node-E"],
      });
      coordinator.initiateViewChange("g1", "node-B", "node-A");
    });

    test("casts a vote and returns 200", async () => {
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post("/api/vault/consensus/view-change/vote")
        .send({ groupId: "g1", voterId: "node-B", candidateId: "node-A" });
      expect(res.status).toBe(200);
      expect(res.body.accepted).toBe(true);
    });

    test("completes view change when quorum reached", async () => {
      const app = buildApp(ADMIN);
      await request(app)
        .post("/api/vault/consensus/view-change/vote")
        .send({ groupId: "g1", voterId: "node-B", candidateId: "node-A" });
      const res = await request(app)
        .post("/api/vault/consensus/view-change/vote")
        .send({ groupId: "g1", voterId: "node-C", candidateId: "node-A" });
      expect(res.status).toBe(200);
      expect(res.body.completed).toBe(true);
      expect(res.body.newLeaderId).toBe("node-A");
    });

    test("returns 400 for missing params", async () => {
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post("/api/vault/consensus/view-change/vote")
        .send({ groupId: "g1", voterId: "node-B" });
      expect(res.status).toBe(400);
    });

    test("returns 409 when no view change in progress", async () => {
      const vc = coordinator._viewChanges.get("g1");
      vc.startTime = Date.now() - 9999;
      coordinator.checkViewChangeTimeouts();
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post("/api/vault/consensus/view-change/vote")
        .send({ groupId: "g1", voterId: "node-B", candidateId: "node-A" });
      expect(res.status).toBe(409);
    });

    test("returns 403 for non-admin", async () => {
      const app = buildApp(VIEWER);
      const res = await request(app)
        .post("/api/vault/consensus/view-change/vote")
        .send({ groupId: "g1", voterId: "node-B", candidateId: "node-A" });
      expect(res.status).toBe(403);
    });
  });
});
