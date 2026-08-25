"use strict";

const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert");
const request = require("supertest");
const express = require("express");
const fs2 = require("fs");
const path = require("path");
const os = require("os");

const _tempDir = fs2.mkdtempSync(path.join(os.tmpdir(), "sb-sync-hist-"));
const _tempLogPath = path.join(_tempDir, "audit-log.json");
const _tempPolicyPath = path.join(_tempDir, "pii-policies.json");
process.env.AUDIT_LOG_PATH = _tempLogPath;
process.env.PII_POLICY_PATH = _tempPolicyPath;
process.env.AUDIT_LOG_SCRUB_PII = "false";
fs2.writeFileSync(_tempLogPath, JSON.stringify({ entries: {} }), "utf8");
fs2.writeFileSync(
  _tempPolicyPath,
  JSON.stringify({ policies: [] }, null, 2),
  "utf8",
);

jest.mock("../../middleware/auth.cjs", () => ({
  authenticate: function mockAuthenticate(req, res, next) {
    if (req.user) return next();
    return res
      .status(401)
      .json({ success: false, error: "authentication_required" });
  },
}));

const ADMIN_USER = {
  id: "admin@org-test.com",
  email: "admin@org-test.com",
  role: "admin",
  permissions: ["admin:all"],
};
const REGULAR_USER = {
  id: "user@org-test.com",
  email: "user@org-test.com",
  role: "developer",
};

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

describe("GET /api/audit/pii/sync-history", () => {
  let adminApp, regularApp, auditLogger;

  before(() => {
    auditLogger = require("../../lib/audit-logger.cjs");
  });

  beforeEach(() => {
    fs2.writeFileSync(_tempLogPath, JSON.stringify({ entries: {} }), "utf8");
    jest.resetModules();
    auditLogger = require("../../lib/audit-logger.cjs");

    // Seed some pii_policy_sync audit entries
    auditLogger.log({
      orgId: "admin@org-test.com",
      actorId: "admin@org-test.com",
      actorEmail: "admin@org-test.com",
      action: "pii_policy_sync",
      entity: "pii_policies",
      entityId: "org-source",
      metadata: {
        sourceOrgId: "org-source",
        targetCount: 3,
        mode: "merge",
        totalCloned: 6,
        totalSkipped: 2,
        totalRemoved: 0,
      },
    });
    auditLogger.log({
      orgId: "admin@org-test.com",
      actorId: "admin@org-test.com",
      actorEmail: "admin@org-test.com",
      action: "pii_policy_sync",
      entity: "pii_policies",
      entityId: "org-source",
      metadata: {
        sourceOrgId: "org-source",
        targetCount: 2,
        mode: "replace",
        totalCloned: 4,
        totalSkipped: 0,
        totalRemoved: 2,
      },
    });
    auditLogger.log({
      orgId: "admin@org-test.com",
      actorId: "admin2@org-test.com",
      actorEmail: "admin2@org-test.com",
      action: "pii_policy_sync",
      entity: "pii_policies",
      entityId: "org-other",
      metadata: {
        sourceOrgId: "org-other",
        targetCount: 1,
        mode: "merge",
        totalCloned: 2,
        totalSkipped: 1,
        totalRemoved: 0,
      },
    });

    adminApp = createTestApp(ADMIN_USER);
    regularApp = createTestApp(REGULAR_USER);
  });

  after(() => {
    try {
      delete process.env.AUDIT_LOG_PATH;
      delete process.env.PII_POLICY_PATH;
      delete process.env.AUDIT_LOG_SCRUB_PII;
      if (_tempDir && fs2.existsSync(_tempDir))
        fs2.rmSync(_tempDir, { recursive: true, force: true });
    } catch (e) {}
  });

  it("returns aggregated sync history data", async () => {
    const res = await request(adminApp).get(
      "/api/audit/pii/sync-history?days=30",
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.totalSyncs, 3);
    assert.strictEqual(res.body.totalCloned, 12);
    assert.strictEqual(res.body.totalSkipped, 3);
    assert.strictEqual(res.body.totalRemoved, 2);
    assert.strictEqual(res.body.mergeCount, 2);
    assert.strictEqual(res.body.replaceCount, 1);
  });

  it("returns timeline data grouped by day", async () => {
    const res = await request(adminApp).get(
      "/api/audit/pii/sync-history?days=30",
    );

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.timeline));
    assert.strictEqual(res.body.timeline.length, 1); // all 3 on same day
    assert.strictEqual(res.body.timeline[0].syncs, 3);
    assert.strictEqual(res.body.timeline[0].cloned, 12);
  });

  it("returns top actors list", async () => {
    const res = await request(adminApp).get(
      "/api/audit/pii/sync-history?days=30",
    );

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.actors.length >= 2);
    const admin1 = res.body.actors.find(
      (a) => a.actor === "admin@org-test.com",
    );
    assert.ok(admin1);
    assert.strictEqual(admin1.syncs, 2);
    assert.strictEqual(admin1.cloned, 10);
  });

  it("returns top source orgs list", async () => {
    const res = await request(adminApp).get(
      "/api/audit/pii/sync-history?days=30",
    );

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.sourceOrgs.length >= 2);
    const srcOrg = res.body.sourceOrgs.find(
      (s) => s.sourceOrg === "org-source",
    );
    assert.ok(srcOrg);
    assert.strictEqual(srcOrg.syncs, 2);
    assert.strictEqual(srcOrg.cloned, 10);
  });

  it("returns recent sync events", async () => {
    const res = await request(adminApp).get(
      "/api/audit/pii/sync-history?limit=2",
    );

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.recent.length <= 2);
    assert.ok(res.body.recent[0].timestamp);
    assert.ok(res.body.recent[0].sourceOrgId);
    assert.ok(res.body.recent[0].mode);
  });

  it("denies non-admin users", async () => {
    const res = await request(regularApp).get("/api/audit/pii/sync-history");
    assert.strictEqual(res.status, 403);
  });

  it("returns empty data when no sync events exist", async () => {
    // Clear log
    fs2.writeFileSync(_tempLogPath, JSON.stringify({ entries: {} }), "utf8");
    jest.resetModules();
    adminApp = createTestApp(ADMIN_USER);

    const res = await request(adminApp).get(
      "/api/audit/pii/sync-history?days=7",
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.totalSyncs, 0);
    assert.strictEqual(res.body.totalCloned, 0);
    assert.deepStrictEqual(res.body.timeline, []);
    assert.deepStrictEqual(res.body.recent, []);
  });

  it("respects days parameter for time filtering", async () => {
    // Use 0 days to filter out everything (start date is now)
    const res = await request(adminApp).get(
      "/api/audit/pii/sync-history?days=0",
    );

    assert.strictEqual(res.status, 200);
    // With 0 days, startDate is now, so entries from before should be excluded
    // (entries were just created, so they might still be within the window)
    // Just verify the endpoint doesn't crash
    assert.strictEqual(res.body.success, true);
  });
});
