/**
 * Weak crypto / insecure random scanner (SB-SEC-006).
 * Detects deprecated hash algorithms, weak PRNG usage, and
 * insecure token generation patterns.
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
  "tests",
  "test",
  "__tests__",
  "fixtures",
  "docs",
  "coming-soon",
  "reports",
  "security-reports",
  "templates",
  "simplebeacon-rule-tests",
  "simplebeacon-toxic-fixtures",
]);

const SKIP_FILES = /\.(test|spec)\.(js|cjs|mjs|ts|tsx)$/i;

const SUPPRESS_PATTERN = /\/\/\s*simplebeacon-ignore\s+weak-crypto/i;

// Security-related keywords — only flag Math.random near these contexts
const SECURITY_CONTEXT =
  /\b(password|token|salt|nonce|secret|key|auth|cipher|encrypt|crypt|hash|uuid|session|csrf|otp|pin|credential)\b/i;

const RULES = [
  {
    id: "SB-SEC-006",
    name: "Weak Hash Algorithm",
    regex:
      /(?:createHash|Hash|\.hash)\s*\(\s*['"`](md5|sha1|ripemd160)['"`]|(?:md5|sha1)\s*\(|require\(['"`](crypto-js\/md5|crypto-js\/sha1)['"`]/gi,
    severity: "medium",
    description:
      "MD5, SHA1, or RIPEMD160 are cryptographically broken — use SHA-256 or SHA-3",
    skipPatterns: [
      /\/\/\s*(?:simplebeacon-ignore|eslint-disable)/i,
      /legacy|backward.?compat|compatibility/i,
    ],
  },
  {
    id: "SB-SEC-006b",
    name: "Weak Random for Security",
    regex:
      /(?:Math\.random\(\)|Math\.floor\s*\(\s*Math\.random|parseInt\([^)]*Math\.random)/gi,
    severity: "medium",
    description:
      "Math.random() is not cryptographically secure — use crypto.randomBytes() or crypto.getRandomValues() for tokens/IDs",
    skipPatterns: [
      /\/\/\s*(?:simplebeacon-ignore|eslint-disable)/i,
      /test|spec|fixture|demo|example|sample|visual|animation|game|position|color|style|css|height|width|opacity/i,
    ],
    requireSecurityContext: true,
  },
  {
    id: "SB-SEC-006c",
    name: "Insecure Token Generation",
    regex:
      /(?:uuidv1\(|uuid\.v1\(|uuidv4.*Math\.random|crypto\.createHash\(['"`]sha1['"`]\).*update)/gi,
    severity: "medium",
    description:
      "Token or ID generation using weak or predictable sources — use crypto.randomUUID() or crypto.randomBytes()",
    skipPatterns: [/\/\/\s*(?:simplebeacon-ignore|eslint-disable)/i],
  },
];

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
  return false;
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

  const findings = [];
  const lines = content.split("\n");

  for (const rule of RULES) {
    rule.regex.lastIndex = 0;
    const matches = content.matchAll(rule.regex);
    for (const match of matches) {
      const lineNum = content.substring(0, match.index).split("\n").length;
      const lineText = lines[lineNum - 1] || "";

      // Skip if suppression comment on this line
      if (SUPPRESS_PATTERN.test(lineText)) continue;

      const snippet = content.substring(
        Math.max(0, match.index - 120),
        Math.min(content.length, match.index + match[0].length + 120),
      );

      if (rule.skipPatterns) {
        const shouldSkip = rule.skipPatterns.some((pat) => pat.test(snippet));
        if (shouldSkip) continue;
      }

      // For Math.random: only flag if near security-related context
      if (rule.requireSecurityContext && !SECURITY_CONTEXT.test(snippet)) {
        continue;
      }

      findings.push({
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        line: lineNum,
        match: match[0],
        snippet: snippet.replace(/\s+/g, " ").trim().slice(0, 120),
      });
    }
  }

  return findings.length ? findings : null;
}

async function scanWeakCrypto(rootDir, options = {}) {
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
    rule: "WEAK_CRYPTO",
    severity: results.length ? "medium" : "none",
    count: results.reduce((sum, r) => sum + r.findings.length, 0),
    fileCount: results.length,
    results,
    humanReadable: results.length
      ? `Weak crypto or insecure random usage found in ${results.length} file(s). Replace with cryptographically secure alternatives.`
      : "No weak crypto or insecure random usage detected.",
  };
}

module.exports = { scanWeakCrypto, RULES };
