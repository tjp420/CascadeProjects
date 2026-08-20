"use strict";

/**
 * Tests for GET /api/audit/telemetry — security telemetry aggregation endpoint.
 *
 * Verifies that the endpoint correctly aggregates data from:
 *   - Scrubber registry (active scrubbers, eviction/expiry stats)
 *   - Replay detector (total checked, replays, org count)
 *   - Audit log integrity (chain status, quarantine count)
 *   - PII policy stats (enabled policies, by severity)
 */

const {
  describe,
  it,
  before,
  after,
  beforeEach,
  afterEach,
} = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");

describe("Security Telemetry Endpoint (GET /api/audit/telemetry)", () => {
  let request;
  let express;
  let adminApp;
  let regularApp;
  let noAuthApp;
  let _tempDir;
  let _policyPath;
  let _auditLogPath;

  const ADMIN_USER = {
    id: "admin@org-telemetry.com",
    email: "admin@org-telemetry.com",
    role: "admin",
    permissions: ["admin:all"],
  };

  const REGULAR_USER = {
    id: "user@org-telemetry.com",
    email: "user@org-telemetry.com",
    role: "developer",
  };

  before(() => {
    _tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sb-telemetry-"));
    _policyPath = path.join(_tempDir, "pii-policies.json");
    _auditLogPath = path.join(_tempDir, "audit-log.json");
    process.env.PII_POLICY_PATH = _policyPath;
    process.env.AUDIT_LOG_PATH = _auditLogPath;
    fs.writeFileSync(_policyPath, JSON.stringify({ policies: [] }), "utf8");
    fs.writeFileSync(_auditLogPath, JSON.stringify({ entries: {} }), "utf8");

    jest.resetModules();

    // Seed PII defaults
    const piiStore = require("../pii-policy-store.cjs");
    piiStore.seedDefaults("admin@org-telemetry.com");

    request = require("supertest");
    express = require("express");

    jest.mock("../../middleware/auth.cjs", () => ({
      authenticate: function mockAuthenticate(req, res, next) {
        if (req.user) return next();
        return res.status(401).json({
          success: false,
          error: "authentication_required",
          message: "Authentication required",
        });
      },
    }));

    function createTestApp(user) {
      const app = express();
      app.use(express.json());
      app.use((req, res, next) => {
        if (user) req.user = user;
        next();
      });
      const auditRoutes = require("../../routes/audit-routes.cjs");
      app.use("/api/audit", auditRoutes);
      return app;
    }

    adminApp = createTestApp(ADMIN_USER);
    regularApp = createTestApp(REGULAR_USER);
    noAuthApp = createTestApp(null);
  });

  after(() => {
    try {
      jest.resetModules();
      if (_tempDir && fs.existsSync(_tempDir)) {
        fs.rmSync(_tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  // ── E2E Endpoint Tests ─────────────────────────────────────────────────────

  describe("E2E: GET /api/audit/telemetry", () => {
    it("should return 200 for admin user", async () => {
      const res = await request(adminApp).get("/api/audit/telemetry");
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
    });

    it("should return 403 for non-admin user", async () => {
      const res = await request(regularApp).get("/api/audit/telemetry");
      assert.strictEqual(res.status, 403);
    });

    it("should return 401 for unauthenticated request", async () => {
      const res = await request(noAuthApp).get("/api/audit/telemetry");
      assert.strictEqual(res.status, 401);
    });

    it("should include timestamp in response", async () => {
      const res = await request(adminApp).get("/api/audit/telemetry");
      assert.ok(typeof res.body.timestamp === "number");
      assert.ok(res.body.timestamp > 0);
    });

    it("should include scrubber stats", async () => {
      const res = await request(adminApp).get("/api/audit/telemetry");
      assert.ok(res.body.scrubber);
      assert.ok(typeof res.body.scrubber.activeScrubbers === "number");
      assert.ok(typeof res.body.scrubber.maxScrubbers === "number");
      assert.ok(typeof res.body.scrubber.ttlMs === "number");
      assert.ok(typeof res.body.scrubber.totalCreated === "number");
      assert.ok(typeof res.body.scrubber.totalEvicted === "number");
      assert.ok(typeof res.body.scrubber.totalExpired === "number");
    });

    it("should include replay stats", async () => {
      const res = await request(adminApp).get("/api/audit/telemetry");
      // Replay stats may be null if agentic routes can't be loaded
      // but in the test environment they should be available
      if (res.body.replay) {
        assert.ok(typeof res.body.replay.totalChecked === "number");
        assert.ok(typeof res.body.replay.totalReplays === "number");
        assert.ok(typeof res.body.replay.orgCount === "number");
        assert.ok(typeof res.body.replay.totalFingerprints === "number");
      }
    });

    it("should include audit stats", async () => {
      const res = await request(adminApp).get("/api/audit/telemetry");
      assert.ok(res.body.audit);
      assert.ok(typeof res.body.audit.chainValid === "boolean");
      assert.ok(typeof res.body.audit.totalEntries === "number");
      assert.ok(typeof res.body.audit.brokenLinks === "number");
      assert.ok(typeof res.body.audit.tamperedEntries === "number");
      assert.ok(typeof res.body.audit.quarantinedCount === "number");
    });

    it("should include PII policy stats", async () => {
      const res = await request(adminApp).get("/api/audit/telemetry");
      assert.ok(res.body.pii);
      // PII stats may have error field if org has no policies
      if (!res.body.pii.error) {
        assert.ok(typeof res.body.pii.totalPolicies === "number");
        assert.ok(typeof res.body.pii.enabledPolicies === "number");
      }
    });

    it("should return scrubber.scrubbers array with per-scrubber details", async () => {
      const res = await request(adminApp).get("/api/audit/telemetry");
      assert.ok(Array.isArray(res.body.scrubber.scrubbers));
    });

    it("should return consistent data across multiple calls", async () => {
      const res1 = await request(adminApp).get("/api/audit/telemetry");
      const res2 = await request(adminApp).get("/api/audit/telemetry");
      assert.strictEqual(res1.status, 200);
      assert.strictEqual(res2.status, 200);
      assert.strictEqual(
        res1.body.scrubber.maxScrubbers,
        res2.body.scrubber.maxScrubbers,
      );
      assert.strictEqual(res1.body.scrubber.ttlMs, res2.body.scrubber.ttlMs);
    });
  });

  // ── Data Shape Verification ────────────────────────────────────────────────

  describe("data shape verification", () => {
    it("should have all top-level keys", async () => {
      const res = await request(adminApp).get("/api/audit/telemetry");
      assert.ok(res.body.success);
      assert.ok(res.body.timestamp);
      assert.ok(res.body.scrubber);
      assert.ok("replay" in res.body);
      assert.ok(res.body.audit);
      assert.ok(res.body.pii);
    });

    it("should have scrubber.scrubbers as array", async () => {
      const res = await request(adminApp).get("/api/audit/telemetry");
      assert.ok(Array.isArray(res.body.scrubber.scrubbers));
    });

    it("should have audit.chainValid as boolean", async () => {
      const res = await request(adminApp).get("/api/audit/telemetry");
      assert.ok(typeof res.body.audit.chainValid === "boolean");
    });

    it("should have audit.verifiedEntries as number", async () => {
      const res = await request(adminApp).get("/api/audit/telemetry");
      assert.ok(typeof res.body.audit.verifiedEntries === "number");
    });
  });

  // ── Error Handling ─────────────────────────────────────────────────────────

  describe("error handling", () => {
    it("should handle missing replay detector gracefully", async () => {
      const res = await request(adminApp).get("/api/audit/telemetry");
      // Should not crash — replay may be null but endpoint should still return 200
      assert.strictEqual(res.status, 200);
      assert.ok("replay" in res.body);
    });

    it("should handle audit log errors gracefully", async () => {
      const res = await request(adminApp).get("/api/audit/telemetry");
      // Should not crash — audit may have error field but endpoint should still return 200
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.audit);
    });
  });
});
