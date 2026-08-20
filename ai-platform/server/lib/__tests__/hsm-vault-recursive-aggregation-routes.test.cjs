"use strict";

/**
 * Tests for Track 61 Route Integration — Recursive Proof Aggregation endpoints.
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

function buildApp(user) {
  const app = express();
  app.use(express.json());
  // Reset engine by forcing a fresh require of the router (jest.resetModules for each test)
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

let proofCounter = 0;
function nextProofId() {
  return `proof-${++proofCounter}-${Date.now()}`;
}

describe("Track 61: Recursive Proof Aggregation Routes", () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  test("GET /api/vault/recursive-aggregation/status returns counters and stats", async () => {
    const app = buildApp(ADMIN);
    const res = await request(app)
      .get("/api/vault/recursive-aggregation/status")
      .set("Accept", "application/json");
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.counters).toBeDefined();
    expect(res.body.counters.hsm_recursive_proof_submitted_total).toBe(0);
    expect(res.body.stats.totalProofs).toBe(0);
  });

  test("POST /api/vault/recursive-aggregation/proof submits a proof", async () => {
    const app = buildApp(ADMIN);
    const pid = nextProofId();
    const res = await request(app)
      .post("/api/vault/recursive-aggregation/proof")
      .send({ proofId: pid, proofData: "deadbeef" })
      .set("Accept", "application/json");
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.proofId).toBe(pid);
  });

  test("POST /api/vault/recursive-aggregation/fold folds two proofs", async () => {
    const app = buildApp(ADMIN);
    const p1 = nextProofId();
    const p2 = nextProofId();
    await request(app)
      .post("/api/vault/recursive-aggregation/proof")
      .send({ proofId: p1, proofData: "aaaa" })
      .set("Accept", "application/json");
    await request(app)
      .post("/api/vault/recursive-aggregation/proof")
      .send({ proofId: p2, proofData: "bbbb" })
      .set("Accept", "application/json");
    const res = await request(app)
      .post("/api/vault/recursive-aggregation/fold")
      .send({ proofId1: p1, proofId2: p2 })
      .set("Accept", "application/json");
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.proofId).toBeDefined();
    expect(res.body.innerProofs).toEqual([p1, p2]);
  });

  test("POST /api/vault/recursive-aggregation/aggregate/chain aggregates a chain", async () => {
    const app = buildApp(ADMIN);
    const p1 = nextProofId();
    const p2 = nextProofId();
    const p3 = nextProofId();
    for (const pid of [p1, p2, p3]) {
      await request(app)
        .post("/api/vault/recursive-aggregation/proof")
        .send({ proofId: pid, proofData: `data-${pid}` })
        .set("Accept", "application/json");
    }
    const res = await request(app)
      .post("/api/vault/recursive-aggregation/aggregate/chain")
      .send({ proofIds: [p1, p2, p3] })
      .set("Accept", "application/json");
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.type).toBe("chain");
    expect(res.body.status).toBe("completed");
  });

  test("GET /api/vault/recursive-aggregation/aggregations/:aggId returns aggregation", async () => {
    const app = buildApp(ADMIN);
    const p1 = nextProofId();
    const p2 = nextProofId();
    await request(app)
      .post("/api/vault/recursive-aggregation/proof")
      .send({ proofId: p1, proofData: "a1" })
      .set("Accept", "application/json");
    await request(app)
      .post("/api/vault/recursive-aggregation/proof")
      .send({ proofId: p2, proofData: "a2" })
      .set("Accept", "application/json");
    const agg = await request(app)
      .post("/api/vault/recursive-aggregation/aggregate/tree")
      .send({ proofIds: [p1, p2] })
      .set("Accept", "application/json");
    const aggId = agg.body.aggId;
    const res = await request(app)
      .get(`/api/vault/recursive-aggregation/aggregations/${aggId}`)
      .set("Accept", "application/json");
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.aggId).toBe(aggId);
  });

  test("missing admin permission returns 403", async () => {
    const app = buildApp(VIEWER);
    const res = await request(app)
      .get("/api/vault/recursive-aggregation/status")
      .set("Accept", "application/json");
    expect(res.statusCode).toBe(403);
  });

  test("duplicate proof returns 400", async () => {
    const app = buildApp(ADMIN);
    const pid = nextProofId();
    await request(app)
      .post("/api/vault/recursive-aggregation/proof")
      .send({ proofId: pid, proofData: "deadbeef" })
      .set("Accept", "application/json");
    const res = await request(app)
      .post("/api/vault/recursive-aggregation/proof")
      .send({ proofId: pid, proofData: "deadbeef" })
      .set("Accept", "application/json");
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("PROOF_ALREADY_EXISTS");
  });
});
