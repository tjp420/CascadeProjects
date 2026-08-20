"use strict";

/**
 * Tests for Track 115 PQC Multi-Enclave Confidential Mesh State-Reconciliation Gating admin endpoints.
 *
 * Routes:
 *   - GET  /api/vault/multi-enclave-confidential-mesh-state-reconciliation/policy
 *   - POST /api/vault/multi-enclave-confidential-mesh-state-reconciliation/policy/validate
 *   - GET  /api/vault/multi-enclave-confidential-mesh-state-reconciliation/telemetry
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

describe("Track 115 Multi-Enclave Confidential Mesh State-Reconciliation Gating routes", () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  test("GET /api/vault/multi-enclave-confidential-mesh-state-reconciliation/policy returns Track 115 defaults", async () => {
    const app = buildApp({
      id: "admin1",
      role: "admin",
      permissions: ["admin:all"],
    });
    const res = await request(app).get(
      "/api/vault/multi-enclave-confidential-mesh-state-reconciliation/policy",
    );
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.policy).toMatchObject({
      minMeshQuorum: 50,
      maxEpochFinalityWindowSeconds: 10,
      maxReconciliationChainDepth: 100,
      allowedPqcSignatureSchemes: ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
      requireMeshReconciliationAuthorityInitializerAttestation: true,
      requireMeshEthicsOversightCommitteeAttestation: true,
      allowedAttestationAuthorities: ["mock-authority"],
      banMalformedOrOutOfOrderMeshStateReconciliationClaims: true,
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
      .post(
        "/api/vault/multi-enclave-confidential-mesh-state-reconciliation/policy/validate",
      )
      .send({
        meshQuorum: 50,
        epochFinalityWindowSeconds: 10,
        reconciliationChainDepth: 100,
        pqcSignatureScheme: "ML-DSA-87",
        meshReconciliationAuthorityInitializerAttestation: true,
        meshEthicsOversightCommitteeAttestation: true,
        attestationAuthority: "mock-authority",
        banMalformedOrOutOfOrderMeshStateReconciliationClaims: true,
        canonicalPayloadLayout: true,
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.valid).toBe(true);
  });

  test("POST .../validate returns 400 for meshQuorum below minimum", async () => {
    const app = buildApp({
      id: "admin1",
      role: "admin",
      permissions: ["admin:all"],
    });
    const res = await request(app)
      .post(
        "/api/vault/multi-enclave-confidential-mesh-state-reconciliation/policy/validate",
      )
      .send({
        meshQuorum: 10,
        pqcSignatureScheme: "ML-DSA-87",
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("POLICY_VIOLATION_BLOCKED");
    expect(res.body.message).toMatch(/mesh quorum/);
  });

  test("POST .../validate returns 400 for disallowed PQC signature scheme", async () => {
    const app = buildApp({
      id: "admin1",
      role: "admin",
      permissions: ["admin:all"],
    });
    const res = await request(app)
      .post(
        "/api/vault/multi-enclave-confidential-mesh-state-reconciliation/policy/validate",
      )
      .send({
        pqcSignatureScheme: "falcon-512",
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("POLICY_VIOLATION_BLOCKED");
    expect(res.body.message).toMatch(/signature scheme/);
  });

  test("GET /api/vault/multi-enclave-confidential-mesh-state-reconciliation/telemetry returns Track 115 counters", async () => {
    const app = buildApp({
      id: "admin1",
      role: "admin",
      permissions: ["admin:all"],
    });
    hsmMetrics.incrementCounter("hsm_meshgate_pool_initialized_total", 7);
    hsmMetrics.incrementCounter("hsm_zk_mesh_state_reconciled_total", 13);
    hsmMetrics.incrementCounter("hsm_epoch_finality_completed_total", 4);

    const res = await request(app).get(
      "/api/vault/multi-enclave-confidential-mesh-state-reconciliation/telemetry",
    );
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.telemetry).toEqual({
      hsm_meshgate_pool_initialized_total: 7,
      hsm_zk_mesh_state_reconciled_total: 13,
      hsm_epoch_finality_completed_total: 4,
    });
  });

  test("non-admin users are rejected with 403", async () => {
    const app = buildApp({ id: "user1", role: "viewer", permissions: [] });
    const res = await request(app).get(
      "/api/vault/multi-enclave-confidential-mesh-state-reconciliation/policy",
    );
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("insufficient_permissions");
  });
});
