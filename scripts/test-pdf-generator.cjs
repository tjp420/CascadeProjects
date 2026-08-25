"use strict";

/**
 * Tests for Executive PDF Generator with 48 analyzers \+ 25 scan engines branding
 *
 * Verifies:
 * 1. buildExecutiveHtml includes "48 analyzers \+ 25 scan engines" branding
 * 2. Quality score bar chart is rendered
 * 3. Gate status badge uses visual badge (not just text)
 * 4. Tier footer with upgrade link is present
 * 5. Disclaimer mentions "no LLM" and "48 analyzers \+ 25 scan engines"
 * 6. Letterhead has two-column layout (title + branding)
 * 7. Cross-component messaging consistency
 *
 * Run: node --test scripts/test-pdf-generator.cjs
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.join(__dirname, "..");

function readFile(relPath) {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), "utf8");
}

// Load the module
const {
  buildExecutiveHtml,
  buildRiskProfile,
  computeFinancialLiability,
  computeComplianceGrade,
} = require(
  path.join(REPO_ROOT, "packages/simplebeacon-cli/src/lib/pdf-generator"),
);

// ═══════════════════════════════════════════════
// Test fixtures
// ═══════════════════════════════════════════════

const mockReport = {
  repositoryFilesTotal: 250,
  qualityScore: 78,
  detectedIssues: [
    {
      type: "Credential Pattern",
      severity: "critical",
      pattern: "SB-SEC-013",
      description: "Hardcoded API key in config",
      recommendedAction: "Move to environment variable",
    },
    {
      type: "Fiction KPI",
      severity: "high",
      pattern: "SB-MOCK-001",
      description: "Placeholder KPI value",
      recommendedAction: "Replace with measured baseline",
    },
    {
      type: "LLM Slop Pattern",
      severity: "medium",
      pattern: "SB-SLOP-002",
      description: "AI-generated placeholder comment",
      recommendedAction: "Remove or replace with real documentation",
    },
  ],
  gate: { pass: false, blockingCount: 2, failOn: ["high"] },
};

const mockLicenseClaims = {
  sub: "test@example.com",
  tier: "team_pro",
  jti: "test-license-id",
  exp: Math.floor(Date.now() / 1000) + 86400,
};

const mockReportClean = {
  repositoryFilesTotal: 100,
  qualityScore: 100,
  detectedIssues: [],
  gate: { pass: true, blockingCount: 0, failOn: ["high"] },
};

// ═══════════════════════════════════════════════
// 1. Branding — 48 analyzers \+ 25 scan engines
// ═══════════════════════════════════════════════

describe("PDF branding — 48 analyzers \+ 25 scan engines", () => {
  test('HTML includes "48 analyzers \+ 25 scan engines" badge', () => {
    const html = buildExecutiveHtml(mockReport, mockLicenseClaims);
    assert.match(html, /48 analyzers \+ 25 scan engines/);
  });

  test('HTML includes "catch AI code debt" tagline', () => {
    const html = buildExecutiveHtml(mockReport, mockLicenseClaims);
    assert.match(html, /catch AI code debt that traditional linting misses/);
  });

  test('HTML includes "no upload, no LLM, no false positives"', () => {
    const html = buildExecutiveHtml(mockReport, mockLicenseClaims);
    assert.match(html, /no upload, no LLM, no false positives/);
  });

  test("letterhead has two-column layout (title + branding)", () => {
    const html = buildExecutiveHtml(mockReport, mockLicenseClaims);
    assert.match(html, /letterhead-left/);
    assert.match(html, /letterhead-right/);
    assert.match(html, /engines-badge/);
  });
});

// ═══════════════════════════════════════════════
// 2. Quality Score Bar Chart
// ═══════════════════════════════════════════════

describe("quality score bar chart", () => {
  test("HTML includes quality bar container", () => {
    const html = buildExecutiveHtml(mockReport, mockLicenseClaims);
    assert.match(html, /quality-bar-container/);
  });

  test("HTML includes quality bar fill with percentage", () => {
    const html = buildExecutiveHtml(mockReport, mockLicenseClaims);
    assert.match(html, /quality-bar-fill/);
  });

  test("bar fill width is set to compliance score percentage", () => {
    const html = buildExecutiveHtml(mockReport, mockLicenseClaims);
    // The compliance grade score should be used as the bar width
    assert.match(html, /width:\d+%/);
  });
});

// ═══════════════════════════════════════════════
// 3. Gate Status Badge
// ═══════════════════════════════════════════════

describe("gate status badge", () => {
  test("fail report shows gate-fail badge with ✗", () => {
    const html = buildExecutiveHtml(mockReport, mockLicenseClaims);
    assert.match(html, /gate-fail/);
    assert.match(html, /✗ FAIL/);
  });

  test("pass report shows gate-pass badge with ✓", () => {
    const html = buildExecutiveHtml(mockReportClean, mockLicenseClaims);
    assert.match(html, /gate-pass/);
    assert.match(html, /✓ PASS/);
  });

  test("gate badge uses CSS class (not inline color)", () => {
    const html = buildExecutiveHtml(mockReport, mockLicenseClaims);
    assert.match(html, /class="gate-badge/);
  });
});

// ═══════════════════════════════════════════════
// 4. Tier Footer
// ═══════════════════════════════════════════════

describe("tier footer", () => {
  test("HTML includes tier footer section", () => {
    const html = buildExecutiveHtml(mockReport, mockLicenseClaims);
    assert.match(html, /tier-footer/);
  });

  test("tier footer shows license tier", () => {
    const html = buildExecutiveHtml(mockReport, mockLicenseClaims);
    assert.match(html, /team_pro tier/);
  });

  test("tier footer includes upgrade link to pricing page", () => {
    const html = buildExecutiveHtml(mockReport, mockLicenseClaims);
    assert.match(html, /https:\/\/simplebeacon\.ai\/pricing/);
  });

  test('tier footer mentions "48 analyzers \+ 25 scan engines"', () => {
    const html = buildExecutiveHtml(mockReport, mockLicenseClaims);
    // Find the actual tier-footer div (not the CSS class definition)
    const footerMatch = html.match(
      /<div class="tier-footer">([\s\S]*?)<\/div>/,
    );
    assert.ok(footerMatch, "tier-footer div should exist");
    assert.match(footerMatch[1], /48 analyzers \+ 25 scan engines/);
  });
});

// ═══════════════════════════════════════════════
// 5. Disclaimer
// ═══════════════════════════════════════════════

describe("disclaimer content", () => {
  test('disclaimer mentions "48 analyzers \+ 25 scan engines"', () => {
    const html = buildExecutiveHtml(mockReport, mockLicenseClaims);
    assert.match(html, /48 analyzers \+ 25 scan engines/);
  });

  test('disclaimer mentions "no LLM"', () => {
    const html = buildExecutiveHtml(mockReport, mockLicenseClaims);
    assert.match(html, /No LLM or AI narrative was used/);
  });

  test('disclaimer mentions "no source code transmitted"', () => {
    const html = buildExecutiveHtml(mockReport, mockLicenseClaims);
    assert.match(html, /No source code was transmitted/);
  });

  test("disclaimer includes license ID", () => {
    const html = buildExecutiveHtml(mockReport, mockLicenseClaims);
    assert.match(html, /test-license-id/);
  });
});

// ═══════════════════════════════════════════════
// 6. Risk Profile & Grade Logic
// ═══════════════════════════════════════════════

describe("risk profile and grade logic", () => {
  test("buildRiskProfile classifies issues into pillars", () => {
    const profile = buildRiskProfile(mockReport);
    assert.ok(
      profile.slop.count > 0 || profile.leak.count > 0,
      "should have at least one finding in a pillar",
    );
  });

  test("computeComplianceGrade returns grade and score", () => {
    const profile = buildRiskProfile(mockReport);
    const grade = computeComplianceGrade(profile);
    assert.ok(grade.score >= 0 && grade.score <= 100);
    assert.match(grade.grade, /^[A-F]$/);
    assert.ok(grade.tier);
    assert.ok(grade.color);
  });

  test("computeFinancialLiability returns total and breakdown", () => {
    const profile = buildRiskProfile(mockReport);
    const liability = computeFinancialLiability(profile);
    assert.equal(typeof liability.total, "number");
    assert.ok(Array.isArray(liability.breakdown));
  });

  test("clean report gets grade A", () => {
    const profile = buildRiskProfile(mockReportClean);
    const grade = computeComplianceGrade(profile);
    assert.equal(grade.grade, "A");
    assert.equal(grade.tier, "Low Risk");
  });
});

// ═══════════════════════════════════════════════
// 7. Syntax Validation
// ═══════════════════════════════════════════════

describe("syntax validation", () => {
  test("pdf-generator.js passes node syntax check", () => {
    const { execSync } = require("child_process");
    const filePath = path.join(
      REPO_ROOT,
      "packages/simplebeacon-cli/src/lib/pdf-generator.js",
    );
    execSync(`node -c "${filePath}"`, { stdio: "pipe" });
  });
});

// ═══════════════════════════════════════════════
// 8. Cross-Component Messaging Consistency
// ═══════════════════════════════════════════════

describe("cross-component messaging consistency", () => {
  test('PDF and CLI help both mention "48 analyzers \+ 25 scan engines"', () => {
    const html = buildExecutiveHtml(mockReport, mockLicenseClaims);
    const cli = readFile("packages/simplebeacon-cli/bin/simplebeacon.js");
    assert.match(html, /48 analyzers \+ 25 scan engines/);
    assert.match(cli, /48 analyzers \+ 25 scan engines/);
  });

  test('PDF and homepage both use "traditional linting" framing', () => {
    const html = buildExecutiveHtml(mockReport, mockLicenseClaims);
    const homepage = readFile("coming-soon/public/index.html");
    assert.match(html, /traditional linting misses/);
    assert.match(homepage, /traditional linting/i);
  });

  test('PDF and PR comment both use "48 analyzers \+ 25 scan engines"', () => {
    const html = buildExecutiveHtml(mockReport, mockLicenseClaims);
    const comment = readFile(
      "packages/simplebeacon-cli/src/reporters/github-comment.js",
    );
    assert.match(html, /48 analyzers \+ 25 scan engines/);
    assert.match(comment, /48 analyzers \+ 25 scan engines/);
  });
});
