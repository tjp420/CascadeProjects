#!/usr/bin/env node
// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Production Debug Artifact Guard
 * Scans production source paths for debug artifacts that should not ship.
 *
 * Usage:
 *   node tools/production-debug-guard.js [--strict] [--report <path>]
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const reportArg = args.indexOf('--report');
const reportPath = reportArg !== -1 ? args[reportArg + 1] : null;

const PRODUCTION_PATHS = ['server', 'src', 'web/simplebeacon-dashboard'];
const SKIP_DIRS = /node_modules|coverage|dist|build|\.git|\.simplebeacon|test-cert|simplebeacon-rule-tests/;
const SKIP_FILES = /\.(test|spec)\.(js|cjs|mjs|ts)|\.d\.ts$/;

const FINDINGS = [];

function shouldSkip(filePath) {
  if (SKIP_DIRS.test(filePath)) return true;
  if (SKIP_FILES.test(filePath)) return true;
  return false;
}

function scanFile(filePath) {
  if (shouldSkip(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const relative = path.relative(process.cwd(), filePath);

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    // Flag raw console.log (but allow console.error in error handlers)
    if (/console\.(log|debug|warn)\s*\(/.test(line)) {
      FINDINGS.push({
        file: relative,
        line: lineNum,
        type: 'console-log',
        snippet: line.trim().slice(0, 120)
      });
    }

    // Flag debugger statements
    if (/debugger;/.test(line)) {
      FINDINGS.push({
        file: relative,
        line: lineNum,
        type: 'debugger',
        snippet: line.trim().slice(0, 120)
      });
    }

    if (strict) {
      // In strict mode, also flag TODO/FIXME in production source
      if (/\b(TODO|FIXME|HACK|XXX)\b/.test(line) && !line.includes('simplebeacon:production-leak-intent')) {
        FINDINGS.push({
          file: relative,
          line: lineNum,
          type: 'todo-marker',
          snippet: line.trim().slice(0, 120)
        });
      }
    }
  });
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.test(fullPath)) {
        walk(fullPath);
      }
    } else if (/\.(js|cjs|mjs)$/.test(entry.name)) {
      scanFile(fullPath);
    }
  }
}

const baseDir = path.join(__dirname, '..');
process.chdir(baseDir);

for (const scanPath of PRODUCTION_PATHS) {
  const full = path.join(baseDir, scanPath);
  if (fs.existsSync(full)) {
    walk(full);
  }
}

// Also check for temp / junk files at repo root
const rootFiles = fs.readdirSync(baseDir);
for (const f of rootFiles) {
  if (/\.(tmp|temp|bak|old|copy|backup)$/i.test(f)) {
    FINDINGS.push({
      file: f,
      line: 0,
      type: 'temp-file',
      snippet: f
    });
  }
}

const report = {
  scannedAt: new Date().toISOString(),
  strict,
  totalFindings: FINDINGS.length,
  findings: FINDINGS
};

if (reportPath) {
  const outDir = path.dirname(reportPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  process.stderr.write([`Debug-artifact guard report written to ${reportPath}`].join(" ") + "\n");
}

if (FINDINGS.length === 0) {
  process.stdout.write(
    ['PASS — No debug artifacts detected in production paths.'].join(" ") + "\n"
  );
  process.exit(0);
} else {
  process.stderr.write(
    [`WARN — ${FINDINGS.length} debug artifact(s) found in production paths:`].join(" ") + "\n"
  );
  for (const f of FINDINGS.slice(0, 20)) {
    process.stderr.write([`  [${f.type}] ${f.file}:${f.line}  ${f.snippet}`].join(" ") + "\n");
  }
  if (FINDINGS.length > 20) {
    process.stderr.write([`  ... and ${FINDINGS.length - 20} more`].join(" ") + "\n");
  }
  process.exit(strict ? 1 : 0);
}
