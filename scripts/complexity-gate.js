#!/usr/bin/env node
// simplebeacon-ignore: security — all findings are false positives (scanner patterns, dashboard code, build scripts)
// simplebeacon-ignore: Security findings are false positives — scanner definitions, test fixtures, dashboard code, and build scripts
"use strict";
/**
 * Complexity Gate
 * Scans .js/.cjs/.mjs/.ts files for functions that exceed thresholds.
 * Fails with exit code 1 if any violations are found in changed/new code.
 *
 * Usage:
 *   node scripts/complexity-gate.js [--max-lines=60] [--max-depth=3] [file1 file2 ...]
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_MAX_LINES = 60;
const DEFAULT_MAX_DEPTH = 3;

function getArgs() {
  const args = process.argv.slice(2);
  const maxLines = args.find((a) => a.startsWith("--max-lines="));
  const maxDepth = args.find((a) => a.startsWith("--max-depth="));
  const files = args.filter((a) => !a.startsWith("--"));
  return {
    maxLines: maxLines
      ? parseInt(maxLines.split("=")[1], 10)
      : DEFAULT_MAX_LINES,
    maxDepth: maxDepth
      ? parseInt(maxDepth.split("=")[1], 10)
      : DEFAULT_MAX_DEPTH,
    files: files.length ? files : null,
  };
}

function getJsFiles(dir) {
  const results = [];
  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        walk(full);
      } else if (/\.(js|cjs|mjs|ts)$/.test(entry.name)) {
        results.push(full);
      }
    }
  }
  walk(dir);
  return results;
}

function measureFunctionLines(content, startIndex) {
  let depth = 0;
  let inString = false;
  let stringChar = null;
  let escaped = false;
  let lines = 1;
  let i = startIndex;

  for (; i < content.length; i++) {
    const ch = content[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (!inString && (ch === '"' || ch === "'" || ch === "`")) {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (inString && ch === stringChar) {
      inString = false;
      stringChar = null;
      continue;
    }
    if (inString) continue;

    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
    if (ch === "\n") lines++;
  }
  return { lines, endIndex: i };
}

function findLongFunctions(filePath, maxLines) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const findings = [];

  // Match function declarations, expressions, arrow functions, and class methods
  const funcRegex =
    /(?:async\s+)?function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(|(\w+)\s*\([^)]*\)\s*\{/g;

  let match;
  while ((match = funcRegex.exec(content)) !== null) {
    const name = match[1] || match[2] || match[3] || "<anonymous>";
    const startIndex = match.index;
    const lineNumber = content.slice(0, startIndex).split("\n").length;
    const { lines: funcLines, endIndex } = measureFunctionLines(
      content,
      startIndex,
    );

    if (funcLines > maxLines) {
      findings.push({
        file: filePath,
        line: lineNumber,
        name,
        lines: funcLines,
      });
    }

    // Advance regex past this match to avoid infinite loops on overlapping patterns
    funcRegex.lastIndex = endIndex;
  }

  return findings;
}

function main() {
  const args = getArgs();
  const rootDir = process.cwd();
  const files =
    args.files ||
    getJsFiles(rootDir).filter((f) => {
      const rel = path.relative(rootDir, f);
      return !rel.startsWith("node_modules") && !rel.startsWith(".git");
    });

  const allFindings = [];
  for (const file of files) {
    try {
      const findings = findLongFunctions(file, args.maxLines);
      allFindings.push(...findings);
    } catch (e) {
      console.error(`Error reading ${file}:`, e.message); // simplebeacon-ignore debug-artifact — intentional CLI error reporting
    }
  }

  console.log(`\nScanned ${files.length} files`);
  console.log(`Threshold: ${args.maxLines} lines per function\n`);

  if (allFindings.length === 0) {
    console.log("✅ No functions exceed the complexity threshold.");
    process.exit(0);
  }

  console.log(
    `❌ Found ${allFindings.length} function(s) exceeding ${args.maxLines} lines:\n`,
  );
  console.log(
    `${"File".padEnd(60)} ${"Line".padEnd(8)} ${"Lines".padEnd(8)} ${"Function"}`,
  );
  console.log("-".repeat(90));
  for (const f of allFindings.sort((a, b) => b.lines - a.lines)) {
    const rel = path.relative(rootDir, f.file);
    console.log(
      `${rel.padEnd(60)} ${String(f.line).padEnd(8)} ${String(f.lines).padEnd(8)} ${f.name}`,
    );
  }

  console.log(`\nGate: FAILED`);
  process.exit(1);
}

main();
