#!/usr/bin/env node
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const outDir = path.join(process.cwd(), ".simplebeacon");
const outFile = path.join(outDir, "prove-report.json");

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const cmd = `npx simplebeacon scan --gate --format json --output ${JSON.stringify(outFile)}`;
console.log("Running SimpleBeacon gate scan — this may take a moment...");
const child = exec(
  cmd,
  { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 10 },
  (err, stdout, stderr) => {
    if (err) {
      console.error("Scan command failed:", err.message);
      if (stderr) console.error(stderr);
      process.exit(2);
    }

    if (!fs.existsSync(outFile)) {
      console.error("Scan completed but report not found at", outFile);
      process.exit(3);
    }

    try {
      const report = JSON.parse(fs.readFileSync(outFile, "utf8"));
      const gate = report.gate || {};
      console.log("\n=== SimpleBeacon Gate Summary ===");
      console.log("Gate pass:", gate.pass === true ? "YES" : "NO");
      console.log("Blocking issues:", gate.blockingCount || 0);
      console.log("Quality score:", report.qualityScore ?? "n/a");

      const top = (report.issues || []).slice(0, 10);
      if (top.length) {
        console.log("\nTop issues (up to 10):");
        top.forEach((it, i) => {
          const sev = it.severity || it.level || "unknown";
          const title = it.title || it.message || it.rule || JSON.stringify(it);
          console.log(`${i + 1}. ${sev} — ${title}`);
        });
      } else {
        console.log("\nNo issues reported.");
      }

      process.exit(gate.pass ? 0 : 4);
    } catch (e) {
      console.error("Failed to parse report:", e.message);
      process.exit(5);
    }
  },
);

child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);
