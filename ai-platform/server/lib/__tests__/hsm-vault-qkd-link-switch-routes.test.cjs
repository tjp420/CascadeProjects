"use strict";

/**
 * Tests for Track 109 quantum key distribution link-switch gating admin endpoints.
 *
 * Routes:
 *   - GET  /api/vault/qkd-link-switch/policy
 *   - POST /api/vault/qkd-link-switch/policy/validate
 *   - GET  /api/vault/qkd-link-switch/telemetry
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

function buildApp(user) {
  const app = express();
  const router = require("../../routes/hsm-vault-routes.cjs");
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  app.use("/api/vault", router);
  return app;
}

describe("Track 109 Quantum Key Distribution Link-Switch Gating routes", () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  test("GET /api/vault/qkd-link-switch/policy returns Track 109 defaults", async () => {
    const app = buildApp({
      id: "admin1",
      role: "admin",
      permissions: ["admin:all"],
    });
    const res = await request(app).get("/api/vault/qkd-link-switch/policy");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.policy).toMatchObject({
      minQkdQuorum: 18,
      maxEntanglementWindowSeconds: 60,
      maxQkdSwitchChainDepth: 42,
      allowedPqcSignatureSchemes: ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
      requireQkdLinkAuthorityInitializerAttestation: true,
      requireQkdEthicsOversightCommitteeAttestation: true,
      allowedAttestationAuthorities: ["mock-authority"],
      banMalformedOrOutOfOrderQkdLinkClaims: true,
      requireCanonicalPayloadLayout: true,
    });
  });

  test("POST .../validate accepts a valid configuration", async () => {
    const app = buildApp({
      id: "admin1",
      role: "admin",
      permissions: ["admin:all"],
    });
    const res = await request(app)
      .post("/api/vault/qkd-link-switch/policy/validate")
      .send({
        qkdQuorum: 18,
        entanglementWindowSeconds: 60,
        qkdSwitchChainDepth: 42,
        pqcSignatureScheme: "ML-DSA-65",
        qkdLinkAuthorityInitializerAttestation: true,
        qkdEthicsOversightCommitteeAttestation: true,
        attestationAuthority: "mock-authority",
        banMalformedOrOutOfOrderQkdLinkClaims: true,
        canonicalPayloadLayout: true,
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.valid).toBe(true);
  });

  test("POST .../validate returns 400 for qkdQuorum below minimum", async () => {
    const app = buildApp({
      id: "admin1",
      role: "admin",
      permissions: ["admin:all"],
    });
    const res = await request(app)
      .post("/api/vault/qkd-link-switch/policy/validate")
      .send({
        qkdQuorum: 5,
        pqcSignatureScheme: "ML-DSA-65",
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("POLICY_VIOLATION_BLOCKED");
    expect(res.body.message).toMatch(/qkd quorum/);
  });

  test("POST .../validate returns 400 for disallowed PQC signature scheme", async () => {
    const app = buildApp({
      id: "admin1",
      role: "admin",
      permissions: ["admin:all"],
    });
    const res = await request(app)
      .post("/api/vault/qkd-link-switch/policy/validate")
      .send({
        pqcSignatureScheme: "falcon-512",
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("POLICY_VIOLATION_BLOCKED");
    expect(res.body.message).toMatch(/signature scheme/);
  });

  test("GET /api/vault/qkd-link-switch/telemetry returns Track 109 counters", async () => {
    const app = buildApp({
      id: "admin1",
      role: "admin",
      permissions: ["admin:all"],
    });
    hsmMetrics.incrementCounter("hsm_qkdswitchgate_pool_initialized_total", 3);
    hsmMetrics.incrementCounter("hsm_zk_qkd_link_claim_verified_total", 7);
    hsmMetrics.incrementCounter(
      "hsm_entanglement_accreditation_completed_total",
      2,
    );

    const res = await request(app).get("/api/vault/qkd-link-switch/telemetry");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.telemetry).toEqual({
      hsm_qkdswitchgate_pool_initialized_total: 3,
      hsm_zk_qkd_link_claim_verified_total: 7,
      hsm_entanglement_accreditation_completed_total: 2,
    });
  });

  test("non-admin users are rejected with 403", async () => {
    const app = buildApp({ id: "user1", role: "viewer", permissions: [] });
    const res = await request(app).get("/api/vault/qkd-link-switch/policy");
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("insufficient_permissions");
  });
});
