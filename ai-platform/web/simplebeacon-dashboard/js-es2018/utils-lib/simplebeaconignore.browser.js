/**
 * Browser-side .simplebeaconignore parser and matcher (mirrors CLI glob-utils + isIgnoredPath).
 */

const _globRegexCache = new Map();

function globToRegex(pattern) {
  if (typeof pattern !== 'string') return /(?!)/;
  let regex = '^';
  for (let i = 0; i < pattern.length; i += 1) {
    const c = pattern[i];
    if (c === '*' && pattern[i + 1] === '*') {
      i += 1;
      if (pattern[i + 1] === '/') {
        regex += '(?:.*/)?';
        i += 1;
      }
      else {
        regex += '.*';
      }
    }
    else if (c === '*') {
      regex += '[^/]*';
    }
    else if (c === '?') {
      regex += '[^/]';
    }
    else {
      regex += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  regex += '$';
  try {
    return new RegExp(regex);
  }
  catch {
    return /(?!)/;
  }
}

function cachedGlobToRegex(pattern) {
  if (typeof pattern !== 'string') return /(?!)/;
  if (_globRegexCache.has(pattern)) return _globRegexCache.get(pattern);
  const re = globToRegex(pattern);
  _globRegexCache.set(pattern, re);
  return re;
}

/** Minimal fallback when directory pickers omit dotfiles like .simplebeaconignore. */
const BROWSER_BUILTIN_IGNORE = Object.freeze([
  'coming-soon/',
  'simplebeacon-vscode-merged/',
  'simplebeacon-vscode/',
  'scan-exports/',
  'simplebeacon-rule-tests/',
  'guardrail-test-bench/',
  'benchmark-*/',
  'false-positive-audit/',
  'report-deliveries/',
  'node_modules/',
  '**/.git/',
  '**/.simplebeacon/',
  '**/.github-sync/',
  '**/github-cache/',
  '**/.vscode-test/',
  '**/__tests__/**',
  '**/*.test.js',
  '**/*.test.cjs',
  '**/*.test.mjs',
  '**/*.spec.js',
  '**/*.spec.cjs',
  'packages/simplebeacon-cli/tests/',
  'packages/simplebeacon-cli/src/lib/credential-pattern-scanner.js',
  'packages/simplebeacon-cli/src/rules/security-pattern-scanner.js',
  'packages/simplebeacon-cli/src/rules/comprehensive-scanner.js',
  'ai-platform/server/lib/codebase-analyzer-patterns.cjs',
  'ai-platform/server/lib/code-hygiene-certificate.cjs',
  'ai-platform/web/simplebeacon-dashboard/js-es2018/workers/scan-worker.js',
  'ai-platform/web/simplebeacon-dashboard/js-es2018/services/scanWorker.js',
  'ai-platform/web/simplebeacon-dashboard/js-es2018/services/browserSandboxScanService.js',
  'simplebeacon-results-*.json',
  'simplebeacon-cascadeprojects-*.json',
  'simplebeacon-report-*.json',
  'complete-scan*.json',
  'gate-status*.txt',
  'scan-output*.txt',
  '*.vsix',
  '**/*.vsix'
]);

export function parseSimplebeaconIgnoreText(text) {
  if (typeof text !== 'string' || !text.trim()) return [];
  const patterns = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      patterns.push(trimmed.replace(/\\/g, '/'));
    }
  }
  return patterns;
}

export function getBrowserBuiltinIgnorePatterns() {
  return BROWSER_BUILTIN_IGNORE.slice();
}

export function isIgnoredPath(rel, ignorePatterns) {
  if (!Array.isArray(ignorePatterns) || !ignorePatterns.length || typeof rel !== 'string') return false;
  return ignorePatterns.some((pat) => {
    const normalized = pat.replace(/\/$/, '');
    if (rel === pat || rel === normalized) return true;
    if (rel.startsWith(`${normalized}/`)) return true;
    return cachedGlobToRegex(pat).test(rel);
  });
}

export function pathMatchCandidates(virtualPath, scanRootName) {
  const normalized = String(virtualPath || '').replace(/\\/g, '/');
  const candidates = new Set([normalized]);
  if (scanRootName) {
    const prefix = `${scanRootName}/`;
    if (normalized.startsWith(prefix)) {
      candidates.add(normalized.slice(prefix.length));
    }
  }
  return [...candidates];
}

export function isIgnoredVirtualPath(virtualPath, scanRootName, ignorePatterns) {
  if (!Array.isArray(ignorePatterns) || !ignorePatterns.length) return false;
  return pathMatchCandidates(virtualPath, scanRootName).some((rel) => isIgnoredPath(rel, ignorePatterns));
}

export function createIgnoreContext(patterns, scanRootName, source) {
  const hasPatterns = Array.isArray(patterns) && patterns.length;
  const resolved = hasPatterns ? patterns.slice() : getBrowserBuiltinIgnorePatterns();
  return {
    patterns: resolved,
    scanRootName: scanRootName || '',
    source: source || (hasPatterns ? 'simplebeaconignore' : 'builtin')
  };
}

export function filterQueueByIgnore(fileQueue, ignoreCtx) {
  if (!ignoreCtx?.patterns?.length || !Array.isArray(fileQueue)) return fileQueue || [];
  return fileQueue.filter((item) => {
    const virtualPath = item.virtualPath || item.path || '';
    return !isIgnoredVirtualPath(virtualPath, ignoreCtx.scanRootName, ignoreCtx.patterns);
  });
}

export async function loadIgnorePatternsFromDirHandle(dirHandle) {
  if (!dirHandle || typeof dirHandle.getFileHandle !== 'function') {
    return { patterns: getBrowserBuiltinIgnorePatterns(), source: 'builtin' };
  }
  try {
    const ignoreHandle = await dirHandle.getFileHandle('.simplebeaconignore');
    const file = await ignoreHandle.getFile();
    const patterns = parseSimplebeaconIgnoreText(await file.text());
    if (patterns.length) return { patterns, source: 'simplebeaconignore' };
  }
  catch {
    // Dotfile missing from picker — fall back to built-in exclusions.
  }
  return { patterns: getBrowserBuiltinIgnorePatterns(), source: 'builtin' };
}

export async function extractIgnorePatternsFromLegacyFiles(files) {
  const list = Array.isArray(files) ? files : Array.from(files || []);
  const ignoreFile = list.find((file) => {
    const path = (file.webkitRelativePath || file.name || '').replace(/\\/g, '/');
    return /(?:^|\/)\.simplebeaconignore$/i.test(path) || path.endsWith('.simplebeaconignore');
  });
  if (ignoreFile) {
    try {
      const patterns = parseSimplebeaconIgnoreText(await ignoreFile.text());
      if (patterns.length) return { patterns, source: 'simplebeaconignore' };
    }
    catch {
      // Fall through to built-in list.
    }
  }
  return { patterns: getBrowserBuiltinIgnorePatterns(), source: 'builtin' };
}
