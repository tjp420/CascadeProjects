/**
 * Dead code / unused imports scanner (SB-QUAL-001).
 * Detects imports that are never referenced and unreachable code blocks.
 */

const fs = require('fs');
const path = require('path');

const SCANNABLE_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx'
]);

const MAX_SCAN_BYTES = 512000;

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'coverage', 'dist', 'build', 'archive',
  '.simplebeacon', 'fixtures', 'docs', 'coming-soon', 'reports',
  'simplebeacon-rule-tests', 'simplebeacon-toxic-fixtures',
  'ai-platform/web/simplebeacon-dashboard/js-es2018',
  'simplebeacon-vscode-merged/dashboard-web/js-es2018'
]);

const SKIP_FILES = /\.(test|spec)\.(js|cjs|mjs|ts|tsx)$/i;
const SKIP_TEMP_FILES = /^(_tmp_|_merged_js|_test_|_test_welcome|inspect_vsix|temp_codemap|tmp-check|__tmp_script|debug-|__test_server|replace-dashboard|test-welcome-load)/i;

function isScannable(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!SCANNABLE_EXTENSIONS.has(ext)) return false;
  if (SKIP_FILES.test(path.basename(filePath))) return false;
  return true;
}

function isExcludedPath(filePath, rootDir) {
  const rel = filePath.replace(rootDir, '').replace(/^[/\\]+/, '');
  const dirs = rel.split(/[/\\]/);
  if (dirs.some((dir) => SKIP_DIRS.has(dir))) return true;
  if (/ai-platform[/\\]web[/\\]simplebeacon-dashboard[/\\]js\b/.test(rel)) return true;
  if (/simplebeacon-vscode-merged[/\\]dashboard-web[/\\]js\b/.test(rel)) return true;
  return false;
}

function extractImports(content) {
  const imports = [];

  // ES6 imports
  const es6Matches = content.matchAll(
    /import\s+(?:(\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"`]([^'"`]+)['"`]/g
  );
  for (const m of es6Matches) {
    const bindings = m[1] ? m[1].trim() : null;
    const modulePath = m[2];
    // Skip side-effect imports (no bindings)
    if (!bindings) continue;
    const names = [];
    if (bindings.includes('{')) {
      const inner = bindings.replace(/[{}]/g, '');
      for (const part of inner.split(',')) {
        const trimmed = part.trim();
        if (trimmed) {
          const aliasMatch = trimmed.match(/^(\w+)\s+as\s+(\w+)$/);
          names.push(aliasMatch ? aliasMatch[2] : trimmed);
        }
      }
    } else if (bindings.includes('* as')) {
      const nsMatch = bindings.match(/\*\s+as\s+(\w+)/);
      if (nsMatch) names.push(nsMatch[1]);
    } else if (bindings !== 'default') {
      names.push(bindings);
    }
    imports.push({ modulePath, names, line: content.substring(0, m.index).split('\n').length });
  }

  // CommonJS requires
  const cjsMatches = content.matchAll(
    /(?:const|let|var)\s+(?:(\{[^}]*\}|\w+)\s*=\s*)?require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g
  );
  for (const m of cjsMatches) {
    const bindings = m[1] ? m[1].trim() : null;
    const modulePath = m[2];
    const names = [];
    if (bindings && bindings.startsWith('{')) {
      const inner = bindings.replace(/[{}]/g, '');
      for (const part of inner.split(',')) {
        const trimmed = part.trim();
        if (trimmed) {
          const aliasMatch = trimmed.match(/^(\w+):\s*(\w+)$/);
          names.push(aliasMatch ? aliasMatch[2] : trimmed);
        }
      }
    } else if (bindings) {
      names.push(bindings);
    }
    imports.push({ modulePath, names, line: content.substring(0, m.index).split('\n').length });
  }

  return imports;
}

function findUnusedImports(content, imports) {
  const unused = [];
  // Check for re-exports: export { foo, bar }
  const reExportMatches = content.match(/export\s*\{[^}]*\}/g) || [];
  const reExportedNames = new Set();
  for (const rex of reExportMatches) {
    const inner = rex.replace(/export\s*\{|\}/g, '');
    for (const part of inner.split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0].trim();
      if (name) reExportedNames.add(name);
    }
  }

  for (const imp of imports) {
    for (const name of imp.names) {
      // Skip common patterns that are used implicitly
      if (['React', 'react', 'jsx', 'createElement', 'Fragment'].includes(name)) continue;
      // Skip if re-exported
      if (reExportedNames.has(name)) continue;
      // Count references excluding the import line itself
      const regex = new RegExp(`\\b${name}\\b`, 'g');
      const matches = content.match(regex);
      const refCount = matches ? matches.length : 0;
      if (refCount <= 1) {
        unused.push({
          ruleId: 'SB-QUAL-001',
          ruleName: 'Unused Import',
          severity: 'low',
          line: imp.line,
          match: name,
          snippet: `Import "${name}" from "${imp.modulePath}" is never referenced`
        });
      }
    }
  }
  return unused;
}

function findUnreachableCode(content) {
  const findings = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Skip if suppression comment on this line
    if (/\/\/\s*simplebeacon-ignore\s+dead-code/i.test(line)) continue;

    // Detect `if (false)` or `if (0)` or `if (null)`
    if (/^if\s*\(\s*(false|0|null|undefined|!true)\s*\)/.test(line)) {
      findings.push({
        ruleId: 'SB-QUAL-001b',
        ruleName: 'Unreachable Code Block',
        severity: 'low',
        line: i + 1,
        match: line.slice(0, 60),
        snippet: `Always-false condition makes the following block unreachable`
      });
    }
    // Detect `return` or `throw` not at end of function with code after
    // Skip if inside a template literal (heuristic: line starts with backtick or contains ${...})
    if (/^return\s+/.test(line) && i + 1 < lines.length) {
      // Skip if this is inside a template literal or string continuation
      if (line.includes('`') || line.includes('${')) continue;
      // Skip if return line opens a new block (callback/collection literal) — code after is inside it
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;
      if (openBraces > closeBraces) continue;
      // Skip if return expression continues on next line (chained methods or operators)
      const nextLine = lines[i + 1].trim();
      if (/^[.\|&+\-*%?:]/.test(nextLine)) continue;
      // Skip if next line is closing brace, comment, or empty
      if (nextLine && !/^[}\/\]`,;*]/.test(nextLine) && !/^(else|catch|finally)\b/.test(nextLine)) {
        findings.push({
          ruleId: 'SB-QUAL-001c',
          ruleName: 'Dead Code After Return',
          severity: 'low',
          line: i + 1,
          match: line.slice(0, 60),
          snippet: `Code after return statement is unreachable`
        });
      }
    }
  }

  return findings;
}

async function scanFile(filePath) {
  let stats;
  try { stats = await fs.promises.stat(filePath); } catch { return null; }
  if (stats.size > MAX_SCAN_BYTES) return null;

  let content;
  try {
    content = await fs.promises.readFile(filePath, 'utf8');
  } catch {
    return null;
  }

  const imports = extractImports(content);
  const findings = [
    ...findUnusedImports(content, imports),
    ...findUnreachableCode(content)
  ];

  return findings.length ? findings : null;
}

async function scanDeadCode(rootDir, options = {}) {
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
          findings: fileFindings
        });
      }
    }
  }

  return {
    rule: 'DEAD_CODE',
    severity: results.length ? 'low' : 'none',
    count: results.reduce((sum, r) => sum + r.findings.length, 0),
    fileCount: results.length,
    results,
    humanReadable: results.length
      ? `Dead code or unused imports found in ${results.length} file(s). Removing dead code reduces bundle size and maintenance burden.`
      : 'No dead code or unused imports detected.'
  };
}

module.exports = { scanDeadCode, extractImports, findUnusedImports, findUnreachableCode };
