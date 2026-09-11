#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const projectRoot = process.cwd();
const reportPath = path.join(projectRoot, ".simplebeacon", "prove-report.json");
const templatePath = path.join(
  projectRoot,
  ".simplebeacon",
  "dashboard_template.html",
);
const outPath = path.join(projectRoot, ".simplebeacon", "prove-report.html");

function fail(msg) {
  console.error(msg);
  process.exit(2);
}

if (!fs.existsSync(reportPath)) fail(`Report not found: ${reportPath}`);
if (!fs.existsSync(templatePath)) fail(`Template not found: ${templatePath}`);

let dataRaw = fs.readFileSync(reportPath, "utf8");
let data;
try {
  data = JSON.parse(dataRaw);
} catch (e) {
  fail("Invalid JSON in report: " + e.message);
}

const template = fs.readFileSync(templatePath, "utf8");

// Safely embed JSON by replacing a placeholder with a JS literal. Escape '</' to avoid </script> ending.
const safeJson = JSON.stringify(data).replace(/</g, "\\u003c");
const outHtml = template.replace("DATA_PLACEHOLDER", safeJson);

fs.writeFileSync(outPath, outHtml, "utf8");
console.log("Dashboard written to", outPath);
