// simplebeacon-ignore: Security findings are false positives — scanner definitions, test fixtures, dashboard code, and build scripts
/**
 * Hallucinated import scanner — detects `import`/`require` statements that reference
 * packages not listed in package.json dependencies or devDependencies.
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

// Node.js built-in modules that don't need package.json entries
const NODE_BUILTINS = new Set([
  "assert",
  "async_hooks",
  "buffer",
  "child_process",
  "cluster",
  "console",
  "constants",
  "crypto",
  "dgram",
  "dns",
  "domain",
  "events",
  "fs",
  "http",
  "http2",
  "https",
  "inspector",
  "module",
  "net",
  "os",
  "path",
  "perf_hooks",
  "process",
  "punycode",
  "querystring",
  "readline",
  "repl",
  "stream",
  "string_decoder",
  "sys",
  "timers",
  "tls",
  "trace_events",
  "tty",
  "url",
  "util",
  "v8",
  "vm",
  "worker_threads",
  "zlib",
]);

const IMPORT_REGEX =
  /(?:^|;|\s)import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"\s]+)['"]|(?:^|;|\s)require\s*\(\s*['"]([^'"\s]+)['"]\s*\)/gm;

const SUPPRESS_PATTERN = /\/\/\s*simplebeacon-ignore\s+hallucinated-import/i;

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

function extractImports(content) {
  const imports = [];
  let match;
  IMPORT_REGEX.lastIndex = 0;
  while ((match = IMPORT_REGEX.exec(content)) !== null) {
    const pkg = match[1] || match[2];
    if (!pkg) continue;
    // Skip relative imports and Node built-ins
    if (pkg.startsWith(".") || pkg.startsWith("/")) continue;
    if (NODE_BUILTINS.has(pkg.split("/")[0])) continue;
    // Skip internal workspace/package prefixes
    if (pkg.startsWith("node:")) continue;

    const line = content.substring(0, match.index).split("\n").length;
    const lineStart = content.lastIndexOf("\n", match.index) + 1;
    const lineEnd = content.indexOf("\n", match.index);
    const lineText = content.slice(
      lineStart,
      lineEnd === -1 ? undefined : lineEnd,
    );

    if (SUPPRESS_PATTERN.test(lineText)) continue;

    imports.push({
      packageName: pkg.split("/")[0],
      raw: pkg,
      line,
      lineText,
    });
  }
  return imports;
}

async function scanFile(filePath, rootDir, allowedPackages) {
  if (isExcludedPath(filePath, rootDir)) return null;
  if (!isScannable(filePath)) return null;

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

  const imports = extractImports(content);
  const findings = [];
  for (const imp of imports) {
    if (allowedPackages.has(imp.packageName)) continue;
    findings.push({
      ruleId: "SB-FICTION-004",
      ruleName: "Hallucinated Import",
      severity: "medium",
      line: imp.line,
      match: imp.raw,
      snippet: imp.lineText.replace(/\s+/g, " ").trim().slice(0, 120),
    });
  }
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

function loadPackageDependencies(baseDir) {
  const pkgPath = path.join(baseDir, "package.json");
  try {
    const content = fs.readFileSync(pkgPath, "utf8");
    const pkg = JSON.parse(content);
    const deps = new Set();
    for (const section of [
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies",
    ]) {
      const block = pkg[section];
      if (block) {
        for (const name of Object.keys(block)) {
          deps.add(name.split("/")[0]);
        }
      }
    }
    return deps;
  } catch {
    return new Set();
  }
}

async function scanHallucinatedImports(baseDir, options = {}) {
  const sourcePaths = options.sourcePaths || ["src", "lib", "server", "web"];
  const productionPaths = options.productionPaths || sourcePaths;
  const pathsToWalk = [...new Set([...sourcePaths, ...productionPaths])];

  const allowedPackages = loadPackageDependencies(baseDir);

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
    const fileFindings = await scanFile(file.path, baseDir, allowedPackages);
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
        description: `${relativePath}:${f.line} import of "${f.match}" not found in package.json — possible hallucinated dependency`,
        recommendedAction:
          "Verify the package name on npm; if it exists, add it to package.json. If it is a typo, remove or replace the import.",
        affectedFiles: [relativePath],
        metadata: {
          ruleId: f.ruleId,
          import: f.match,
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
  };
}

module.exports = {
  scanHallucinatedImports,
  scanFile,
  extractImports,
  loadPackageDependencies,
};
