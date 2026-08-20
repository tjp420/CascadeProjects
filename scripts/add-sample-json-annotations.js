// simplebeacon-ignore memory-leak — JSDoc annotation processing, short-lived iterations
"use strict";

const fs = require("fs");

const ANNOTATIONS = {
  "packages/simplebeacon-cli/src/lib/page-sample-specs.js":
    " * simplebeacon:production-leak-intent — Registry of dashboard page sample JSON filenames; references are intentional spec definitions, not production data leaks.",
  "packages/simplebeacon-cli/src/lib/sample-consistency-checker.js":
    " * simplebeacon:production-leak-intent — Validates consistency of sample JSON data files; references are intentional test/sample fixture checks.",
  "packages/simplebeacon-cli/src/lib/sample-path-resolver.js":
    " * simplebeacon:production-leak-intent — Resolves paths to sample JSON files; references are intentional path-mapping for sample data.",
  "packages/simplebeacon-cli/src/analyzers/data-cleanup/data-lineage-analyzer.js":
    " * simplebeacon:production-leak-intent — **/*-sample.json is an exclusion glob for analyzer data-file classification, not a production leak.",
  "packages/simplebeacon-cli/src/analyzers/file-reduction/unused-file-detector.js":
    " * simplebeacon:production-leak-intent — **/*-sample.json is an exclusion glob for unused-file detection, not a production leak.",
  "packages/simplebeacon-cli/src/lib/marketing/marketing-content-generator.js":
    " * simplebeacon:production-leak-intent — Marketing content references sample JSON files as intentional demo data descriptions.",
  "packages/simplebeacon-cli/src/project-detect.js":
    " * simplebeacon:production-leak-intent — Detects sample JSON files for project-type identification; references are intentional signatures.",
  "packages/simplebeacon-cli/src/scan.js":
    " * simplebeacon:production-leak-intent — -sample.json is an exclusion suffix for scan path filtering, not a production leak.",
  "packages/simplebeacon-cli/src/reporters/remediation-guides.js":
    " * simplebeacon:production-leak-intent — References -sample.json as a naming convention in remediation guidance text.",
};

for (const [relPath, annotation] of Object.entries(ANNOTATIONS)) {
  const fullPath = `C:/Users/Trevor/CascadeProjects/${relPath}`;
  let content = fs.readFileSync(fullPath, "utf8");
  const lines = content.split("\n");

  // Find the first block comment and insert annotation after the description
  let inserted = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("/**")) {
      // Insert after the first non-empty description line
      for (let j = i + 1; j < lines.length && !inserted; j++) {
        if (lines[j].trim().endsWith("*/")) {
          // Insert before */
          lines.splice(j, 0, annotation);
          inserted = true;
          break;
        }
      }
      break;
    }
  }

  if (!inserted && lines[0].trim().startsWith("/**")) {
    // Fallback: insert before closing */
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].includes("*/")) {
        lines.splice(i, 0, annotation);
        inserted = true;
        break;
      }
    }
  }

  if (!inserted) {
    // Add new comment block at top
    lines.unshift("/**", annotation, " */", "");
    inserted = true;
  }

  fs.writeFileSync(fullPath, lines.join("\n"), "utf8");
}
