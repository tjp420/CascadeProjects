"use strict";

/**
 * Tests for GET /api/vault/metrics — HSM adapter metrics endpoint.
 *
 * Verifies that the route:
 *   1. Returns 200 with Prometheus exposition format
 *   2. Sets Content-Type to text/plain; version=0.0.4
 *   3. Includes all expected HSM metric names
 *   4. Requires admin:all authorization
 *   5. Returns 403 for non-admin users
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
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  app.use("/api/vault", router);
  return app;
}

describe("GET /api/vault/metrics", () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  test("returns 200 with Prometheus exposition format for admin", async () => {
    const app = buildApp({
      id: "admin1",
      role: "admin",
      permissions: ["admin:all"],
    });

    // Record some metrics to have non-zero output
    hsmMetrics.incrementCounter("hsm_wrap_total", 5);
    hsmMetrics.incrementCounter("hsm_unwrap_total", 3);
    hsmMetrics.observeHistogram("hsm_wrap_duration_ms", 42);

    const res = await request(app).get("/api/vault/metrics");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/plain.*version=0\.0\.4/);
    expect(res.text).toContain("# HELP hsm_wrap_total");
    expect(res.text).toContain("# TYPE hsm_wrap_total counter");
    expect(res.text).toContain("hsm_wrap_total 5");
    expect(res.text).toContain("hsm_unwrap_total 3");
    expect(res.text).toContain("# TYPE hsm_wrap_duration_ms histogram");
    expect(res.text).toContain("hsm_wrap_duration_ms_count 1");
    expect(res.text).toContain("hsm_wrap_duration_ms_sum 42");
  });

  test("includes all expected counter metric names", async () => {
    const app = buildApp({
      id: "admin1",
      role: "admin",
      permissions: ["admin:all"],
    });

    const res = await request(app).get("/api/vault/metrics");

    const expectedCounters = [
      "hsm_wrap_total",
      "hsm_wrap_failures_total",
      "hsm_unwrap_total",
      "hsm_unwrap_failures_total",
      "hsm_create_kek_total",
      "hsm_create_kek_failures_total",
      "hsm_rotate_kek_total",
      "hsm_zeroize_total",
      "hsm_circuit_opened_total",
      "hsm_circuit_closed_total",
      "hsm_circuit_half_open_total",
    ];
    for (const name of expectedCounters) {
      expect(res.text).toContain(`# HELP ${name}`);
      expect(res.text).toContain(`# TYPE ${name} counter`);
    }
  });

  test("includes all expected histogram metric names", async () => {
    const app = buildApp({
      id: "admin1",
      role: "admin",
      permissions: ["admin:all"],
    });

    const res = await request(app).get("/api/vault/metrics");

    const expectedHistograms = [
      "hsm_wrap_duration_ms",
      "hsm_unwrap_duration_ms",
      "hsm_create_kek_duration_ms",
    ];
    for (const name of expectedHistograms) {
      expect(res.text).toContain(`# HELP ${name}`);
      expect(res.text).toContain(`# TYPE ${name} histogram`);
      expect(res.text).toContain(`${name}_bucket{le="+Inf"}`);
      expect(res.text).toContain(`${name}_count`);
      expect(res.text).toContain(`${name}_sum`);
    }
  });

  test("returns 403 for non-admin users", async () => {
    const app = buildApp({ id: "user1", role: "viewer", permissions: [] });

    const res = await request(app).get("/api/vault/metrics");

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("insufficient_permissions");
  });

  test("returns 403 without user context", async () => {
    const app = buildApp(null);

    const res = await request(app).get("/api/vault/metrics");

    expect(res.status).toBe(403);
  });

  test("output ends with newline (Prometheus convention)", async () => {
    const app = buildApp({
      id: "admin1",
      role: "admin",
      permissions: ["admin:all"],
    });

    const res = await request(app).get("/api/vault/metrics");

    expect(res.text.endsWith("\n")).toBe(true);
  });
});
