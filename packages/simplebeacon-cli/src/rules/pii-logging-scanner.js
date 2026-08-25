/**
 * PII (Personally Identifiable Information) logging scanner (SB-SEC-010).
 * Detects logging or console output of sensitive user data:
 * emails, SSNs, credit cards, phone numbers, passwords, tokens.
 */

const fs = require("fs");
const path = require("path");

const SCANNABLE_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".jsx",
  ".py",
  ".go",
  ".java",
  ".rb",
  ".php",
]);

const MAX_SCAN_BYTES = 512000;

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "coverage",
  "dist",
  "build",
  "archive",
  ".simplebeacon",
  "fixtures",
  "docs",
  "coming-soon",
  "reports",
  "simplebeacon-rule-tests",
  "simplebeacon-toxic-fixtures",
]);

const SKIP_FILES = /\.(test|spec)\.(js|cjs|mjs|ts|tsx)$/i;

const PII_PATTERNS = [
  {
    id: "SB-SEC-010",
    name: "Email Address Logged",
    regex:
      /(?:console\.(log|warn|error|info|debug)|logger\.|log\(|winston\.|pino\.|bunyan\.)[^;]*(?:email|mail|e_mail)[^;]*/i,
    severity: "medium",
    description: "Email address may be logged — GDPR/privacy violation risk",
  },
  {
    id: "SB-SEC-010b",
    name: "Password Logged",
    regex:
      /(?:console\.(log|warn|error|info|debug)|logger\.|log\(|winston\.|pino\.|bunyan\.)[^;]*(?:password|passwd|pwd|secret|token|api_key|apikey)[^;]*/i,
    severity: "high",
    description:
      "Credential field may be logged — rotate and remove immediately",
  },
  {
    id: "SB-SEC-010c",
    name: "SSN / National ID Logged",
    regex:
      /(?:console\.(log|warn|error|info|debug)|logger\.|log\(|winston\.|pino\.|bunyan\.)[^;]*(?:ssn|social[_-]?security|national[_-]?id|passport)[^;]*/i,
    severity: "critical",
    description: "Government ID logged — severe compliance violation",
  },
  {
    id: "SB-SEC-010d",
    name: "Credit Card Logged",
    regex:
      /(?:console\.(log|warn|error|info|debug)|logger\.|log\(|winston\.|pino\.|bunyan\.)[^;]*(?:credit[_-]?card|cc[_-]?num|card[_-]?num|cvv|cvc)[^;]*/i,
    severity: "critical",
    description: "Payment card data logged — PCI-DSS violation",
  },
  {
    id: "SB-SEC-010e",
    name: "Phone Number Logged",
    regex:
      /(?:console\.(log|warn|error|info|debug)|logger\.|log\(|winston\.|pino\.|bunyan\.)[^;]*(?:phone|mobile|cell|tel)[^;]*/i,
    severity: "medium",
    description:
      "Phone number may be logged — privacy/data minimization concern",
  },
  {
    id: "SB-SEC-010f",
    name: "Full Request Body Logged",
    regex:
      /(?:console\.(log|warn|error|info|debug)|logger\.|log\(|winston\.|pino\.|bunyan\.)[^;]*(?:req\.body|request\.body|body\b)[^;]*/i,
    severity: "medium",
    description:
      "Full request body logged — may contain unfiltered PII/sensitive data",
  },
];

const SAFE_PATTERNS = [
  /\/\/\s*(?:simplebeacon-ignore|eslint-disable|nosec)/i,
  /process\.env\./i,
  /typeof\s+\w+/i,
  /redact|mask|sanitize|scrub|hash/i,
  /\[REDACTED\]|\[MASKED\]/i,
  // Skip static strings that are clearly help text or usage messages
  /console\.(log|warn|error|info|debug)\s*\(\s*['"`][^'"`]*(?:Usage|usage|help|deprecated|deprecated|warn|warning|info|debug)/i,
  // Skip error constructor calls (new Error('Email not found'))
  /new\s+(Error|TypeError|RangeError)\s*\(/i,
];

// Skip if the log only contains static string literals (no variables)
function isStaticStringOnly(line) {
  // Match console.log('something') or logger.info("something") — only quoted strings, no variables or interpolation
  return /(?:console\.(log|warn|error|info|debug)|logger\.|log\(|winston\.|pino\.|bunyan\.)[^;]*\(\s*['"`][^'"`${]*['"`]\s*\)/.test(
    line,
  );
}

function isScannable(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!SCANNABLE_EXTENSIONS.has(ext)) return false;
  if (SKIP_FILES.test(path.basename(filePath))) return false;
  return true;
}

function isExcludedPath(filePath, rootDir) {
  const rel = filePath.replace(rootDir, "").replace(/^[/\\]+/, "");
  const firstDir = rel.split(/[/\\]/)[0];
  if (SKIP_DIRS.has(firstDir)) return true;
  if (/simplebeacon-cli[/\\]src[/\\](rules|lib)/.test(rel)) return true;
  if (/ai-platform[/\\]tools[/\\]/.test(rel)) return true;
  return false;
}

function isSafeLogging(line) {
  return SAFE_PATTERNS.some((pat) => pat.test(line));
}

async function scanFile(filePath) {
  let stats;
  try {
    stats = await fs.promises.stat(filePath);
  } catch {
    return null;
  }
  if (stats.size > MAX_SCAN_BYTES) return null;

  let content;
  try {
    content = await fs.promises.readFile(filePath, "utf8");
  } catch {
    return null;
  }

  const SUPPRESS_PATTERN = /\/\/\s*simplebeacon-ignore\s+pii-logging/i;
  const lines = content.split("\n");

  // File-level suppression: skip entire file if simplebeacon-ignore pii-logging appears anywhere
  if (lines.some((line) => SUPPRESS_PATTERN.test(line))) return null;

  const findings = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (SUPPRESS_PATTERN.test(line)) continue;

    // Skip if it already looks safe
    if (isSafeLogging(line)) continue;
    // Skip static string-only logs (e.g. console.log('Usage: ...'))
    if (isStaticStringOnly(line)) continue;

    for (const rule of PII_PATTERNS) {
      if (rule.regex.test(line)) {
        rule.regex.lastIndex = 0;
        findings.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          line: i + 1,
          match: line.slice(0, 80),
          snippet: line.replace(/\s+/g, " ").trim().slice(0, 120),
        });
      }
    }
  }

  return findings.length ? findings : null;
}

async function scanPiiLogging(rootDir, options = {}) {
  const results = [];
  const skipDirs = new Set([...SKIP_DIRS, ...(options.skipDirs || [])]);
  const maxDepth = options.maxDepth ?? 30;

  const stack = [{ dir: path.resolve(rootDir), depth: 0 }];
  const visited = new Set();

  while (stack.length > 0) {
    const { dir, depth } = stack.pop();
    if (depth > maxDepth) continue;
    if (visited.has(dir)) continue;
    visited.add(dir);

    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) continue;
        stack.push({ dir: fullPath, depth: depth + 1 });
        continue;
      }
      if (!entry.isFile()) continue;
      if (!isScannable(fullPath)) continue;
      if (isExcludedPath(fullPath, rootDir)) continue;

      const fileFindings = await scanFile(fullPath);
      if (fileFindings) {
        results.push({
          filePath: fullPath,
          findings: fileFindings,
        });
      }
    }
  }

  return {
    rule: "PII_LOGGING",
    severity: results.length ? "medium" : "none",
    count: results.reduce((sum, r) => sum + r.findings.length, 0),
    fileCount: results.length,
    results,
    humanReadable: results.length
      ? `Potential PII logging found in ${results.length} file(s). Review logging for email, passwords, SSN, or credit card data.`
      : "No PII logging patterns detected.",
  };
}

module.exports = { scanPiiLogging, PII_PATTERNS };
