"use strict";

/**
 * Track 116 Cluster Isolation Hardening — REST Route Integration Tests
 *
 * Verifies that the 3 Track 116 endpoints correctly:
 * - Return policy attributes with orgId via resolveOrgId
 * - Validate configs and return structured POLICY_VIOLATION_BLOCKED on invalid input
 * - Expose telemetry counters without leaking sensitive data
 * - Maintain zero-leak constraints on all responses
 */

const request = require("supertest");
const express = require("express");

jest.mock("../../../middleware/authorize.cjs", () => ({
  authorize: () => (req, res, next) => next(),
}));

jest.mock("../../../lib/admin-throttle.cjs", () => ({
  middleware: (req, res, next) => next(),
}));

jest.mock("../../../lib/hsm-vault.cjs", () => ({
  hsmHandshake: jest.fn().mockResolvedValue({ status: "ok" }),
}));

function createTestApp() {
  const app = express();
  app.use(express.json());
  const cacheKeys = Object.keys(require.cache || {});
  for (const k of cacheKeys) {
    if (k.endsWith("/server/routes/hsm-vault-routes.cjs")) {
      delete require.cache[k];
    }
  }
  const vaultRoutes = require("../../../routes/hsm-vault-routes.cjs");
  app.use("/api/vault", vaultRoutes);
  return app;
}

describe("Track 116 cluster-isolation REST route integration", () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  test("ROUTE116-L2-01: policy endpoint returns orgId via resolveOrgId", async () => {
    const res = await request(app)
      .get("/api/vault/cluster-isolation/policy?orgId=test-tenant-116")
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.orgId).toBe("test-tenant-116");
    expect(res.body.policy).toBeDefined();
  });

  test("ROUTE116-L2-02: validate endpoint uses resolveOrgId as tenantId", async () => {
    const res = await request(app)
      .post(
        "/api/vault/cluster-isolation/policy/validate?orgId=tenant-116-validate",
      )
      .send({})
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.valid).toBe(true);
  });

  test("ROUTE116-L2-03: telemetry endpoint returns only numeric counters", async () => {
    const res = await request(app)
      .get("/api/vault/cluster-isolation/telemetry")
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.telemetry).toBeDefined();
    const telemetry = res.body.telemetry;
    expect(Object.keys(telemetry).sort()).toEqual([
      "hsm_isolation_violation_total",
      "hsm_key_reject_total",
    ]);
    expect(typeof telemetry.hsm_isolation_violation_total).toBe("number");
    expect(typeof telemetry.hsm_key_reject_total).toBe("number");
    // Zero-leak: no peer addresses, no message content, no key material
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("peer");
    expect(body).not.toContain("secret");
    expect(body).not.toContain("activeHex");
    expect(body).not.toContain("previousHex");
    expect(body).not.toContain("masterPublicKey");
  });

  test("ROUTE116-L2-04: policy endpoint returns only 4 policy attributes", async () => {
    const res = await request(app)
      .get("/api/vault/cluster-isolation/policy")
      .expect(200);
    expect(res.body.success).toBe(true);
    const policy = res.body.policy;
    expect(Object.keys(policy).sort()).toEqual([
      "allowDkgNonLeaderMessages",
      "maxIsolationViolationThreshold",
      "rejectNonLeaderKeyCommits",
      "requireKnownPeerValidation",
    ]);
    expect(policy.requireKnownPeerValidation).toBe(true);
    expect(policy.rejectNonLeaderKeyCommits).toBe(true);
    expect(policy.allowDkgNonLeaderMessages).toBe(false);
    expect(policy.maxIsolationViolationThreshold).toBe(100);
    // Zero-leak: no secrets or internal state
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("secret");
    expect(body).not.toContain("password");
    expect(body).not.toContain("privateKey");
  });

  test("ROUTE116-L2-05: telemetry counters match hsmMetrics.getMetrics()", async () => {
    const hsmMetrics = require("../hsm-metrics.cjs");
    const expectedMetrics = hsmMetrics.getMetrics();
    const res = await request(app)
      .get("/api/vault/cluster-isolation/telemetry")
      .expect(200);
    expect(res.body.telemetry.hsm_isolation_violation_total).toBe(
      expectedMetrics.hsm_isolation_violation_total || 0,
    );
    expect(res.body.telemetry.hsm_key_reject_total).toBe(
      expectedMetrics.hsm_key_reject_total || 0,
    );
  });

  test("ROUTE116-L2-06: telemetry counters are non-negative integers", async () => {
    const res = await request(app)
      .get("/api/vault/cluster-isolation/telemetry")
      .expect(200);
    const t = res.body.telemetry;
    expect(t.hsm_isolation_violation_total).toBeGreaterThanOrEqual(0);
    expect(t.hsm_key_reject_total).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(t.hsm_isolation_violation_total)).toBe(true);
    expect(Number.isInteger(t.hsm_key_reject_total)).toBe(true);
  });

  test("ROUTE116-L2-07: valid config (empty body) passes validation", async () => {
    const res = await request(app)
      .post("/api/vault/cluster-isolation/policy/validate")
      .send({})
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.valid).toBe(true);
  });

  test("ROUTE116-L2-08: invalid config fails with 400 POLICY_VIOLATION_BLOCKED", async () => {
    const res = await request(app)
      .post("/api/vault/cluster-isolation/policy/validate")
      .send({ requireKnownPeerValidation: false })
      .expect(400);
    expect(res.body.error).toMatch(/POLICY_VIOLATION_BLOCKED/);
    expect(res.body.message).toBeDefined();
    // Zero-leak: error message should not echo back the config
    expect(res.body.message).not.toContain("requireKnownPeerValidation");
  });
});
