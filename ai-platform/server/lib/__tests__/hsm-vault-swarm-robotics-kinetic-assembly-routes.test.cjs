"use strict";

/**
 * Tests for Track 114 PQC Swarm Robotics Kinetic Assembly Gating admin endpoints.
 *
 * Routes:
 *   - GET  /api/vault/swarm-robotics-kinetic-assembly/policy
 *   - POST /api/vault/swarm-robotics-kinetic-assembly/policy/validate
 *   - GET  /api/vault/swarm-robotics-kinetic-assembly/telemetry
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

describe("Track 114 Swarm Robotics Kinetic Assembly Gating routes", () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  test("GET /api/vault/swarm-robotics-kinetic-assembly/policy returns Track 114 defaults", async () => {
    const app = buildApp({
      id: "admin1",
      role: "admin",
      permissions: ["admin:all"],
    });
    const res = await request(app).get(
      "/api/vault/swarm-robotics-kinetic-assembly/policy",
    );
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.policy).toMatchObject({
      minRoboticQuorum: 40,
      maxKineticValidationWindowSeconds: 1,
      maxKineticAssemblyChainDepth: 80,
      allowedPqcSignatureSchemes: ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
      requireKineticAssemblyAuthorityInitializerAttestation: true,
      requireAssemblyEthicsOversightCommitteeAttestation: true,
      allowedAttestationAuthorities: ["mock-authority"],
      banMalformedOrOutOfOrderKineticAssemblyClaims: true,
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
      .post("/api/vault/swarm-robotics-kinetic-assembly/policy/validate")
      .send({
        roboticQuorum: 40,
        kineticValidationWindowSeconds: 1,
        kineticAssemblyChainDepth: 80,
        pqcSignatureScheme: "ML-DSA-87",
        kineticAssemblyAuthorityInitializerAttestation: true,
        assemblyEthicsOversightCommitteeAttestation: true,
        attestationAuthority: "mock-authority",
        banMalformedOrOutOfOrderKineticAssemblyClaims: true,
        canonicalPayloadLayout: true,
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.valid).toBe(true);
  });

  test("POST .../validate returns 400 for roboticQuorum below minimum", async () => {
    const app = buildApp({
      id: "admin1",
      role: "admin",
      permissions: ["admin:all"],
    });
    const res = await request(app)
      .post("/api/vault/swarm-robotics-kinetic-assembly/policy/validate")
      .send({
        roboticQuorum: 10,
        pqcSignatureScheme: "ML-DSA-87",
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("POLICY_VIOLATION_BLOCKED");
    expect(res.body.message).toMatch(/robotic quorum/);
  });

  test("POST .../validate returns 400 for disallowed PQC signature scheme", async () => {
    const app = buildApp({
      id: "admin1",
      role: "admin",
      permissions: ["admin:all"],
    });
    const res = await request(app)
      .post("/api/vault/swarm-robotics-kinetic-assembly/policy/validate")
      .send({
        pqcSignatureScheme: "falcon-512",
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("POLICY_VIOLATION_BLOCKED");
    expect(res.body.message).toMatch(/signature scheme/);
  });

  test("GET /api/vault/swarm-robotics-kinetic-assembly/telemetry returns Track 114 counters", async () => {
    const app = buildApp({
      id: "admin1",
      role: "admin",
      permissions: ["admin:all"],
    });
    hsmMetrics.incrementCounter("hsm_kineticgate_pool_initialized_total", 7);
    hsmMetrics.incrementCounter("hsm_zk_kinetic_posture_verified_total", 13);
    hsmMetrics.incrementCounter(
      "hsm_assembly_accreditation_completed_total",
      4,
    );

    const res = await request(app).get(
      "/api/vault/swarm-robotics-kinetic-assembly/telemetry",
    );
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.telemetry).toEqual({
      hsm_kineticgate_pool_initialized_total: 7,
      hsm_zk_kinetic_posture_verified_total: 13,
      hsm_assembly_accreditation_completed_total: 4,
    });
  });

  test("non-admin users are rejected with 403", async () => {
    const app = buildApp({ id: "user1", role: "viewer", permissions: [] });
    const res = await request(app).get(
      "/api/vault/swarm-robotics-kinetic-assembly/policy",
    );
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("insufficient_permissions");
  });
});
