#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const OUT_DIR =
  process.env.MOCK_REPORT_DIR || path.join(process.cwd(), ".simplebeacon");
const OUT_FILE = path.join(OUT_DIR, "report.json");
const FALLBACK_REPORT = path.join(
  process.env.HOME || process.env.USERPROFILE || __dirname,
  ".vscode-insiders",
  "extensions",
  "simplebeacon.simplebeacon-vscode-3.0.464",
  "downloads",
  "1784861166180-simplebeacon-report-2026-07-24.json",
);

function nowIso(offsetSec = 0) {
  return new Date(Date.now() + offsetSec * 1000).toISOString();
}

const mock = {
  success: true,
  generatedAt: nowIso(),
  report: {
    meta: {
      project: "local-demo",
      environment: "local",
      version: "mock-1.0.0",
      scannedAt: nowIso(-60),
    },
    summary: {
      gate: { pass: true, blockingCount: 0, qualityScore: 100 },
      repositoryFilesTotal: 475,
      ruleScopedFilesAnalyzed: 557,
      topFindings: [],
    },
    metrics: {
      lastScanDurationMs: 4231,
      issuesBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
      linters: { eslint: { errors: 0, warnings: 1 } },
    },
    events: [
      {
        id: "evt-1",
        when: nowIso(-120),
        type: "scan",
        detail: "mock scan completed",
      },
    ],
  },
};

try {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(mock, null, 2));
  // Also write to the dashboard server's hardcoded fallback path so local server picks it up
  try {
    const fbDir = path.dirname(FALLBACK_REPORT);
    if (!fs.existsSync(fbDir)) fs.mkdirSync(fbDir, { recursive: true });
    fs.writeFileSync(FALLBACK_REPORT, JSON.stringify(mock, null, 2));
    console.log("✅ Also wrote fallback report to", FALLBACK_REPORT);
  } catch (e) {
    console.warn("⚠️ Could not write fallback report:", e.message);
  }
  console.log("✅ Mock report written to", OUT_FILE);
  process.exit(0);
} catch (err) {
  console.error("❌ Failed to write mock report:", err.message);
  process.exit(2);
}
