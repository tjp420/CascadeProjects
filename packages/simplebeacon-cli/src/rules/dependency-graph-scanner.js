// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
/**
 * Dependency graph scanner — detects circular dependencies, unused exports,
 * and orphaned modules by analyzing import/require and export relationships.
 * @module dependency-graph-scanner
 */

const fs = require('fs');
const path = require('path');

const SCANNABLE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx']);

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'coverage', 'dist', 'build', 'out', 'archive',
  '.simplebeacon', '.vscode-test', 'tests', 'test', '__tests__', 'fixtures', 'docs'
]);

const SKIP_FILES = /\.(test|spec)\.(js|cjs|mjs|ts|tsx)$/i;

// Node.js built-in modules that don't need resolution
const NODE_BUILTINS = new Set([
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console',
  'constants', 'crypto', 'dgram', 'dns', 'domain', 'events', 'fs', 'http',
  'http2', 'https', 'inspector', 'module', 'net', 'os', 'path', 'perf_hooks',
  'process', 'punycode', 'querystring', 'readline', 'repl', 'stream', 'string_decoder',
  'sys', 'timers', 'tls', 'trace_events', 'tty', 'url', 'util', 'v8', 'vm',
  'worker_threads', 'zlib'
]);

const IMPORT_REGEX = /(?:^|;|\s)import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"\s]+)['"]|(?:^|;|\s)require\s*\(\s*['"]([^'"\s]+)['"]\s*\)/gm;

const EXPORT_NAMED_REGEX = /export\s+(?:const|let|var|function|class|type|interface)\s+(\w+)/gm;
const EXPORT_DEFAULT_REGEX = /export\s+default\s+(?:class|function)?\s*(\w+)?/gm;
const EXPORT_LIST_REGEX = /export\s*\{([^}]+)\}/gm;
const MODULE_EXPORTS_REGEX = /(?:module\.)?exports\.(\w+)\s*=/gm;
const MODULE_EXPORTS_DEFAULT_REGEX = /module\.exports\s*=/gm;

function isScannable(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!SCANNABLE_EXTENSIONS.has(ext)) return false;
  if (SKIP_FILES.test(path.basename(filePath))) return false;
  return true;
}

function isExcludedPath(filePath, rootDir) {
  const rel = filePath.replace(rootDir, '').replace(/^[/\\]+/, '');
  const firstDir = rel.split(/[/\\]/)[0];
  return SKIP_DIRS.has(firstDir);
}

function resolveImportPath(importPath, fromFile, sourcePaths) {
  if (!importPath.startsWith('.')) {
    // Package import — not part of local dependency graph
    return null;
  }
  const fromDir = path.dirname(fromFile);
  let resolved = path.resolve(fromDir, importPath);

  // Try exact file with extensions
  const exts = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
  if (!path.extname(resolved)) {
    for (const ext of exts) {
      if (fs.existsSync(resolved + ext)) return resolved + ext;
    }
    // Try index files
    for (const ext of exts) {
      const indexPath = path.join(resolved, 'index' + ext);
      if (fs.existsSync(indexPath)) return indexPath;
    }
  }

  return fs.existsSync(resolved) ? resolved : null;
}

function extractImports(content) {
  const imports = [];
  let match;
  IMPORT_REGEX.lastIndex = 0;
  while ((match = IMPORT_REGEX.exec(content)) !== null) {
    const pkg = match[1] || match[2];
    if (!pkg) continue;
    if (pkg.startsWith('node:')) continue;
    if (NODE_BUILTINS.has(pkg.split('/')[0])) continue;
    const line = content.substring(0, match.index).split('\n').length;
    imports.push({ raw: pkg, line });
  }
  return imports;
}

function extractExports(content) {
  const exports = [];
  let match;

  // Named declarations: export const foo, export function bar, etc.
  EXPORT_NAMED_REGEX.lastIndex = 0;
  while ((match = EXPORT_NAMED_REGEX.exec(content)) !== null) {
    if (match[1]) exports.push({ name: match[1], type: 'named' });
  }

  // Default exports: export default class Foo, export default function, etc.
  EXPORT_DEFAULT_REGEX.lastIndex = 0;
  while ((match = EXPORT_DEFAULT_REGEX.exec(content)) !== null) {
    exports.push({ name: match[1] || 'default', type: 'default' });
  }

  // Named export lists: export { foo, bar as baz }
  EXPORT_LIST_REGEX.lastIndex = 0;
  while ((match = EXPORT_LIST_REGEX.exec(content)) !== null) {
    const list = match[1];
    const names = list.split(',').map(s => s.trim().split(/\s+as\s+/i).pop().trim()).filter(Boolean);
    for (const name of names) exports.push({ name, type: 'named' });
  }

  // CommonJS: exports.foo = ..., module.exports.foo = ...
  MODULE_EXPORTS_REGEX.lastIndex = 0;
  while ((match = MODULE_EXPORTS_REGEX.exec(content)) !== null) {
    if (match[1]) exports.push({ name: match[1], type: 'named' });
  }

  // CommonJS default: module.exports = ...
  MODULE_EXPORTS_DEFAULT_REGEX.lastIndex = 0;
  if (MODULE_EXPORTS_DEFAULT_REGEX.test(content)) {
    exports.push({ name: 'default', type: 'default' });
  }

  return exports;
}

function extractImportNames(content) {
  const names = new Set();
  let match;

  // import { foo, bar as baz } from '...'
  const namedImportRegex = /import\s*\{([^}]+)\}\s*from\s*['"][^'"]+['"]/gm;
  while ((match = namedImportRegex.exec(content)) !== null) {
    const items = match[1].split(',').map(s => s.trim().split(/\s+as\s+/i).pop().trim()).filter(Boolean);
    for (const item of items) names.add(item);
  }

  // import foo from '...' (default import)
  const defaultImportRegex = /import\s+(\w+)\s+from\s*['"][^'"]+['"]/gm;
  while ((match = defaultImportRegex.exec(content)) !== null) {
    names.add(match[1]);
  }

  // import * as foo from '...'
  const namespaceImportRegex = /import\s*\*\s+as\s+(\w+)\s+from\s*['"][^'"]+['"]/gm;
  while ((match = namespaceImportRegex.exec(content)) !== null) {
    names.add(match[1]);
  }

  // const foo = require('...')
  const requireRegex = /(?:const|let|var)\s*\{?\s*([^}=]+)\s*\}?\s*=\s*require\s*\(/gm;
  while ((match = requireRegex.exec(content)) !== null) {
    const items = match[1].split(',').map(s => s.trim()).filter(Boolean);
    for (const item of items) names.add(item);
  }

  return names;
}

async function walkFiles(dir, files, options) {
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch { return; }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const rel = path.relative(options.baseDir || dir, full).split(path.sep).join('/');
      const firstDir = rel.split('/')[0];
      if (SKIP_DIRS.has(firstDir)) continue;
      if (entry.name.startsWith('.')) continue;
      await walkFiles(full, files, options);
    } else if (entry.isFile()) {
      files.push({
        path: full,
        relativePath: path.relative(options.baseDir || dir, full).split(path.sep).join('/'),
        ext: path.extname(full).toLowerCase(),
        size: (await fs.promises.stat(full)).size
      });
    }
  }
}

function detectCycles(graph, rootDir) {
  const cycles = [];
  const visited = new Set();
  const recursionStack = new Set();

  function dfs(node, pathStack) {
    if (recursionStack.has(node)) {
      // Found cycle — extract the cycle from pathStack
      const cycleStart = pathStack.indexOf(node);
      const cycle = pathStack.slice(cycleStart).concat(node);
      const relCycle = cycle.map(p => path.relative(rootDir, p).replace(/\\/g, '/'));
      cycles.push({
        id: 'SB-DEPS-001',
        severity: 'high',
        type: 'Circular Dependency',
        filePath: path.relative(rootDir, node).replace(/\\/g, '/'),
        line: 1,
        count: 1,
        description: `Circular dependency detected: ${relCycle.join(' → ')}`,
        recommendedAction: 'Refactor to break the circular dependency — extract shared logic to a separate module or use dependency inversion.',
        affectedFiles: relCycle,
        metadata: { cycle: relCycle }
      });
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    recursionStack.add(node);
    pathStack.push(node);

    const deps = graph.get(node) || [];
    for (const dep of deps) {
      dfs(dep, pathStack);
    }

    pathStack.pop();
    recursionStack.delete(node);
  }

  for (const node of graph.keys()) {
    dfs(node, []);
  }

  return cycles;
}

function detectUnusedExports(fileExports, allImports) {
  const issues = [];
  for (const [filePath, exports] of fileExports.entries()) {
    const importsForFile = allImports.get(filePath) || new Set();
    for (const exp of exports) {
      if (exp.type === 'default') continue; // Skip default exports — too many false positives
      if (!importsForFile.has(exp.name)) {
        issues.push({
          id: 'SB-DEPS-002',
          severity: 'low',
          type: 'Unused Export',
          filePath: filePath,
          line: 1,
          count: 1,
          description: `Export "${exp.name}" in ${filePath} is not imported by any other module in the scan scope`,
          recommendedAction: 'Remove the unused export or verify it is consumed by external consumers (e.g., test files, CLI entry points).',
          affectedFiles: [filePath],
          metadata: { unusedExports: [exp.name] }
        });
      }
    }
  }
  return issues;
}

function detectOrphanedModules(fileGraph, fileExports, rootDir) {
  const issues = [];
  for (const [filePath, exports] of fileGraph.entries()) {
    const deps = fileGraph.get(filePath) || [];
    // A file is orphaned if:
    // 1. No other file imports it (not a dependency of anything)
    // 2. It has no imports (isolated) OR its exports are unused
    let isImported = false;
    for (const [otherPath, otherDeps] of fileGraph.entries()) {
      if (otherPath === filePath) continue;
      if (otherDeps.includes(filePath)) { isImported = true; break; }
    }

    if (!isImported && exports.length > 0) {
      const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');
      issues.push({
        id: 'SB-DEPS-003',
        severity: 'low',
        type: 'Orphaned Module',
        filePath: relPath,
        line: 1,
        count: 1,
        description: `Module ${relPath} is not imported by any other module in the scan scope`,
        recommendedAction: 'Check if this is an entry point (expected) or dead code that should be removed.',
        affectedFiles: [relPath],
        metadata: { orphan: true }
      });
    }
  }
  return issues;
}

async function scanDependencyGraph(baseDir, options = {}) {
  const sourcePaths = options.sourcePaths || ['src', 'lib', 'server', 'web'];
  const productionPaths = options.productionPaths || sourcePaths;
  const pathsToWalk = [...new Set([...sourcePaths, ...productionPaths])];

  const files = [];
  for (const rel of pathsToWalk) {
    const abs = path.isAbsolute(rel) ? rel : path.join(baseDir, ...rel.split('/'));
    if (fs.existsSync(abs)) {
      await walkFiles(abs, files, { baseDir });
    }
  }

  // Build dependency graph
  const fileGraph = new Map(); // filePath -> [dependencyPaths]
  const fileExports = new Map(); // filePath -> [{name, type}]
  const allImports = new Map();  // importingFilePath -> Set(importedNames)

  for (const file of files) {
    if (!isScannable(file.path)) continue;
    if (isExcludedPath(file.path, baseDir)) continue;

    let content;
    try {
      content = await fs.promises.readFile(file.path, 'utf8');
    } catch { continue; }

    const imports = extractImports(content);
    const exports = extractExports(content);
    const importNames = extractImportNames(content);

    const resolvedDeps = [];
    for (const imp of imports) {
      const resolved = resolveImportPath(imp.raw, file.path, pathsToWalk);
      if (resolved) resolvedDeps.push(resolved);
    }

    const relPath = path.relative(baseDir, file.path).replace(/\\/g, '/');
    fileGraph.set(file.path, resolvedDeps);
    fileExports.set(relPath, exports);
    allImports.set(relPath, importNames);
  }

  // Also populate reverse: for each file, record which names are imported FROM it
  const importsFromFile = new Map(); // filePath -> Set(importedName)
  for (const [importingFile, depPaths] of fileGraph.entries()) {
    for (const depPath of depPaths) {
      const depRel = path.relative(baseDir, depPath).replace(/\\/g, '/');
      const names = allImports.get(path.relative(baseDir, importingFile).replace(/\\/g, '/')) || new Set();
      if (!importsFromFile.has(depRel)) importsFromFile.set(depRel, new Set());
      for (const name of names) importsFromFile.get(depRel).add(name);
    }
  }

  const issues = [];

  // Detect circular dependencies
  const cycleIssues = detectCycles(fileGraph, baseDir);
  issues.push(...cycleIssues);

  // Detect unused exports
  const unusedExportIssues = detectUnusedExports(fileExports, importsFromFile);
  issues.push(...unusedExportIssues);

  // Detect orphaned modules
  const orphanIssues = detectOrphanedModules(fileGraph, fileExports, baseDir);
  issues.push(...orphanIssues);

  return {
    scanned: files.length,
    findings: issues.length,
    issues,
    results: [],
    dependencyGraph: {
      nodes: Array.from(fileGraph.keys()).map(p => path.relative(baseDir, p).replace(/\\/g, '/')),
      edges: Array.from(fileGraph.entries()).flatMap(([from, tos]) =>
        tos.map(to => ({ from: path.relative(baseDir, from).replace(/\\/g, '/'), to: path.relative(baseDir, to).replace(/\\/g, '/') }))
      )
    }
  };
}

module.exports = { scanDependencyGraph };
