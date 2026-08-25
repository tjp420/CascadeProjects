#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const OUT_MD = path.join(
  process.cwd(),
  "ai-platform",
  "test-results",
  "mock-pr-comment.md",
);
const CI_DIR = path.join(process.cwd(), "ai-platform", "test-results");
const CI_SUMMARY = path.join(CI_DIR, "ci-test-summary.json");
const HISTORY = path.join(CI_DIR, "ci-telemetry-history.json");

const REGRESSION_PERCENT = Number(
  process.env.CI_TELEMETRY_REGRESSION_PERCENT || 10,
);
const REGRESSION_MS = Number(process.env.CI_TELEMETRY_REGRESSION_MS || 2000);
const TOP_N = Number(process.env.CI_TELEMETRY_TOP_N || 3);
const REPORT_MARKER = "<!-- ci-telemetry-report -->";

function safeNumber(v) {
  return typeof v === "number" ? v : v ? Number(v) : 0;
}

function computeBaseline(history, branch = "main", lookback = 7) {
  const filtered = history.filter((h) => h.branch === branch).slice(-lookback);
  if (!filtered.length) return null;
  const vals = filtered.map((h) =>
    safeNumber(h.summary && h.summary.runTimeMs),
  );
  const avg = vals.reduce((a, b) => a + (b || 0), 0) / vals.length;
  const fileMap = {};
  for (const h of filtered) {
    if (!h.summary || !Array.isArray(h.summary.testFileSummaries)) continue;
    for (const tf of h.summary.testFileSummaries) {
      const name = tf.filePath ? path.basename(tf.filePath) : "unknown";
      fileMap[name] = fileMap[name] || [];
      fileMap[name].push(safeNumber(tf.runTimeMs));
    }
  }
  const fileAvg = {};
  for (const [k, v] of Object.entries(fileMap))
    fileAvg[k] = v.reduce((a, b) => a + (b || 0), 0) / v.length;
  return { avgRunMs: avg, fileAverages: fileAvg };
}

function formatReport(current, baseline) {
  const currentRunMs = safeNumber(current.runTimeMs || 0);
  let baselineMs = baseline ? baseline.avgRunMs : null;
  let deltaMs = baselineMs ? currentRunMs - baselineMs : null;
  let deltaPct =
    baselineMs && deltaMs !== null ? (deltaMs / baselineMs) * 100 : null;
  const files = Array.isArray(current.testFileSummaries)
    ? current.testFileSummaries.slice()
    : [];
  files.sort((a, b) => (b.runTimeMs || 0) - (a.runTimeMs || 0));
  const topFiles = files
    .slice(0, TOP_N)
    .map((f) => ({
      name: path.basename(f.filePath || ""),
      runMs: safeNumber(f.runTimeMs || 0),
    }));
  const fileRows = topFiles.map((f) => {
    const base =
      baseline && baseline.fileAverages && baseline.fileAverages[f.name]
        ? baseline.fileAverages[f.name]
        : null;
    const dms = base !== null ? f.runMs - base : null;
    const dpct = base !== null && base > 0 ? (dms / base) * 100 : null;
    return {
      name: f.name,
      runMs: f.runMs,
      baseMs: base,
      deltaMs: dms,
      deltaPct: dpct,
    };
  });
  const warning =
    deltaMs !== null &&
    (Math.abs(deltaPct) >= REGRESSION_PERCENT ||
      Math.abs(deltaMs) >= REGRESSION_MS);
  let md = `${REPORT_MARKER}\n**CI Telemetry — Test Runtime Delta (Local Preview)**\n\n`;
  md += `- **Current run time**: **${currentRunMs} ms**\n`;
  if (baselineMs !== null) {
    md += `- **Baseline (main, avg last 7 runs)**: ${Math.round(baselineMs)} ms\n`;
    md += `- **Delta**: ${deltaMs >= 0 ? "+" : ""}${Math.round(deltaMs)} ms (${deltaPct !== null ? deltaPct.toFixed(1) : "N/A"}%) ${warning ? "⚠️ **REGRESSION**" : ""}\n`;
  } else {
    md += `- No baseline available (insufficient history).\n`;
  }
  md += `\n**Top ${TOP_N} slowest test files (current run)**\n\n`;
  md +=
    "| File | Current (ms) | Baseline (ms) | Delta |\n|---|---:|---:|---:|\n";
  for (const r of fileRows) {
    md += `| ${r.name} | ${Math.round(r.runMs)} | ${r.baseMs !== null ? Math.round(r.baseMs) : "N/A"} | ${r.deltaMs !== null ? (r.deltaMs >= 0 ? "+" : "") + Math.round(r.deltaMs) + " ms (" + (r.deltaPct !== null ? (r.deltaPct >= 0 ? "+" : "") + r.deltaPct.toFixed(1) + "%" : "N/A") + ")" : "N/A"} |\n`;
  }
  md +=
    "\n*This is a local preview. The CI-run comment will be updated on subsequent runs.*\n";
  return md;
}

function loadJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return null;
  }
}

function makeMockCurrent() {
  return {
    runTimeMs: 15234,
    testCount: 124,
    passed: 122,
    failed: 2,
    testFileSummaries: [
      { filePath: "tests/foo.test.js", runTimeMs: 4200 },
      { filePath: "tests/bar.test.js", runTimeMs: 3600 },
      { filePath: "tests/baz.test.js", runTimeMs: 1800 },
      { filePath: "tests/quick.test.js", runTimeMs: 120 },
    ],
  };
}

function makeMockHistory() {
  const samples = [];
  for (let i = 0; i < 7; i++) {
    samples.push({
      runId: 1000 + i,
      branch: "main",
      summary: {
        runTimeMs: 12000 + i * 100,
        testFileSummaries: [
          { filePath: "tests/foo.test.js", runTimeMs: 3500 + i * 50 },
          { filePath: "tests/bar.test.js", runTimeMs: 3000 + i * 40 },
          { filePath: "tests/baz.test.js", runTimeMs: 2000 + i * 30 },
        ],
      },
    });
  }
  return samples;
}

function ensureOutDir() {
  if (!fs.existsSync(CI_DIR)) fs.mkdirSync(CI_DIR, { recursive: true });
}

function main() {
  ensureOutDir();
  let current = loadJson(CI_SUMMARY);
  if (!current) {
    console.log(
      "No current summary found at",
      CI_SUMMARY,
      "using mock current run.",
    );
    current = makeMockCurrent();
  }
  let history = loadJson(HISTORY);
  if (!history) {
    console.log(
      "No history found at",
      HISTORY,
      "using mock history (7 entries).",
    );
    history = makeMockHistory();
  }
  const baseline = computeBaseline(history, "main", 7);
  const md = formatReport(current, baseline);
  fs.writeFileSync(OUT_MD, md, "utf8");
  console.log("Wrote mock PR comment to", OUT_MD);
  console.log("\n----- Markdown Preview -----\n");
  console.log(md);
}

main();
