/**
 * Custom heuristic rule engine — loads and executes user-defined JSON-based
 * compliance rules from .simplebeacon/custom-rules.json without requiring
 * changes to the CLI core modules.
 *
 * Rule JSON schema:
 * {
 *   "id": "SB-CUSTOM-001",
 *   "name": "No console.log in production",
 *   "pattern": "console\\.(log|debug|info)\\(",
 *   "patternFlags": "gi",
 *   "severity": "medium",
 *   "fileExtensions": [".js", ".ts", ".jsx", ".tsx"],
 *   "description": "Console logging should not be in production code",
 *   "recommendation": "Remove console.log statements or use a proper logger",
 *   "excludePaths": ["test/", "spec/", "mock/"],
 *   "includePaths": ["server/", "src/"],
 *   "maxFileSize": 512000,
 *   "caseSensitive": false,
 *   "enabled": true
 * }
 */

const fs = require("fs");
const path = require("path");
const { globMatch } = require("../rules/production-leak");
const { JS_AST_EXTENSIONS } = require("../lib/javascript-ast-scanner");

const AST_EXTENSIONS = new Set(JS_AST_EXTENSIONS);
const DEFAULT_AST_EXTENSIONS = Array.from(JS_AST_EXTENSIONS);

let babelParser = null;
let babelTraverse = null;

function loadAstParser() {
  if (babelParser) return babelParser;
  try {
    babelParser = require("@babel/parser");
  } catch {
    return null;
  }
  return babelParser;
}

function loadAstTraverse() {
  if (babelTraverse) return babelTraverse;
  try {
    babelTraverse = require("@babel/traverse").default;
  } catch {
    return null;
  }
  return babelTraverse;
}

const CUSTOM_RULES_FILE = "custom-rules.json";
const UNIVERSAL_RULES_FILE = path.join(__dirname, "universal-ai-rules.json");
const MAX_RULES = 100;
const MAX_PATTERN_LENGTH = 5000;
const DEFAULT_MAX_FILE_SIZE = 512000;

const VALID_SEVERITIES = new Set(["critical", "high", "medium", "low"]);
const VALID_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".jsx",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".rb",
  ".php",
  ".vue",
  ".svelte",
  ".json",
  ".yaml",
  ".yml",
  ".env",
  ".html",
  ".css",
  ".scss",
  ".less",
  ".sh",
  ".bash",
  ".ps1",
  ".sql",
  ".graphql",
  ".gql",
  ".md",
  ".txt",
  ".xml",
  ".toml",
  ".ini",
  ".cfg",
]);

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
  "deliverables",
  "coming-soon",
  "reports",
  "security-reports",
  "templates",
  "data-central",
  "deployments",
  "functions",
  "cloudflare-deploy",
  "temp",
  "tests-legacy",
  ".github-sync",
  ".cursor",
  ".vscode",
  "downloads",
  "findings",
  "vendor",
  "bin",
  "tmp",
  "out",
]);

/**
 * Validate a single custom rule definition.
 */
function validateRule(rule, index) {
  const errors = [];
  const warnings = [];

  if (!rule || typeof rule !== "object") {
    errors.push(`Rule ${index}: must be a JSON object`);
    return { valid: false, errors, warnings };
  }

  const prefix = `Rule ${index}${rule.id ? ` (${rule.id})` : ""}`;

  if (!rule.id || typeof rule.id !== "string") {
    errors.push(`${prefix}: missing or invalid "id" field`);
  }

  if (!rule.name || typeof rule.name !== "string") {
    warnings.push(`${prefix}: missing "name" field — using id as fallback`);
  }

  const engine = String(rule.engine || "regex").toLowerCase();
  if (
    engine === "ast" ||
    (rule.astCriteria && typeof rule.astCriteria === "object")
  ) {
    if (!rule.astCriteria || typeof rule.astCriteria !== "object") {
      errors.push(`${prefix}: AST rules require a valid "astCriteria" object`);
    } else {
      const ac = rule.astCriteria;
      if (typeof ac.nodeType !== "string") {
        errors.push(
          `${prefix}: AST rule "astCriteria.nodeType" must be a string`,
        );
      }
      if (
        ac.arguments &&
        (typeof ac.arguments.index !== "number" ||
          typeof ac.arguments.type !== "string")
      ) {
        errors.push(
          `${prefix}: AST rule "astCriteria.arguments" must have numeric "index" and string "type"`,
        );
      }
      for (const key of ["calleeRegex", "nameRegex"]) {
        if (ac[key] == null) continue;
        if (typeof ac[key] !== "string") {
          errors.push(
            `${prefix}: AST rule "astCriteria.${key}" must be a string`,
          );
        } else {
          try {
            new RegExp(ac[key]);
          } catch (e) {
            errors.push(
              `${prefix}: invalid "astCriteria.${key}" — ${e.message}`,
            );
          }
        }
      }
      for (const key of ["minArgs", "maxArgs"]) {
        if (ac[key] != null && typeof ac[key] !== "number") {
          errors.push(
            `${prefix}: AST rule "astCriteria.${key}" must be a number`,
          );
        }
      }
    }
  } else {
    if (!rule.pattern || typeof rule.pattern !== "string") {
      errors.push(
        `${prefix}: missing or invalid "pattern" field (must be a regex string)`,
      );
    } else if (rule.pattern.length > MAX_PATTERN_LENGTH) {
      errors.push(
        `${prefix}: pattern exceeds max length of ${MAX_PATTERN_LENGTH} characters`,
      );
    } else {
      try {
        new RegExp(rule.pattern, rule.patternFlags || "");
      } catch (e) {
        errors.push(`${prefix}: invalid regex pattern — ${e.message}`);
      }
    }
  }

  if (rule.severity && !VALID_SEVERITIES.has(rule.severity)) {
    warnings.push(
      `${prefix}: invalid severity "${rule.severity}" — defaulting to "medium"`,
    );
  }

  if (rule.fileExtensions && Array.isArray(rule.fileExtensions)) {
    for (const ext of rule.fileExtensions) {
      if (typeof ext !== "string" || !ext.startsWith(".")) {
        warnings.push(
          `${prefix}: invalid file extension "${ext}" — must start with a dot`,
        );
      }
    }
  }

  if (
    rule.maxFileSize &&
    (typeof rule.maxFileSize !== "number" || rule.maxFileSize < 0)
  ) {
    warnings.push(`${prefix}: invalid maxFileSize — must be a positive number`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Load the built-in universal AI ruleset that ships with SimpleBeacon.
 * These rules catch common AI coding mistakes across all languages.
 * Returns { rules, errors, warnings }.
 */
function loadUniversalRules() {
  const result = { rules: [], errors: [], warnings: [] };

  let raw;
  try {
    raw = fs.readFileSync(UNIVERSAL_RULES_FILE, "utf8");
  } catch {
    result.warnings.push("Universal AI ruleset not found — skipping");
    return result;
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    result.errors.push(`Failed to parse universal-ai-rules.json: ${e.message}`);
    return result;
  }

  const ruleList = Array.isArray(data) ? data : data.rules;
  if (!Array.isArray(ruleList)) {
    result.errors.push(
      "universal-ai-rules.json: expected an array or { rules: [...] }",
    );
    return result;
  }

  for (let i = 0; i < Math.min(ruleList.length, MAX_RULES); i++) {
    const rule = ruleList[i];
    const validation = validateRule(rule, i);
    result.errors.push(...validation.errors);
    result.warnings.push(...validation.warnings);

    if (!validation.valid) continue;

    const engine = String(rule.engine || "regex").toLowerCase();
    const isAst =
      engine === "ast" ||
      (rule.astCriteria && typeof rule.astCriteria === "object");
    const fileExtensions = Array.isArray(rule.fileExtensions)
      ? rule.fileExtensions
      : isAst
        ? DEFAULT_AST_EXTENSIONS
        : null;
    const normalized = {
      id: rule.id,
      name: rule.name || rule.id,
      engine,
      astCriteria: rule.astCriteria || null,
      language: rule.language || "universal",
      pattern: rule.pattern || null,
      patternFlags: rule.patternFlags || (rule.caseSensitive ? "g" : "gi"),
      severity: VALID_SEVERITIES.has(rule.severity) ? rule.severity : "medium",
      fileExtensions,
      description:
        rule.description ||
        `${rule.name || rule.id}: ${isAst ? "universal AST rule match" : "universal pattern match"}`,
      recommendation:
        rule.recommendation || "Review and address the flagged pattern",
      excludePaths: Array.isArray(rule.excludePaths) ? rule.excludePaths : [],
      includePaths: Array.isArray(rule.includePaths) ? rule.includePaths : null,
      maxFileSize:
        typeof rule.maxFileSize === "number"
          ? rule.maxFileSize
          : DEFAULT_MAX_FILE_SIZE,
      enabled: rule.enabled !== false,
      universal: true,
    };

    result.rules.push(normalized);
  }

  return result;
}

/**
 * Load custom rules from .simplebeacon/custom-rules.json, merged with the
 * built-in universal AI ruleset. Project-specific rules override universal
 * rules with the same ID. The universal ruleset can be disabled via
 * config: { rules: { 'custom-heuristic': { universalRules: false } } }.
 * Returns { rules, errors, warnings }.
 */
function loadCustomRules(projectRoot, options = {}) {
  const result = { rules: [], errors: [], warnings: [] };

  // Load universal ruleset unless explicitly disabled
  const loadUniversal = options.universalRules !== false;
  const universalResult = loadUniversal
    ? loadUniversalRules()
    : { rules: [], errors: [], warnings: [] };
  result.errors.push(...universalResult.errors);
  result.warnings.push(...universalResult.warnings);

  const simplebeaconDir = path.join(projectRoot, ".simplebeacon");
  const rulesPath = path.join(simplebeaconDir, CUSTOM_RULES_FILE);

  let raw;
  try {
    raw = fs.readFileSync(rulesPath, "utf8");
  } catch {
    // No project-specific custom rules file — return universal rules only
    result.rules = universalResult.rules;
    return result;
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    result.errors.push(`Failed to parse ${CUSTOM_RULES_FILE}: ${e.message}`);
    // Return universal rules even if project rules file is invalid
    result.rules = universalResult.rules;
    return result;
  }

  const ruleList = Array.isArray(data) ? data : data.rules;
  if (!Array.isArray(ruleList)) {
    result.errors.push(
      `${CUSTOM_RULES_FILE}: expected an array or { rules: [...] }`,
    );
    result.rules = universalResult.rules;
    return result;
  }

  if (ruleList.length > MAX_RULES) {
    result.warnings.push(
      `${CUSTOM_RULES_FILE}: ${ruleList.length} rules defined, only first ${MAX_RULES} will be loaded`,
    );
  }

  // Build a map of universal rules by ID so project rules can override them
  const rulesById = new Map();
  for (const ur of universalResult.rules) {
    rulesById.set(ur.id, ur);
  }

  const seenIds = new Set();
  for (let i = 0; i < Math.min(ruleList.length, MAX_RULES); i++) {
    const rule = ruleList[i];
    const validation = validateRule(rule, i);
    result.errors.push(...validation.errors);
    result.warnings.push(...validation.warnings);

    if (!validation.valid) continue;

    if (seenIds.has(rule.id)) {
      result.warnings.push(`Rule ${i} (${rule.id}): duplicate id — skipping`);
      continue;
    }
    seenIds.add(rule.id);

    const engine = String(rule.engine || "regex").toLowerCase();
    const isAst =
      engine === "ast" ||
      (rule.astCriteria && typeof rule.astCriteria === "object");
    const fileExtensions = Array.isArray(rule.fileExtensions)
      ? rule.fileExtensions
      : isAst
        ? DEFAULT_AST_EXTENSIONS
        : null;
    const normalized = {
      id: rule.id,
      name: rule.name || rule.id,
      engine,
      astCriteria: rule.astCriteria || null,
      language: rule.language || "javascript",
      pattern: rule.pattern || null,
      patternFlags: rule.patternFlags || (rule.caseSensitive ? "g" : "gi"),
      severity: VALID_SEVERITIES.has(rule.severity) ? rule.severity : "medium",
      fileExtensions,
      description:
        rule.description ||
        `${rule.name || rule.id}: ${isAst ? "custom AST rule match" : "custom pattern match"}`,
      recommendation:
        rule.recommendation || "Review and address the flagged pattern",
      excludePaths: Array.isArray(rule.excludePaths) ? rule.excludePaths : [],
      includePaths: Array.isArray(rule.includePaths) ? rule.includePaths : null,
      maxFileSize:
        typeof rule.maxFileSize === "number"
          ? rule.maxFileSize
          : DEFAULT_MAX_FILE_SIZE,
      enabled: rule.enabled !== false,
    };

    // Project-specific rule overrides universal rule with same ID
    rulesById.set(normalized.id, normalized);
  }

  // Combine: universal rules (that weren't overridden) + project rules
  result.rules = Array.from(rulesById.values());

  return result;
}

/**
 * Check if a relative file path should be included based on rule filters.
 */
function shouldScanFile(relPath, rule) {
  const normalized = relPath.replace(/\\/g, "/");

  // Check exclude paths
  for (const exclude of rule.excludePaths) {
    const ex = exclude.replace(/\\/g, "/").replace(/\/$/, "");
    if (normalized.startsWith(ex + "/") || normalized === ex) {
      return false;
    }
    if (globMatch(normalized, exclude)) {
      return false;
    }
  }

  // Check include paths (if specified, file must be under one of them)
  if (rule.includePaths && rule.includePaths.length > 0) {
    const included = rule.includePaths.some((inc) => {
      const incNorm = inc.replace(/\\/g, "/").replace(/\/$/, "");
      return normalized.startsWith(incNorm + "/") || normalized === incNorm;
    });
    if (!included) return false;
  }

  // Check file extensions
  if (rule.fileExtensions && rule.fileExtensions.length > 0) {
    const ext = path.extname(normalized).toLowerCase();
    if (!rule.fileExtensions.includes(ext)) return false;
  }

  return true;
}

/**
 * Scan a single file against a single rule.
 */
function scanFileAgainstRule(content, relPath, rule) {
  const findings = [];
  let regex;
  try {
    regex = new RegExp(rule.pattern, rule.patternFlags);
  } catch {
    return findings; // Invalid regex — skip silently
  }

  const lines = content.split("\n");
  let match;
  while ((match = regex.exec(content)) !== null) {
    const lineIndex = content.slice(0, match.index).split("\n").length - 1;
    const line = lines[lineIndex] || "";
    const trimmedLine = line.trim();

    // Skip shebang lines (e.g. #!/usr/bin/env node) — standard Unix interpreter directive, not a hardcoded path
    if (lineIndex === 0 && /^#!/.test(trimmedLine)) {
      continue;
    }

    // Skip comment-only lines for code patterns (unless rule says otherwise)
    if (/^(\/\/|#|\*|\/\*)/.test(trimmedLine)) {
      // Still flag if the pattern itself targets comments
      // For now, include all matches
    }

    findings.push({
      id: `custom-${rule.id}-${relPath}-${match.index}`,
      severity: rule.severity,
      severityBand: rule.severity,
      type: rule.name,
      category: "custom-heuristic",
      filePath: relPath,
      file: relPath,
      line: lineIndex + 1,
      pattern: rule.id,
      count: 1,
      description: `${relPath}:${lineIndex + 1} — ${rule.description}`,
      recommendation: rule.recommendation,
      recommendedAction: rule.recommendation,
      affectedFiles: [path.basename(relPath)],
      metadata: {
        ruleId: rule.id,
        ruleName: rule.name,
        category: "custom-heuristic",
        engine: "custom-rules",
        match: match[0].slice(0, 120),
      },
    });

    // Prevent infinite loop on zero-length matches
    if (match.index === regex.lastIndex) {
      regex.lastIndex++;
    }
  }

  return findings;
}

/**
 * Walk project files and scan them against all enabled custom rules.
 */
function calleeLabel(node) {
  if (node.type === "Identifier") return node.name;
  if (node.type === "MemberExpression") {
    const prop =
      node.property.type === "Identifier"
        ? node.property.name
        : node.property.value || "";
    if (node.object.type === "MemberExpression")
      return `${calleeLabel(node.object)}.${prop}`;
    const obj = node.object.type === "Identifier" ? node.object.name : "obj";
    return `${obj}.${prop}`;
  }
  return "call";
}

function nodeName(node) {
  return node.name || (node.id && node.id.name) || null;
}

function matchesAstCriteria(node, criteria) {
  if (node.type !== criteria.nodeType) return false;
  if (criteria.callee) {
    if (node.type !== "CallExpression" || !node.callee) return false;
    if (calleeLabel(node.callee) !== criteria.callee) return false;
  }
  if (criteria.calleeRegex) {
    if (node.type !== "CallExpression" || !node.callee) return false;
    if (!new RegExp(criteria.calleeRegex).test(calleeLabel(node.callee)))
      return false;
  }
  if (criteria.arguments) {
    const arg = node.arguments && node.arguments[criteria.arguments.index];
    if (!arg || arg.type !== criteria.arguments.type) return false;
  }
  if (criteria.name) {
    const name = nodeName(node);
    if (name !== criteria.name) return false;
  }
  if (criteria.nameRegex) {
    const name = nodeName(node);
    if (name === null || !new RegExp(criteria.nameRegex).test(name))
      return false;
  }
  if (typeof criteria.minArgs === "number") {
    if (
      !Array.isArray(node.arguments) ||
      node.arguments.length < criteria.minArgs
    )
      return false;
  }
  if (typeof criteria.maxArgs === "number") {
    if (
      !Array.isArray(node.arguments) ||
      node.arguments.length > criteria.maxArgs
    )
      return false;
  }
  return true;
}

function parserPlugins(ext) {
  const plugins = [];
  if (ext === ".jsx" || ext === ".tsx") plugins.push("jsx");
  if (ext === ".ts" || ext === ".tsx") plugins.push("typescript");
  return [...new Set(plugins)];
}

function scanFileAgainstAstRule(content, relPath, rule) {
  const findings = [];
  const parser = loadAstParser();
  const traverse = loadAstTraverse();
  if (!parser || !traverse) return findings;

  const ext = path.extname(relPath).toLowerCase();
  if (!AST_EXTENSIONS.has(ext)) return findings;

  let ast;
  try {
    ast = parser.parse(content, {
      sourceFilename: relPath,
      sourceType: "unambiguous",
      plugins: parserPlugins(ext),
      errorRecovery: false,
    });
  } catch {
    return findings;
  }

  const criteria = rule.astCriteria;
  const seen = new Set();

  traverse(ast, {
    [criteria.nodeType](pathNode) {
      if (!matchesAstCriteria(pathNode.node, criteria)) return;
      const line =
        pathNode.node.loc && pathNode.node.loc.start
          ? pathNode.node.loc.start.line
          : 1;
      const key = `${rule.id}:${line}`;
      if (seen.has(key)) return;
      seen.add(key);

      findings.push({
        id: `custom-${rule.id}-${relPath}-${line}`,
        severity: rule.severity,
        severityBand: rule.severity,
        type: rule.name,
        category: "custom-ast",
        filePath: relPath,
        file: relPath,
        line,
        pattern: rule.id,
        count: 1,
        description: `${relPath}:${line} — ${rule.description}`,
        recommendation: rule.recommendation,
        recommendedAction: rule.recommendation,
        affectedFiles: [path.basename(relPath)],
        metadata: {
          ruleId: rule.id,
          ruleName: rule.name,
          category: "custom-ast",
          engine: "custom-ast",
          nodeType: criteria.nodeType,
          match: criteria.callee || criteria.name || criteria.nodeType,
        },
      });
    },
  });

  return findings;
}

async function scanCustomHeuristicRules(projectRoot, options = {}) {
  const { rules, errors, warnings } = loadCustomRules(projectRoot, {
    universalRules: options.universalRules !== false,
  });

  if (errors.length > 0) {
    return {
      scanned: 0,
      findings: 0,
      issues: [],
      patterns: [],
      errors,
      warnings,
    };
  }

  const enabledRules = rules.filter((r) => r.enabled);
  if (enabledRules.length === 0) {
    return {
      scanned: 0,
      findings: 0,
      issues: [],
      patterns: [],
      errors: [],
      warnings,
    };
  }

  const ignoreGlobs = options.ignoreGlobs || [];
  const allFindings = [];
  let filesScanned = 0;
  const scanErrors = [...errors];
  const scanWarnings = [...warnings];

  // Collect all unique file extensions across rules to limit directory walking
  const allExtensions = new Set();
  for (const rule of enabledRules) {
    if (rule.fileExtensions) {
      for (const ext of rule.fileExtensions) {
        allExtensions.add(ext.toLowerCase());
      }
    }
  }
  // If no extensions specified by any rule, use a broad default set
  if (allExtensions.size === 0) {
    for (const ext of VALID_EXTENSIONS) {
      allExtensions.add(ext);
    }
  }

  // Walk the project directory
  const files = [];
  const extraSkipDirs = new Set(options.extraSkipDirs || []);
  await walkProjectFiles(
    projectRoot,
    "",
    files,
    allExtensions,
    ignoreGlobs,
    options.maxDepth || 15,
    0,
    extraSkipDirs,
  );

  for (const file of files) {
    const relPath = file.relPath;
    filesScanned++;

    // Read file content
    let content;
    try {
      const stat = fs.statSync(file.fullPath);
      if (stat.size > DEFAULT_MAX_FILE_SIZE) continue;
      content = fs.readFileSync(file.fullPath, "utf8");
    } catch {
      continue;
    }

    // Check each rule against this file
    for (const rule of enabledRules) {
      if (!shouldScanFile(relPath, rule)) continue;
      if (content.length > rule.maxFileSize) continue;

      const findings =
        rule.engine === "ast"
          ? scanFileAgainstAstRule(content, relPath, rule)
          : scanFileAgainstRule(content, relPath, rule);
      allFindings.push(...findings);
    }
  }

  return {
    scanned: filesScanned,
    findings: allFindings.length,
    issues: allFindings,
    patterns: enabledRules.map((r) => r.id),
    errors: scanErrors,
    warnings: scanWarnings,
  };
}

/**
 * Recursively walk project files, respecting skip dirs and extension filters.
 */
async function walkProjectFiles(
  root,
  relDir,
  results,
  extensions,
  ignoreGlobs,
  maxDepth,
  depth = 0,
  extraSkipDirs = new Set(),
) {
  if (depth > maxDepth) return;

  const absDir = relDir ? path.join(root, relDir) : root;
  let entries;
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      if (extraSkipDirs.has(entry.name)) continue;
      if (entry.name.startsWith(".")) continue;
      const childRel = relDir ? `${relDir}/${entry.name}` : entry.name;
      await walkProjectFiles(
        root,
        childRel,
        results,
        extensions,
        ignoreGlobs,
        maxDepth,
        depth + 1,
        extraSkipDirs,
      );
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!extensions.has(ext)) continue;
      const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
      if (ignoreGlobs.some((g) => globMatch(relPath, g))) continue;
      results.push({ fullPath: path.join(absDir, entry.name), relPath });
    }
  }
}

/**
 * Get a summary of loaded custom rules for reporting.
 */
function getCustomRulesSummary(projectRoot) {
  const { rules, errors, warnings } = loadCustomRules(projectRoot, {
    universalRules: true,
  });
  return {
    totalRules: rules.length,
    enabledRules: rules.filter((r) => r.enabled).length,
    universalRules: rules.filter((r) => r.universal).length,
    projectRules: rules.filter((r) => !r.universal).length,
    ruleIds: rules.map((r) => ({
      id: r.id,
      name: r.name,
      severity: r.severity,
      enabled: r.enabled,
      universal: r.universal || false,
    })),
    errors,
    warnings,
  };
}

module.exports = {
  scanCustomHeuristicRules,
  loadCustomRules,
  validateRule,
  shouldScanFile,
  scanFileAgainstRule,
  scanFileAgainstAstRule,
  getCustomRulesSummary,
  loadUniversalRules,
  VALID_SEVERITIES,
  VALID_EXTENSIONS,
  CUSTOM_RULES_FILE,
  MAX_RULES,
};
