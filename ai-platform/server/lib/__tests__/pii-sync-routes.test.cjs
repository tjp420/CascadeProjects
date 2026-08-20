"use strict";

const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert");
const request = require("supertest");
const express = require("express");
const fs2 = require("fs");
const path = require("path");
const os = require("os");

const _tempDir = fs2.mkdtempSync(path.join(os.tmpdir(), "sb-pii-sync-route-"));
const _tempPolicyPath = path.join(_tempDir, "pii-policies.json");
const _tempLogPath = path.join(_tempDir, "audit-log.json");
process.env.PII_POLICY_PATH = _tempPolicyPath;
process.env.AUDIT_LOG_PATH = _tempLogPath;
process.env.AUDIT_LOG_SCRUB_PII = "false";
fs2.writeFileSync(
  _tempPolicyPath,
  JSON.stringify({ policies: [] }, null, 2),
  "utf8",
);
fs2.writeFileSync(_tempLogPath, JSON.stringify({ entries: {} }), "utf8");

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

describe("PII Policy Sync API", () => {
  let adminApp, regularApp, piiStore;

  before(() => {
    piiStore = require("../../lib/pii-policy-store.cjs");
  });

  beforeEach(() => {
    fs2.writeFileSync(
      _tempPolicyPath,
      JSON.stringify({ policies: [] }, null, 2),
      "utf8",
    );
    jest.resetModules();
    piiStore = require("../../lib/pii-policy-store.cjs");
    piiStore.createPolicy({
      orgId: "org-source",
      name: "Email Redaction",
      description: "Redact emails",
      pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
      flags: "gi",
      replacement: "[REDACTED-EMAIL]",
      severity: "high",
      enabled: true,
      compliance: ["GDPR", "CCPA"],
      isDefault: true,
    });
    piiStore.createPolicy({
      orgId: "org-source",
      name: "SSN Redaction",
      description: "Redact SSNs",
      pattern: "\\b\\d{3}-?\\d{2}-?\\d{4}\\b",
      flags: "g",
      replacement: "[REDACTED-SSN]",
      severity: "high",
      enabled: true,
      compliance: ["GDPR", "HIPAA"],
      isDefault: false,
    });
    piiStore.createPolicy({
      orgId: "org-target-1",
      name: "Existing Policy",
      description: "Pre-existing",
      pattern: "\\b\\d{4}\\b",
      flags: "g",
      replacement: "[REDACTED]",
      severity: "low",
      enabled: true,
      compliance: [],
      isDefault: false,
    });
    adminApp = createTestApp(ADMIN_USER);
    regularApp = createTestApp(REGULAR_USER);
  });

  after(() => {
    try {
      delete process.env.PII_POLICY_PATH;
      delete process.env.AUDIT_LOG_PATH;
      delete process.env.AUDIT_LOG_SCRUB_PII;
      if (_tempDir && fs2.existsSync(_tempDir))
        fs2.rmSync(_tempDir, { recursive: true, force: true });
    } catch (e) {}
  });

  it("GET /pii/frameworks - returns supported compliance frameworks", async () => {
    const res = await request(adminApp).get("/api/audit/pii/frameworks");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.frameworks));
    assert.ok(res.body.frameworks.includes("GDPR"));
  });

  it("GET /pii/frameworks - denies non-admin users", async () => {
    const res = await request(regularApp).get("/api/audit/pii/frameworks");
    assert.strictEqual(res.status, 403);
  });

  it("GET /pii/orgs - lists all orgs with policy summaries", async () => {
    const res = await request(adminApp).get("/api/audit/pii/orgs");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.orgs.length >= 2);
    const sourceOrg = res.body.orgs.find((o) => o.orgId === "org-source");
    assert.ok(sourceOrg);
    assert.strictEqual(sourceOrg.totalPolicies, 2);
    assert.strictEqual(sourceOrg.enabledPolicies, 2);
  });

  it("GET /pii/orgs - denies non-admin users", async () => {
    const res = await request(regularApp).get("/api/audit/pii/orgs");
    assert.strictEqual(res.status, 403);
  });

  it("GET /pii/policies/:orgId - returns policies for a specific org", async () => {
    const res = await request(adminApp).get(
      "/api/audit/pii/policies/org-source",
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.orgId, "org-source");
    assert.strictEqual(res.body.policies.length, 2);
  });

  it("GET /pii/policies/:orgId - returns empty array for unknown org", async () => {
    const res = await request(adminApp).get(
      "/api/audit/pii/policies/nonexistent-org",
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.policies.length, 0);
  });

  it("POST /pii/sync-preview - previews merge mode sync to all orgs", async () => {
    const res = await request(adminApp)
      .post("/api/audit/pii/sync-preview")
      .send({ sourceOrgId: "org-source", mode: "merge" });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sourcePolicyCount, 2);
    assert.strictEqual(res.body.mode, "merge");
    const t1 = res.body.previews.find((p) => p.orgId === "org-target-1");
    assert.ok(t1);
    assert.strictEqual(t1.wouldClone, 2);
    assert.strictEqual(t1.wouldSkip, 0);
  });

  it("POST /pii/sync-preview - previews replace mode with removals", async () => {
    const res = await request(adminApp)
      .post("/api/audit/pii/sync-preview")
      .send({
        sourceOrgId: "org-source",
        mode: "replace",
        targetOrgIds: ["org-target-1"],
      });
    assert.strictEqual(res.body.mode, "replace");
    const t1 = res.body.previews.find((p) => p.orgId === "org-target-1");
    assert.strictEqual(t1.wouldRemove, 1);
    assert.strictEqual(t1.wouldClone, 2);
  });

  it("POST /pii/sync-preview - filters by compliance framework", async () => {
    const res = await request(adminApp)
      .post("/api/audit/pii/sync-preview")
      .send({ sourceOrgId: "org-source", compliance: ["HIPAA"] });
    assert.strictEqual(res.body.sourcePolicyCount, 1);
  });

  it("POST /pii/sync-preview - filters by severity", async () => {
    const res = await request(adminApp)
      .post("/api/audit/pii/sync-preview")
      .send({ sourceOrgId: "org-source", severity: ["high"] });
    assert.strictEqual(res.body.sourcePolicyCount, 2);
  });

  it("POST /pii/sync-preview - filters by isDefault", async () => {
    const res = await request(adminApp)
      .post("/api/audit/pii/sync-preview")
      .send({ sourceOrgId: "org-source", isDefault: true });
    assert.strictEqual(res.body.sourcePolicyCount, 1);
  });

  it("POST /pii/sync-preview - denies non-admin users", async () => {
    const res = await request(regularApp)
      .post("/api/audit/pii/sync-preview")
      .send({ sourceOrgId: "org-source" });
    assert.strictEqual(res.status, 403);
  });

  it("POST /pii/sync-preview - 400 when sourceOrgId missing", async () => {
    const res = await request(adminApp)
      .post("/api/audit/pii/sync-preview")
      .send({});
    assert.strictEqual(res.status, 400);
  });

  it("POST /pii/sync - executes merge sync to specific target", async () => {
    const res = await request(adminApp)
      .post("/api/audit/pii/sync")
      .send({
        sourceOrgId: "org-source",
        targetOrgIds: ["org-target-1"],
        mode: "merge",
      });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.totalCloned, 2);
    assert.strictEqual(res.body.totalSkipped, 0);
    const tp = piiStore.getPolicies("org-target-1");
    assert.strictEqual(tp.length, 3);
  });

  it("POST /pii/sync - executes replace sync removing existing policies", async () => {
    const res = await request(adminApp)
      .post("/api/audit/pii/sync")
      .send({
        sourceOrgId: "org-source",
        targetOrgIds: ["org-target-1"],
        mode: "replace",
      });
    assert.strictEqual(res.body.totalCloned, 2);
    assert.strictEqual(res.body.totalRemoved, 1);
    const tp = piiStore.getPolicies("org-target-1");
    assert.strictEqual(tp.length, 2);
    assert.ok(tp.every((p) => p.name !== "Existing Policy"));
  });

  it("POST /pii/sync - merge mode skips duplicates", async () => {
    await request(adminApp)
      .post("/api/audit/pii/sync")
      .send({
        sourceOrgId: "org-source",
        targetOrgIds: ["org-target-1"],
        mode: "merge",
      });
    const res = await request(adminApp)
      .post("/api/audit/pii/sync")
      .send({
        sourceOrgId: "org-source",
        targetOrgIds: ["org-target-1"],
        mode: "merge",
      });
    assert.strictEqual(res.body.totalCloned, 0);
    assert.strictEqual(res.body.totalSkipped, 2);
  });

  it("POST /pii/sync - syncs to all orgs when targetOrgIds not specified", async () => {
    piiStore.createPolicy({
      orgId: "org-target-2",
      name: "Test",
      description: "t",
      pattern: "\\btest\\b",
      flags: "g",
      replacement: "[T]",
      severity: "low",
      enabled: true,
      compliance: [],
      isDefault: false,
    });
    const res = await request(adminApp)
      .post("/api/audit/pii/sync")
      .send({ sourceOrgId: "org-source", mode: "merge" });
    assert.ok(res.body.targets.length >= 2);
    const t1 = piiStore.getPolicies("org-target-1");
    const t2 = piiStore.getPolicies("org-target-2");
    assert.ok(t1.some((p) => p.name === "Email Redaction"));
    assert.ok(t2.some((p) => p.name === "Email Redaction"));
  });

  it("POST /pii/sync - denies non-admin users", async () => {
    const res = await request(regularApp)
      .post("/api/audit/pii/sync")
      .send({ sourceOrgId: "org-source", targetOrgIds: ["org-target-1"] });
    assert.strictEqual(res.status, 403);
  });

  it("POST /pii/sync - 400 when sourceOrgId missing", async () => {
    const res = await request(adminApp).post("/api/audit/pii/sync").send({});
    assert.strictEqual(res.status, 400);
  });

  it("POST /pii/sync - applies compliance filter during sync", async () => {
    const res = await request(adminApp)
      .post("/api/audit/pii/sync")
      .send({
        sourceOrgId: "org-source",
        targetOrgIds: ["org-target-1"],
        mode: "replace",
        compliance: ["HIPAA"],
      });
    assert.strictEqual(res.body.totalCloned, 1);
    const tp = piiStore.getPolicies("org-target-1");
    assert.strictEqual(tp.length, 1);
    assert.strictEqual(tp[0].name, "SSN Redaction");
  });
});
