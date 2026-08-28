"use strict";

/**
 * Tests for the Executive Risk Certificate generator (pdf-generator.js).
 *
 * These tests verify:
 *   1. Issue classification into the four compliance pillars
 *   2. Risk profile aggregation (counts by pillar and severity)
 *   3. Financial liability computation (severity multipliers × pillar base fines)
 *   4. Compliance grade calculation (A–F based on weighted score)
 *   5. HTML certificate generation (structure, content, gate status)
 *   6. Edge cases: empty report, no issues, all critical, missing fields
 *   7. generateExecutivePdf file I/O (writes valid HTML to disk)
 *   8. License validation (rejects when no token present)
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

const {
  buildExecutiveHtml,
  buildRiskProfile,
  computeFinancialLiability,
  computeComplianceGrade,
  validateLicense,
  generateExecutivePdf,
} = require("../src/lib/pdf-generator");

// ── Test fixtures ────────────────────────────────────────────────────────

function makeMockReport(overrides = {}) {
  return {
    projectRoot: "/test/project",
    repositoryFilesTotal: 250,
    detectedIssues: [
      {
        type: "LLM Slop Pattern",
        severity: "medium",
        description: "Markdown fence leaked into source",
        count: 3,
        recommendedAction: "Remove markdown code fences from source files",
      },
      {
        type: "Credential Pattern",
        severity: "critical",
        description: "Stripe live secret key detected in config",
        count: 1,
        recommendedAction: "Move secret to environment variable",
      },
      {
        type: "EU AI Act — AI System Indicator",
        severity: "high",
        description: "Unregistered AI system detected in production",
        count: 2,
        recommendedAction: "Register AI system per Annex III requirements",
      },
    ],
    gate: {
      pass: false,
      blockingIssues: [{ type: "Credential Pattern" }],
      warningIssues: [{ type: "LLM Slop Pattern" }],
    },
    ...overrides,
  };
}

function makeMockLicenseClaims(overrides = {}) {
  return {
    sub: "test@example.com",
    tier: "developer",
    jti: "test-token-id-123",
    exp: Math.floor(Date.now() / 1000) + 86400,
    ...overrides,
  };
}

// ── classifyIssue (via buildRiskProfile) ─────────────────────────────────

test("buildRiskProfile classifies LLM Slop issues into slop pillar", () => {
  const report = {
    detectedIssues: [
      { type: "LLM Slop Pattern", severity: "medium", description: "test", count: 1 },
    ],
  };
  const profile = buildRiskProfile(report);
  assert.equal(profile.slop.count, 1);
  assert.equal(profile.leak.count, 0);
});

test("buildRiskProfile classifies Credential issues into leak pillar", () => {
  const report = {
    detectedIssues: [
      { type: "Credential Pattern", severity: "critical", description: "Stripe key", count: 1 },
    ],
  };
  const profile = buildRiskProfile(report);
  assert.equal(profile.leak.count, 1);
  assert.equal(profile.slop.count, 0);
});

test("buildRiskProfile classifies EU AI Act issues into shadowAi pillar", () => {
  const report = {
    detectedIssues: [
      { type: "EU AI Act — AI System Indicator", severity: "high", description: "test", count: 1 },
    ],
  };
  const profile = buildRiskProfile(report);
  assert.equal(profile.shadowAi.count, 1);
});

test("buildRiskProfile classifies License Conflict issues into licensing pillar", () => {
  const report = {
    detectedIssues: [
      { type: "License Conflict", severity: "high", description: "GPL violation", count: 1 },
    ],
  };
  const profile = buildRiskProfile(report);
  assert.equal(profile.licensing.count, 1);
});

test("buildRiskProfile defaults unknown issues to slop pillar", () => {
  const report = {
    detectedIssues: [
      { type: "Unknown Weird Pattern", severity: "low", description: "mystery", count: 1 },
    ],
  };
  const profile = buildRiskProfile(report);
  assert.equal(profile.slop.count, 1);
});

test("buildRiskProfile handles empty detectedIssues", () => {
  const profile = buildRiskProfile({ detectedIssues: [] });
  assert.equal(profile.slop.count, 0);
  assert.equal(profile.leak.count, 0);
  assert.equal(profile.shadowAi.count, 0);
  assert.equal(profile.licensing.count, 0);
});

test("buildRiskProfile handles missing detectedIssues field", () => {
  const profile = buildRiskProfile({});
  assert.equal(profile.slop.count, 0);
});

test("buildRiskProfile aggregates severity counts per pillar", () => {
  const report = {
    detectedIssues: [
      { type: "Credential Pattern", severity: "critical", description: "a", count: 2 },
      { type: "Credential Pattern", severity: "high", description: "b", count: 3 },
    ],
  };
  const profile = buildRiskProfile(report);
  assert.equal(profile.leak.critical, 2);
  assert.equal(profile.leak.high, 3);
  assert.equal(profile.leak.count, 5);
});

// ── computeFinancialLiability ────────────────────────────────────────────

test("computeFinancialLiability returns zero for empty profile", () => {
  const profile = buildRiskProfile({ detectedIssues: [] });
  const liability = computeFinancialLiability(profile);
  assert.equal(liability.total, 0);
  assert.equal(liability.breakdown.length, 4);
});

test("computeFinancialLiability applies severity multipliers", () => {
  const profile = {
    slop: { count: 1, critical: 1, high: 0, medium: 0, low: 0, issues: [] },
    leak: { count: 0, critical: 0, high: 0, medium: 0, low: 0, issues: [] },
    shadowAi: { count: 0, critical: 0, high: 0, medium: 0, low: 0, issues: [] },
    licensing: { count: 0, critical: 0, high: 0, medium: 0, low: 0, issues: [] },
  };
  const liability = computeFinancialLiability(profile);
  // slop avgFinePerIncident = 150000, critical multiplier = 4.0
  assert.equal(liability.total, 150000 * 4.0);
});

test("computeFinancialLiability sums across pillars", () => {
  const profile = {
    slop: { count: 1, critical: 0, high: 1, medium: 0, low: 0, issues: [] },
    leak: { count: 1, critical: 1, high: 0, medium: 0, low: 0, issues: [] },
    shadowAi: { count: 0, critical: 0, high: 0, medium: 0, low: 0, issues: [] },
    licensing: { count: 0, critical: 0, high: 0, medium: 0, low: 0, issues: [] },
  };
  const liability = computeFinancialLiability(profile);
  // slop high: 150000 * 2.5 = 375000
  // leak critical: 250000 * 4.0 = 1000000
  assert.equal(liability.total, 375000 + 1000000);
});

// ── computeComplianceGrade ───────────────────────────────────────────────

test("computeComplianceGrade returns A for clean profile", () => {
  const profile = buildRiskProfile({ detectedIssues: [] });
  const grade = computeComplianceGrade(profile);
  assert.equal(grade.grade, "A");
  assert.equal(grade.tier, "Low Risk");
  assert.equal(grade.score, 100);
  assert.equal(grade.totalFindings, 0);
});

test("computeComplianceGrade returns F for heavily loaded profile", () => {
  const profile = {
    slop: { count: 10, critical: 5, high: 5, medium: 0, low: 0, issues: [] },
    leak: { count: 0, critical: 0, high: 0, medium: 0, low: 0, issues: [] },
    shadowAi: { count: 0, critical: 0, high: 0, medium: 0, low: 0, issues: [] },
    licensing: { count: 0, critical: 0, high: 0, medium: 0, low: 0, issues: [] },
  };
  const grade = computeComplianceGrade(profile);
  // score = 100 - (5*25 + 5*10) = 100 - 175 = -75 → clamped to 0
  assert.equal(grade.grade, "F");
  assert.equal(grade.tier, "Critical Risk");
  assert.equal(grade.score, 0);
});

test("computeComplianceGrade returns B for moderate findings", () => {
  const profile = {
    slop: { count: 3, critical: 0, high: 1, medium: 2, low: 0, issues: [] },
    leak: { count: 0, critical: 0, high: 0, medium: 0, low: 0, issues: [] },
    shadowAi: { count: 0, critical: 0, high: 0, medium: 0, low: 0, issues: [] },
    licensing: { count: 0, critical: 0, high: 0, medium: 0, low: 0, issues: [] },
  };
  const grade = computeComplianceGrade(profile);
  // score = 100 - (1*10 + 2*3) = 100 - 16 = 84 → B
  assert.equal(grade.grade, "B");
  assert.equal(grade.tier, "Moderate Risk");
  assert.equal(grade.score, 84);
});

test("computeComplianceGrade returns C for high findings", () => {
  const profile = {
    slop: { count: 5, critical: 0, high: 3, medium: 2, low: 0, issues: [] },
    leak: { count: 0, critical: 0, high: 0, medium: 0, low: 0, issues: [] },
    shadowAi: { count: 0, critical: 0, high: 0, medium: 0, low: 0, issues: [] },
    licensing: { count: 0, critical: 0, high: 0, medium: 0, low: 0, issues: [] },
  };
  const grade = computeComplianceGrade(profile);
  // score = 100 - (3*10 + 2*3) = 100 - 36 = 64 → C
  assert.equal(grade.grade, "C");
  assert.equal(grade.tier, "High Risk");
  assert.equal(grade.score, 64);
});

// ── buildExecutiveHtml ───────────────────────────────────────────────────

test("buildExecutiveHtml produces valid HTML document", () => {
  const report = makeMockReport();
  const claims = makeMockLicenseClaims();
  const html = buildExecutiveHtml(report, claims);
  assert.ok(html.includes("<!DOCTYPE html>"));
  assert.ok(html.includes("</html>"));
});

test("buildExecutiveHtml includes license holder email", () => {
  const report = makeMockReport();
  const claims = makeMockLicenseClaims({ sub: "ceo@company.com" });
  const html = buildExecutiveHtml(report, claims);
  assert.ok(html.includes("ceo@company.com"));
});

test("buildExecutiveHtml includes tier label", () => {
  const report = makeMockReport();
  const claims = makeMockLicenseClaims({ tier: "team_pro" });
  const html = buildExecutiveHtml(report, claims);
  assert.ok(html.includes("team_pro"));
});

test("buildExecutiveHtml shows PASS when gate passes", () => {
  const report = makeMockReport({ gate: { pass: true, blockingIssues: [], warningIssues: [] } });
  const claims = makeMockLicenseClaims();
  const html = buildExecutiveHtml(report, claims);
  assert.ok(html.includes("PASS"));
});

test("buildExecutiveHtml shows FAIL when gate fails", () => {
  const report = makeMockReport({ gate: { pass: false, blockingIssues: [{ type: "x" }], warningIssues: [] } });
  const claims = makeMockLicenseClaims();
  const html = buildExecutiveHtml(report, claims);
  assert.ok(html.includes("FAIL"));
});

test("buildExecutiveHtml includes all four pillar names", () => {
  const report = makeMockReport();
  const claims = makeMockLicenseClaims();
  const html = buildExecutiveHtml(report, claims);
  assert.ok(html.includes("AI Slop & Hallucination Tracking"));
  assert.ok(html.includes("Sensitive Data & API Key Leak Prevention"));
  assert.ok(html.includes("Shadow AI System Detection"));
  assert.ok(html.includes("Open-Source Licensing & IP Verification"));
});

test("buildExecutiveHtml includes files scanned count", () => {
  const report = makeMockReport({ repositoryFilesTotal: 500 });
  const claims = makeMockLicenseClaims();
  const html = buildExecutiveHtml(report, claims);
  assert.ok(html.includes("500"));
});

test("buildExecutiveHtml includes remediation actions", () => {
  const report = makeMockReport();
  const claims = makeMockLicenseClaims();
  const html = buildExecutiveHtml(report, claims);
  assert.ok(html.includes("Remove markdown code fences"));
});

test("buildExecutiveHtml includes disclaimer", () => {
  const report = makeMockReport();
  const claims = makeMockLicenseClaims();
  const html = buildExecutiveHtml(report, claims);
  assert.ok(html.includes("Disclaimer"));
  assert.ok(html.includes("not constitute legal advice"));
});

test("buildExecutiveHtml handles empty report with no issues", () => {
  const report = { detectedIssues: [], gate: { pass: true }, repositoryFilesTotal: 0 };
  const claims = makeMockLicenseClaims();
  const html = buildExecutiveHtml(report, claims);
  assert.ok(html.includes("<!DOCTYPE html>"));
  assert.ok(html.includes("No quantifiable liability detected"));
});

test("buildExecutiveHtml handles missing gate object", () => {
  const report = { detectedIssues: [] };
  const claims = makeMockLicenseClaims();
  const html = buildExecutiveHtml(report, claims);
  assert.ok(html.includes("<!DOCTYPE html>"));
});

test("buildExecutiveHtml includes license ID and expiry", () => {
  const report = makeMockReport();
  const claims = makeMockLicenseClaims({ jti: "unique-id-abc", exp: 1700000000 });
  const html = buildExecutiveHtml(report, claims);
  assert.ok(html.includes("unique-id-abc"));
});

// ── validateLicense ──────────────────────────────────────────────────────

test("validateLicense returns invalid when no token is set", () => {
  // Clear any existing token and license file locations
  const origToken = process.env.SIMPLEBEACON_LICENSE_TOKEN;
  delete process.env.SIMPLEBEACON_LICENSE_TOKEN;
  // On Windows, os.homedir() uses USERPROFILE, not HOME
  const origHome = process.env.HOME;
  const origUserProfile = process.env.USERPROFILE;
  process.env.HOME = os.tmpdir();
  process.env.USERPROFILE = os.tmpdir();
  try {
    const result = validateLicense();
    assert.equal(result.valid, false);
    assert.ok(result.error);
  } finally {
    if (origToken) process.env.SIMPLEBEACON_LICENSE_TOKEN = origToken;
    if (origHome) process.env.HOME = origHome;
    if (origUserProfile) process.env.USERPROFILE = origUserProfile;
  }
});

// ── generateExecutivePdf (file I/O) ──────────────────────────────────────

test("generateExecutivePdf writes valid HTML file to disk", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sb-pdf-test-"));
  const reportPath = path.join(tmpDir, "report.json");
  const outputPath = path.join(tmpDir, "certificate.html");

  const report = makeMockReport();
  fs.writeFileSync(reportPath, JSON.stringify(report));

  // Use the default dev secret (module captures SECRET at load time)
  const DEV_SECRET = "simplebeacon-dev-insecure";
  const { generateLicenseToken } = require("../src/lib/license-token");
  const token = generateLicenseToken(
    { email: "test@example.com", tier: "developer" },
    DEV_SECRET,
    60,
  );
  process.env.SIMPLEBEACON_LICENSE_TOKEN = token;

  try {
    const result = await generateExecutivePdf(reportPath, outputPath);
    assert.equal(result.ok, true);
    assert.ok(fs.existsSync(outputPath));
    const html = fs.readFileSync(outputPath, "utf8");
    assert.ok(html.includes("<!DOCTYPE html>"));
    assert.ok(html.includes("Executive Risk Certificate"));
  } finally {
    delete process.env.SIMPLEBEACON_LICENSE_TOKEN;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("generateExecutivePdf returns error for missing report file", async () => {
  const DEV_SECRET = "simplebeacon-dev-insecure";
  const { generateLicenseToken } = require("../src/lib/license-token");
  const token = generateLicenseToken(
    { email: "test@example.com", tier: "developer" },
    DEV_SECRET,
    60,
  );
  process.env.SIMPLEBEACON_LICENSE_TOKEN = token;

  try {
    const result = await generateExecutivePdf("/nonexistent/report.json", "/tmp/out.html");
    assert.equal(result.ok, false);
    assert.ok(result.error.includes("Report not found"));
  } finally {
    delete process.env.SIMPLEBEACON_LICENSE_TOKEN;
  }
});

test("generateExecutivePdf returns error for invalid JSON report", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sb-pdf-test-"));
  const reportPath = path.join(tmpDir, "bad-report.json");
  const outputPath = path.join(tmpDir, "out.html");

  fs.writeFileSync(reportPath, "{ not valid json }");

  const DEV_SECRET = "simplebeacon-dev-insecure";
  const { generateLicenseToken } = require("../src/lib/license-token");
  const token = generateLicenseToken(
    { email: "test@example.com", tier: "developer" },
    DEV_SECRET,
    60,
  );
  process.env.SIMPLEBEACON_LICENSE_TOKEN = token;

  try {
    const result = await generateExecutivePdf(reportPath, outputPath);
    assert.equal(result.ok, false);
    assert.ok(result.error.includes("Invalid JSON"));
  } finally {
    delete process.env.SIMPLEBEACON_LICENSE_TOKEN;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("generateExecutivePdf returns error when no license token is set", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sb-pdf-test-"));
  const reportPath = path.join(tmpDir, "report.json");
  fs.writeFileSync(reportPath, JSON.stringify(makeMockReport()));

  const origToken = process.env.SIMPLEBEACON_LICENSE_TOKEN;
  delete process.env.SIMPLEBEACON_LICENSE_TOKEN;
  const origHome = process.env.HOME;
  const origUserProfile = process.env.USERPROFILE;
  process.env.HOME = os.tmpdir();
  process.env.USERPROFILE = os.tmpdir();

  try {
    const result = await generateExecutivePdf(reportPath, path.join(tmpDir, "out.html"));
    assert.equal(result.ok, false);
    assert.ok(result.error.includes("No license token"));
  } finally {
    if (origToken) process.env.SIMPLEBEACON_LICENSE_TOKEN = origToken;
    if (origHome) process.env.HOME = origHome;
    if (origUserProfile) process.env.USERPROFILE = origUserProfile;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
