/**
 * Swallowed exception / silent failure scanner (SB-AGENT-001).
 * Detects catch blocks and except handlers that suppress errors without
 * logging, rethrowing, or surfacing the failure — the #1 failure pattern
 * in AI-generated code (Columbia DAPLab 2025 study, 9 critical failure patterns).
 *
 * Patterns detected:
 * - Empty catch blocks: catch {} / catch (e) {}
 * - Catch-and-return-default: catch { return null/false/[]/{} }
 * - Catch-and-return-null with no logging
 * - Python except: pass / except Exception: pass
 * - Python except with bare return
 * - Go if err != nil { return nil } (no wrapping/logging)
 * - 200-OK-with-error-body: catch { res.json({ error: ... }); res.status(200) }
 * - Catch with only a comment (no actual handling)
 */

const fs = require('fs');
const path = require('path');

const SCANNABLE_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.go'
]);

const MAX_SCAN_BYTES = 512000;

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'coverage', 'dist', 'build', 'archive',
  '.simplebeacon', 'fixtures', 'docs', 'coming-soon', 'reports',
  'simplebeacon-rule-tests', 'simplebeacon-toxic-fixtures',
  'ai-platform/web/simplebeacon-dashboard/js-es2018',
  'simplebeacon-vscode-merged/dashboard-web/js-es2018'
]);

const SKIP_FILES = /\.(test|spec)\.(js|cjs|mjs|ts|tsx|py|go)$/i;

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

/**
 * Patterns for JS/TS swallowed exceptions.
 * Each pattern has: regex, severity, description, recommendation
 */
const JS_PATTERNS = [
  {
    id: 'swallowed-empty-catch',
    regex: /catch\s*\([^)]*\)\s*\{\s*\}/g,
    severity: 'high',
    description: 'Empty catch block — exception is silently discarded with no logging or rethrow',
    recommendation: 'Log the error, rethrow it, or handle it explicitly. Silent catches hide bugs in production.'
  },
  {
    id: 'swallowed-catch-comment-only',
    regex: /catch\s*\([^)]*\)\s*\{\s*(?:\/\/[^\n]*\n\s*|\/\*[^]*?\*\/\s*)\}/g,
    severity: 'high',
    description: 'Catch block contains only a comment — no actual error handling',
    recommendation: 'Add real error handling: log the error, rethrow, or propagate it to the caller.'
  },
  {
    id: 'swallowed-catch-return-null',
    regex: /catch\s*\([^)]*\)\s*\{\s*return\s+null\s*;?\s*\}/g,
    severity: 'high',
    description: 'Catch block returns null — caller cannot distinguish failure from empty result',
    recommendation: 'Log the error before returning null, or throw a typed error so callers can handle it.'
  },
  {
    id: 'swallowed-catch-return-undefined',
    regex: /catch\s*\([^)]*\)\s*\{\s*return\s*(?:undefined|void\s+0)?\s*;?\s*\}/g,
    severity: 'high',
    description: 'Catch block returns undefined — caller cannot distinguish failure from missing value',
    recommendation: 'Log the error or throw. Returning undefined from a catch hides failures from callers.'
  },
  {
    id: 'swallowed-catch-return-false',
    regex: /catch\s*\([^)]*\)\s*\{\s*return\s+false\s*;?\s*\}/g,
    severity: 'medium',
    description: 'Catch block returns false — caller cannot distinguish failure from negative result',
    recommendation: 'Log the error before returning false, or use a Result type to separate failure from falsy.'
  },
  {
    id: 'swallowed-catch-return-empty-obj',
    regex: /catch\s*\([^)]*\)\s*\{\s*return\s*(?:\{\s*\}|\[\s*\]|""\s*;?)\s*\}/g,
    severity: 'medium',
    description: 'Catch block returns empty collection/object — masks failure as empty data',
    recommendation: 'Log the error. Returning empty data from a catch makes failures look like empty results.'
  },
  {
    id: 'swallowed-catch-return-default',
    regex: /catch\s*\([^)]*\)\s*\{\s*return\s+(?:0|''|""|`)\s*;?\s*\}/g,
    severity: 'medium',
    description: 'Catch block returns a default value — failure is invisible to the caller',
    recommendation: 'Log the error before returning a default, or throw to let the caller decide.'
  }
];

/**
 * Pattern for Python swallowed exceptions.
 */
const PY_PATTERNS = [
  {
    id: 'swallowed-except-pass',
    regex: /except\s*(?:\w+(?:\s*\([^)]*\))?\s*:)?\s*\n\s*pass/g,
    severity: 'high',
    description: 'Python except: pass — exception is silently discarded',
    recommendation: 'Log the exception, re-raise it, or handle it. Bare pass hides bugs.'
  },
  {
    id: 'swallowed-except-return-none',
    regex: /except\s*(?:\w+(?:\s*\([^)]*\))?\s*:)?\s*\n\s*return\s+None/g,
    severity: 'high',
    description: 'Python except returns None — caller cannot distinguish failure from None result',
    recommendation: 'Log the exception before returning None, or re-raise it.'
  },
  {
    id: 'swallowed-bare-except',
    regex: /except\s*:\s*\n\s*(?:pass|return\s+None|return\s+False)/g,
    severity: 'critical',
    description: 'Bare except: catches ALL exceptions including KeyboardInterrupt and SystemExit',
    recommendation: 'Catch specific exceptions (e.g. except ValueError:) and log or re-raise. Bare except is dangerous.'
  }
];

/**
 * Pattern for Go silent error returns.
 */
const GO_PATTERNS = [
  {
    id: 'swallowed-go-return-nil',
    regex: /if\s+err\s*!=\s*nil\s*\{\s*return\s+nil\s*\}/g,
    severity: 'high',
    description: 'Go error check returns nil without wrapping or logging the error',
    recommendation: 'Wrap the error: return fmt.Errorf("operation failed: %w", err) or log it before returning.'
  },
  {
    id: 'swallowed-go-return-empty',
    regex: /if\s+err\s*!=\s*nil\s*\{\s*return\s+(?:""|nil,\s*nil)\s*\}/g,
    severity: 'high',
    description: 'Go error check returns empty value without propagating the error',
    recommendation: 'Return the error to the caller: return "", err or log it before returning.'
  }
];

function getPatternsForFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.py') return PY_PATTERNS;
  if (ext === '.go') return GO_PATTERNS;
  return JS_PATTERNS;
}

function scanContent(content, filePath) {
  const findings = [];
  const patterns = getPatternsForFile(filePath);

  for (const pattern of patterns) {
    pattern.regex.lastIndex = 0;
    let match;
    while ((match = pattern.regex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split('\n').length;
      const matchedText = match[0].replace(/\n/g, ' ').trim().slice(0, 80);
      findings.push({
        ruleId: pattern.id,
        severity: pattern.severity,
        category: 'agent-failure',
        type: 'SwallowedException',
        description: pattern.description,
        recommendation: pattern.recommendation,
        filePath,
        line,
        snippet: matchedText,
        pattern: pattern.id
      });
    }
  }

  return findings;
}

function scanSwallowedExceptions(rootDir, opts) {
  const options = opts || {};
  const sourcePaths = options.sourcePaths || ['src', 'lib', 'packages', 'ai-platform/server', 'ai-platform/src'];
  const ignoreGlobs = options.ignoreGlobs || [];
  const findings = [];

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(fullPath);
      } else if (entry.isFile() && isScannable(fullPath)) {
        if (isExcludedPath(fullPath, rootDir)) continue;
        try {
          const stat = fs.statSync(fullPath);
          if (stat.size > MAX_SCAN_BYTES) continue;
          const content = fs.readFileSync(fullPath, 'utf8');
          const fileFindings = scanContent(content, fullPath);
          findings.push(...fileFindings);
        } catch (e) {
          // Skip unreadable files
        }
      }
    }
  }

  for (const src of sourcePaths) {
    const srcPath = path.resolve(rootDir, src);
    if (fs.existsSync(srcPath)) {
      walk(srcPath);
    }
  }

  // Also scan root-level scannable files
  try {
    const rootEntries = fs.readdirSync(rootDir, { withFileTypes: true });
    for (const entry of rootEntries) {
      if (entry.isFile() && isScannable(entry.name)) {
        const fullPath = path.join(rootDir, entry.name);
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const fileFindings = scanContent(content, fullPath);
          findings.push(...fileFindings);
        } catch (e) {
          // Skip
        }
      }
    }
  } catch (e) {
    // Skip
  }

  return {
    ruleId: 'swallowed-exception',
    findings
  };
}

module.exports = {
  scanSwallowedExceptions,
  scanContent,
  JS_PATTERNS,
  PY_PATTERNS,
  GO_PATTERNS
};
