/**
 * AST structural fingerprinting scanner — uses @babel/parser to detect LLM-generated
 * structural patterns: deadweight functions, redundant try/catch wrappers, and
 * excessive promise chains with identical error handling.
 */

const fs = require("fs");
const path = require("path");

let babelParser, babelTraverse;
try {
  babelParser = require("@babel/parser");
} catch {
  // Babel parser not available — skip AST scanning
}
try {
  babelTraverse = require("@babel/traverse").default;
} catch {
  // Babel traverse not available — skip AST scanning
}

const SCANNABLE_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".jsx",
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
  "simplebeacon-rule-tests",
  "simplebeacon-toxic-fixtures",
]);

const SKIP_FILES = /\.(test|spec)\.(js|cjs|mjs|ts|tsx)$/i;

function isScannable(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!SCANNABLE_EXTENSIONS.has(ext)) return false;
  if (SKIP_FILES.test(path.basename(filePath))) return false;
  return true;
}

function isExcludedPath(filePath, rootDir) {
  const rel = filePath.replace(rootDir, "").replace(/^[/\\]+/, "");
  const firstDir = rel.split(/[/\\]/)[0];
  return SKIP_DIRS.has(firstDir);
}

function parseAst(content, _filePath) {
  if (!babelParser) return null;
  try {
    return babelParser.parse(content, {
      sourceType: "module",
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      plugins: [
        "jsx",
        "typescript",
        "decorators-legacy",
        "classProperties",
        "optionalChaining",
        "nullishCoalescingOperator",
        "dynamicImport",
        "topLevelAwait",
      ],
    });
  } catch {
    // Fallback: try as script
    try {
      return babelParser.parse(content, {
        sourceType: "script",
        allowReturnOutsideFunction: true,
        plugins: ["jsx", "typescript", "decorators-legacy", "classProperties"],
      });
    } catch {
      return null;
    }
  }
}

function analyzeDeadweightFunctions(ast, _relativePath) {
  if (!ast || !babelTraverse) return [];
  const exports = new Map();
  const calls = new Set();

  try {
    babelTraverse(ast, {
      FunctionDeclaration(path) {
        const node = path.node;
        if (node.id && node.id.name) {
          const name = node.id.name;
          // Check if exported
          let isExported = false;
          if (path.parent && path.parent.type === "ExportNamedDeclaration") {
            isExported = true;
          }
          if (path.parent && path.parent.type === "ExportDefaultDeclaration") {
            isExported = true;
          }
          // Check for module.exports = name
          if (path.parent && path.parent.type === "Program") {
            const body = path.parent.body || [];
            for (const stmt of body) {
              if (stmt.type === "ExpressionStatement" && stmt.expression) {
                const expr = stmt.expression;
                if (expr.type === "AssignmentExpression" && expr.left) {
                  const left = expr.left;
                  if (
                    left.type === "MemberExpression" &&
                    left.object &&
                    left.object.name === "module" &&
                    left.property &&
                    left.property.name === "exports"
                  ) {
                    isExported = true;
                  }
                }
              }
            }
          }
          exports.set(name, {
            isExported,
            node,
            line: node.loc ? node.loc.start.line : 0,
          });
        }
      },
      Identifier(path) {
        const node = path.node;
        if (node.name && path.parent && path.parent.type === "CallExpression") {
          calls.add(node.name);
        }
      },
    });
  } catch {
    return [];
  }

  const findings = [];
  for (const [name, info] of exports) {
    if (info.isExported && !calls.has(name)) {
      findings.push({
        ruleId: "SB-QUAL-003",
        ruleName: "Deadweight Exported Function",
        severity: "low",
        line: info.line,
        match: name,
        snippet: `Exported function "${name}" has no call sites in this file`,
      });
    }
  }
  return findings;
}

function analyzeRedundantTryCatch(ast, _relativePath) {
  if (!ast || !babelTraverse) return [];
  let tryCatchCount = 0;
  let functionCount = 0;

  try {
    babelTraverse(ast, {
      Function(path) {
        functionCount++;
        const body = path.node.body;
        if (
          body &&
          body.type === "BlockStatement" &&
          body.body &&
          body.body.length === 1
        ) {
          const stmt = body.body[0];
          if (stmt.type === "TryStatement") {
            tryCatchCount++;
          }
        }
      },
    });
  } catch {
    return [];
  }

  const findings = [];
  if (
    functionCount > 0 &&
    tryCatchCount / functionCount > 0.8 &&
    functionCount >= 3
  ) {
    findings.push({
      ruleId: "SB-QUAL-004",
      ruleName: "Redundant Try/Catch Wrappers",
      severity: "low",
      line: 1,
      match: `${tryCatchCount}/${functionCount}`,
      snippet: `${tryCatchCount} of ${functionCount} functions are wrapped in try/catch — possible LLM boilerplate pattern`,
    });
  }
  return findings;
}

function analyzeTripleNestedTryCatch(ast, _relativePath) {
  if (!ast || !babelTraverse) return [];
  const findings = [];

  try {
    babelTraverse(ast, {
      TryStatement: {
        enter(path) {
          // Count nesting depth by walking up parent TryStatement chain
          let depth = 0;
          let current = path.parentPath;
          while (current) {
            if (current.node && current.node.type === "TryStatement") {
              depth++;
            }
            current = current.parentPath;
          }
          // Also check if this TryStatement contains nested TryStatements
          // by looking at the handler body for nested try blocks
          if (depth >= 2) {
            // This is at least triple-nested (depth=2 means 3 levels: this + 2 parents)
            const line = path.node.loc ? path.node.loc.start.line : 0;
            findings.push({
              ruleId: "SB-QUAL-006",
              ruleName: "Excessive Nested Try/Catch",
              severity: "medium",
              line,
              match: `depth=${depth + 1}`,
              snippet: `Try/catch nested ${depth + 1} levels deep — redundant error handling structure, likely LLM-generated boilerplate`,
            });
          }
        },
      },
    });
  } catch {
    return [];
  }

  return findings;
}

function analyzePromiseChains(ast, _relativePath) {
  if (!ast || !babelTraverse) return [];
  let chainCount = 0;
  let identicalCatchCount = 0;
  const catchBodies = [];

  try {
    babelTraverse(ast, {
      MemberExpression(path) {
        const node = path.node;
        if (
          node.property &&
          node.property.name === "then" &&
          path.parent &&
          path.parent.type === "CallExpression"
        ) {
          // Check if parent has .catch()
          let current = path.parent;
          if (current.type === "CallExpression" && current.callee === node) {
            // Look for .catch() chain
            const parentExpr = path.parentPath && path.parentPath.parent;
            if (
              parentExpr &&
              parentExpr.type === "MemberExpression" &&
              parentExpr.property &&
              parentExpr.property.name === "catch"
            ) {
              chainCount++;
            }
          }
        }
      },
      CallExpression(path) {
        const node = path.node;
        if (
          node.callee &&
          node.callee.type === "MemberExpression" &&
          node.callee.property &&
          node.callee.property.name === "catch"
        ) {
          const handler = node.arguments[0];
          if (handler) {
            const bodyStr = JSON.stringify(handler).slice(0, 200);
            catchBodies.push(bodyStr);
          }
        }
      },
    });
  } catch {
    return [];
  }

  // Check for identical catch bodies
  if (catchBodies.length >= 3) {
    const first = catchBodies[0];
    const identical = catchBodies.filter((b) => b === first).length;
    if (identical / catchBodies.length > 0.8) {
      identicalCatchCount = identical;
    }
  }

  const findings = [];
  if (chainCount >= 5 && identicalCatchCount >= 3) {
    findings.push({
      ruleId: "SB-QUAL-005",
      ruleName: "Identical Promise Catch Chains",
      severity: "low",
      line: 1,
      match: `${chainCount} chains`,
      snippet: `${chainCount} .then().catch() chains with identical error handling — possible LLM boilerplate`,
    });
  }
  return findings;
}

async function scanFile(filePath, rootDir) {
  if (isExcludedPath(filePath, rootDir)) return null;
  if (!isScannable(filePath)) return null;
  if (!babelParser) return null;

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

  const ast = parseAst(content, filePath);
  if (!ast) return null;

  const relativePath = path
    .relative(rootDir, filePath)
    .split(path.sep)
    .join("/");
  const findings = [
    ...analyzeDeadweightFunctions(ast, relativePath),
    ...analyzeRedundantTryCatch(ast, relativePath),
    ...analyzeTripleNestedTryCatch(ast, relativePath),
    ...analyzePromiseChains(ast, relativePath),
  ];

  return findings.length ? findings : null;
}

async function walkFiles(dir, files, options = {}) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const rel = path
        .relative(options.baseDir || dir, full)
        .split(path.sep)
        .join("/");
      const firstDir = rel.split("/")[0];
      if (SKIP_DIRS.has(firstDir)) continue;
      if (entry.name.startsWith(".")) continue;
      await walkFiles(full, files, options);
    } else if (entry.isFile()) {
      files.push({
        path: full,
        relativePath: path
          .relative(options.baseDir || dir, full)
          .split(path.sep)
          .join("/"),
        ext: path.extname(full).toLowerCase(),
        size: (await fs.promises.stat(full)).size,
      });
    }
  }
}

async function scanAstStructural(baseDir, options = {}) {
  const sourcePaths = options.sourcePaths || ["src", "lib", "server", "web"];
  const productionPaths = options.productionPaths || sourcePaths;
  let pathsToWalk = [...new Set([...sourcePaths, ...productionPaths])];

  // If none of the configured source paths exist, fall back to scanning
  // the project root directly (handles monorepos, flat layouts, and test fixtures)
  const existingPaths = pathsToWalk.filter((rel) => {
    const abs = path.isAbsolute(rel) ? rel : path.join(baseDir, ...rel.split("/"));
    return fs.existsSync(abs);
  });
  if (existingPaths.length === 0) {
    pathsToWalk = ["."];
  }

  const files = [];
  for (const rel of pathsToWalk) {
    const abs = path.isAbsolute(rel)
      ? rel
      : path.join(baseDir, ...rel.split("/"));
    if (fs.existsSync(abs)) {
      await walkFiles(abs, files, { baseDir });
    }
  }

  const issues = [];
  for (const file of files) {
    const fileFindings = await scanFile(file.path, baseDir);
    if (!fileFindings) continue;

    const relativePath = path
      .relative(baseDir, file.path)
      .split(path.sep)
      .join("/");
    for (const f of fileFindings) {
      issues.push({
        id: `${f.ruleId}-${relativePath}-${f.line}`,
        severity: f.severity,
        type: f.ruleName,
        filePath: relativePath,
        file: relativePath,
        line: f.line,
        pattern: f.ruleId,
        count: 1,
        description: `${relativePath}:${f.line} ${f.ruleName}: ${f.snippet}`,
        recommendedAction:
          f.ruleId === "SB-QUAL-003"
            ? "Remove unused export or add a call site. If intentionally exported for external use, suppress with // simplebeacon-ignore ast-structural"
            : f.ruleId === "SB-QUAL-004"
              ? "Consolidate error handling into a single wrapper or middleware instead of per-function try/catch boilerplate."
              : f.ruleId === "SB-QUAL-006"
                ? "Flatten nested try/catch blocks into a single error boundary. Use promise .catch() or a wrapper function instead of deeply nested try/catch."
                : "Extract shared catch logic into a reusable error handler function.",
        affectedFiles: [relativePath],
        metadata: {
          ruleId: f.ruleId,
          match: f.match,
          snippet: f.snippet,
        },
      });
    }
  }

  return {
    scanned: files.length,
    findings: issues.length,
    issues,
    results: issues,
    astAvailable: Boolean(babelParser && babelTraverse),
  };
}

module.exports = { scanAstStructural, scanFile, parseAst };
