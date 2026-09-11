#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

function usage() {
  console.log("Usage: node bin/triage-report.js [--report path] [--top N]");
  console.log("Defaults: --report ./.simplebeacon/report.json  --top 5");
}

const argv = process.argv.slice(2);
let reportPath = path.resolve(process.cwd(), ".simplebeacon/report.json");
let topN = 5;

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--report" && argv[i + 1]) {
    reportPath = path.resolve(process.cwd(), argv[++i]);
  } else if (a === "--top" && argv[i + 1]) {
    topN = parseInt(argv[++i], 10) || topN;
  } else if (a === "--help" || a === "-h") {
    usage();
    process.exit(0);
  }
}

if (!fs.existsSync(reportPath)) {
  console.error(`Report not found: ${reportPath}`);
  process.exit(2);
}

let raw;
try {
  raw = fs.readFileSync(reportPath, "utf8");
} catch (err) {
  console.error("Failed to read report:", err.message);
  process.exit(2);
}

let report;
try {
  report = JSON.parse(raw);
} catch (err) {
  console.error("Invalid JSON in report:", err.message);
  process.exit(2);
}

// Normalize findings: support different schemas
function extractFindings(r) {
  if (!r) return [];
  if (Array.isArray(r.findings)) return r.findings;
  if (Array.isArray(r.issues)) return r.issues;
  if (Array.isArray(r.results)) return r.results;
  // look for arrays nested in top-level keys
  for (const k of Object.keys(r)) {
    if (Array.isArray(r[k]) && r[k].length && r[k][0] && r[k][0].severity)
      return r[k];
  }
  return [];
}

const findings = extractFindings(report).map((f) => {
  // normalize common fields
  return {
    severity: (f.severity || f.level || f.impact || "UNKNOWN")
      .toString()
      .toUpperCase(),
    file_path: f.file_path || f.path || f.file || f.location || "<unknown>",
    line_range:
      f.line_range ||
      f.lines ||
      f.range ||
      (f.start && f.end ? `${f.start}-${f.end}` : ""),
    engine: f.engine_module || f.engine || f.check || f.rule || "<unknown>",
    message: f.message || f.title || f.description || f.violation || "",
    hint: f.remediation_hint || f.fix || f.suggestion || "",
    raw: f,
  };
});

const severityOrder = {
  CRITICAL: 5,
  BLOCKER: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
  UNKNOWN: 0,
};

findings.sort((a, b) => {
  const sa = severityOrder[a.severity] || 0;
  const sb = severityOrder[b.severity] || 0;
  if (sb !== sa) return sb - sa;
  // fallback: if raw has score/confidence
  const ca =
    (a.raw && (a.raw.score || a.raw.confidence || a.raw.priority)) || 0;
  const cb =
    (b.raw && (b.raw.score || b.raw.confidence || b.raw.priority)) || 0;
  return cb - ca;
});

const top = findings.slice(0, topN);

if (!top.length) {
  console.log("No findings detected in report.");
  process.exit(0);
}

console.log(
  "\nSimpleBeacon Triage — Top " +
    top.length +
    " findings from " +
    path.relative(process.cwd(), reportPath) +
    "\n",
);
top.forEach((f, i) => {
  console.log(`${i + 1}) [${f.severity}] ${f.engine}`);
  console.log(
    `   File: ${f.file_path}${f.line_range ? ":" + f.line_range : ""}`,
  );
  if (f.message) console.log(`   Msg:  ${f.message}`);
  if (f.hint) console.log(`   Fix:  ${f.hint}`);
  console.log("");
});

console.log(
  "Run: npx simplebeacon scan --format json --output .simplebeacon/report.json --gate  to re-scan after fixes.",
);
