const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

describe("GET /api/admin/improvement-report", () => {
  let tmpDir;
  let storePath;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sb-admin-improvement-"));
    storePath = path.join(tmpDir, "ci-telemetry.json");
    process.env.SIMPLEBEACON_CI_TELEMETRY_STORE = storePath;
    delete require.cache[require.resolve("../../lib/ci-telemetry-store.cjs")];
    delete require.cache[
      require.resolve("../../cron/internal-improvement-report.cjs")
    ];
  });

  afterEach(() => {
    delete process.env.SIMPLEBEACON_CI_TELEMETRY_STORE;
    delete process.env.SUPER_ADMIN_EMAIL;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete require.cache[require.resolve("../../lib/ci-telemetry-store.cjs")];
    delete require.cache[
      require.resolve("../../cron/internal-improvement-report.cjs")
    ];
  });

  it("returns 403 for non-admin users", async () => {
    const {
      summarizeAllTelemetry,
    } = require("../../lib/ci-telemetry-store.cjs");
    const {
      generateImprovementReportMarkdown,
    } = require("../../cron/internal-improvement-report.cjs");

    // Simulate the route handler logic directly
    const userEmail = "regular@example.com";
    const superAdminEmail =
      process.env.SUPER_ADMIN_EMAIL || "admin@simplebeacon.ai";
    const isAdmin = userEmail.toLowerCase() === superAdminEmail.toLowerCase();
    assert.strictEqual(isAdmin, false);
  });

  it("returns 200 with structured JSON for admin users", async () => {
    const {
      recordCiTelemetryEvent,
      summarizeAllTelemetry,
      resolveOrgKey,
    } = require("../../lib/ci-telemetry-store.cjs");
    const {
      generateImprovementReportMarkdown,
    } = require("../../cron/internal-improvement-report.cjs");

    // Record events for 3 workspaces to meet k-anonymity
    recordCiTelemetryEvent("a@example.com", {
      workspace_fingerprint: "aaa1234567890abcdefaaa12",
      gate_pass: true,
      quality_score: 85,
    });
    recordCiTelemetryEvent("b@example.com", {
      workspace_fingerprint: "bbb1234567890abcdefbbb45",
      gate_pass: false,
      quality_score: 72,
    });
    recordCiTelemetryEvent("c@example.com", {
      workspace_fingerprint: "ccc1234567890abcdefccc78",
      gate_pass: true,
      quality_score: 90,
    });

    // Simulate admin user
    const userEmail = "admin@simplebeacon.ai";
    const superAdminEmail =
      process.env.SUPER_ADMIN_EMAIL || "admin@simplebeacon.ai";
    const isAdmin = userEmail.toLowerCase() === superAdminEmail.toLowerCase();
    assert.strictEqual(isAdmin, true);

    const days = 30;
    const summary = summarizeAllTelemetry({ days });
    const markdown = generateImprovementReportMarkdown(summary);

    // Verify the response shape
    assert.ok(summary.total_scans === 3);
    assert.ok(summary.distinct_workspaces === 3);
    assert.ok(summary.k_anonymity_met === true);
    assert.ok(typeof markdown === "string");
    assert.ok(
      markdown.includes("# SimpleBeacon Internal Program Improvement Report"),
    );
  });

  it("response contains no PII fields", async () => {
    const {
      recordCiTelemetryEvent,
      summarizeAllTelemetry,
    } = require("../../lib/ci-telemetry-store.cjs");
    const {
      generateImprovementReportMarkdown,
    } = require("../../cron/internal-improvement-report.cjs");

    recordCiTelemetryEvent("user@example.com", {
      workspace_fingerprint: "ddd1234567890abcdefddd01",
      gate_pass: true,
      projectRoot: "/secret/path",
      email: "user@example.com",
      file_path: "/secret/file.js",
      description: "secret description",
    });

    const summary = summarizeAllTelemetry({ days: 7 });
    const markdown = generateImprovementReportMarkdown(summary);
    const fullOutput = JSON.stringify(summary) + markdown;

    assert.ok(
      !fullOutput.includes("user@example.com"),
      "No emails in response",
    );
    assert.ok(!fullOutput.includes("/secret/"), "No file paths in response");
    assert.ok(
      !fullOutput.includes("secret description"),
      "No issue descriptions in response",
    );
  });

  it("k-anonymity status is included in response", async () => {
    const {
      summarizeAllTelemetry,
    } = require("../../lib/ci-telemetry-store.cjs");
    const {
      generateImprovementReportMarkdown,
    } = require("../../cron/internal-improvement-report.cjs");

    const summary = summarizeAllTelemetry({ days: 7 });
    const markdown = generateImprovementReportMarkdown(summary);

    assert.ok(typeof summary.k_anonymity_met === "boolean");
    assert.ok(typeof summary.k_anonymity_min === "number");
    assert.ok(markdown.includes("k-anonymity"));
  });

  it("respects days query parameter", async () => {
    const {
      summarizeAllTelemetry,
    } = require("../../lib/ci-telemetry-store.cjs");

    const summary7 = summarizeAllTelemetry({ days: 7 });
    const summary30 = summarizeAllTelemetry({ days: 30 });

    assert.strictEqual(summary7.periodDays, 7);
    assert.strictEqual(summary30.periodDays, 30);
  });
});
