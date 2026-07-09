/**
 * Fast comprehensive scanner — string-based checks, no expensive regexes.
 * Cards serviced: ai-indicators, governance, governance-marker, documentation,
 * accessibility, i18n, database-patterns, framework-practices, workspace-health,
 * api-contract, file-naming.
 */

const fs = require('fs');
const path = require('path');

const MAX_SCAN_BYTES = 256000; // smaller limit = faster

// Simple string-includes checks (extremely fast)
const STRING_CHECKS = [
  { id: 'ai-indicators', terms: ['openai', 'langchain', 'anthropic', 'claude', 'gpt-4', 'gpt-3', 'ollama', 'cohere', 'huggingface', 'transformers', 'tensorflow', 'pytorch', 'keras', 'sklearn', 'scikit-learn', 'mlflow', 'wandb'], ext: ['.js','.ts','.jsx','.tsx','.py'] },
  { id: 'governance', terms: ['MIT License', 'Apache License', 'SPDX-License', 'Copyright (c)', 'All rights reserved'], ext: ['.js','.ts','.py'] },
  { id: 'governance-marker', terms: ['CODE_OF_CONDUCT', 'CONTRIBUTING.md', 'SECURITY.md', 'CHANGELOG.md', 'LICENSE', 'NOTICE', 'CODEOWNERS'], ext: ['.js','.ts','.py','.yml','.yaml'] },
  { id: 'database-patterns', terms: ['query(`', 'exec(`', 'execute(`', "query('", "exec('", "execute('"], ext: ['.js','.ts','.jsx','.tsx','.py','.php'] },
  { id: 'framework-practices', terms: ['useEffect(() => {', 'useEffect(()=>'], ext: ['.js','.jsx','.ts','.tsx'] },
  { id: 'workspace-health', terms: ["require('../../../", 'require("../../../', "from '../../../", 'from "../../../'], ext: ['.js','.ts','.jsx','.tsx','.cjs','.mjs'] },
  { id: 'api-contract', terms: ['openapi:', 'swagger:', 'openapi.json', 'swagger.json', 'openapi.yaml', 'swagger.yaml'], ext: ['.js','.ts','.json','.yaml','.yml'] },
  { id: 'documentation', terms: ['export function', 'export class', 'export async function'], ext: ['.js','.ts','.jsx','.tsx','.py'] },
  { id: 'accessibility', terms: ['<img'], ext: ['.html','.jsx','.tsx','.vue','.svelte'] },
  { id: 'i18n', terms: ["textContent = '", 'textContent = "', "innerText = '", 'innerText = "'], ext: ['.js','.ts','.jsx','.tsx'] },
  { id: 'security-headers', terms: ['express()'], ext: ['.js','.ts','.cjs'] }
];

const SKIP_PATH_PATTERNS = [
  /\bnode_modules\b/i,
  /\b\.git\b/i,
  /\bLICENSE\b/i,
  /\bCODE_OF_CONDUCT\b/i,
  /\bCONTRIBUTING\b/i,
  /\bSECURITY\.md\b/i,
  /\bCHANGELOG\b/i,
  /\bREADME\b/i,
  /\bpackage\.json\b/i,
  /\bpackage-lock\.json\b/i,
  /\bvendor\b/i,
  /\bdist\b/i,
  /\bout\b/i,
  /\barchive\b/i,
  /\bscan-exports\b/i,
  /\bfalse-positive-audit\b/i,
  /\bcoming-soon\/js\b/i,
  /\bcoming-soon\/public\b/i,
  /\bsimplebeacon-vscode-merged\/dashboard-web\b/i,
  /\bai-platform\/web\/simplebeacon-dashboard\/js-es2018\b/i,
  /\bai-platform\/web\/simplebeacon-dashboard\/js\b/i,
  /\bsimplebeacon-vscode-merged\/dashboard-web\/js-es2018\b/i,
  /\bsimplebeacon-vscode-merged\/dashboard-web\/js\b/i,
  /temp_codemap_js\.js$/i,
  /tmp-check\.js$/i,
  /_merged_js\d*\.js$/i,
  /_test_js\.js$/i,
  /_test_welcome.*\.js$/i,
  /_tmp_.*\.js$/i,
  /sales\/support\/simulate-registration-flow\.js$/i,
  /ai-platform\/tools\/test-billing-pipeline\.js$/i,
  /comprehensive-scanner\.js$/i,
  /\.min\.(js|css)$/i
];

function shouldSkipPath(relativePath) {
  return SKIP_PATH_PATTERNS.some(p => p.test(relativePath));
}

function shouldSkipCheckForPath(checkId, relativePath) {
  const rel = relativePath.replace(/\\/g, '/');
  // Governance markers are expected in AI platform source files with license headers
  if (checkId === 'governance' || checkId === 'governance-marker') {
    if (/\b(ai-agent\/prompts\.js|eslint\.config\.js|enterprise-dlp\.js|action\.yml|\.github\/workflows\/simplebeacon-ai-hygiene-gate\.yml|consistency-score\.test\.js|packages\/simplebeacon-intelligence\/src\/constants\.js|packages\/simplebeacon-intelligence\/src\/index\.js)\b/.test(rel)) return true;
  }
  // AI SDK usage is expected in AI platform source files
  if (checkId === 'ai-indicators') {
    if (/\b(auto-processor\.js|audit_viz\.py|orchestrator\.test\.js|test-gateway\.js)\b/.test(rel)) return true;
  }
  // security-headers: main server file already has securityHeaders middleware
  if (checkId === 'security-headers') {
    if (/\b(server\/index\.cjs|server\/middleware\/security\.cjs)\b/.test(rel)) return true;
  }
  // workspace-health: monorepo cross-package requires are expected
  if (checkId === 'workspace-health') {
    if (/\b(server\/routes\/compliance-schema-api\.cjs|server\/routes\/demo-simplebeacon-api\.cjs|server\/routes\/flexible-analyze-api\.cjs|server\/lib\/central-data-config\.cjs|packages\/simplebeacon-intelligence\/src\/slm-bridge\.js)\b/.test(rel)) return true;
  }
  return false;
}

// Fast single-pass line scanner (no backtracking regexes)
function scanFileFast(relativePath, ext, content, ruleCounters) {
  const issues = [];
  if (content.length > MAX_SCAN_BYTES) return issues;
  if (shouldSkipPath(relativePath)) return issues;

  const lineCount = content.split('\n').length;
  const rel = relativePath.replace(/\\/g, '/');
  const isSourceDir = /\/(src|lib|server|app|web|components|views|routes|controllers|models|services|packages|rules|analyzers)\//i.test(rel);

  // file-naming: check path itself, not content
  if (/\s/.test(path.basename(relativePath)) && /\.(js|ts|jsx|tsx|cjs|mjs|json|md)$/i.test(relativePath)) {
    issues.push({
      id: `file-naming-${relativePath}`, severity: 'low', type: 'file-naming',
      filePath: relativePath, file: relativePath, line: 1, pattern: 'file-naming', count: 1,
      description: `${relativePath}: File name contains spaces — use kebab-case or snake_case`,
      recommendedAction: 'Rename file to remove spaces', affectedFiles: [path.basename(relativePath)],
      metadata: { ruleId: 'file-naming', match: relativePath }
    });
  }

  const lowerContent = content.toLowerCase();
  const lines = content.split('\n');

  for (const check of STRING_CHECKS) {
    // skip if rule already at max
    const current = ruleCounters[check.id] || 0;
    if (current >= 50) continue;

    // skip known false-positive paths for this check
    if (shouldSkipCheckForPath(check.id, relativePath)) continue;

    // restrict documentation/security-headers to substantial source files
    if ((check.id === 'documentation' || check.id === 'security-headers') && (!isSourceDir || lineCount < 30)) continue;

    if (check.ext && !check.ext.includes(ext)) continue;
    for (const term of check.terms) {
      const lowerTerm = term.toLowerCase();
      if (!lowerContent.includes(lowerTerm)) continue;

      // Find the matching line for context-aware filtering
      const matchLineIndex = lines.findIndex(l => l.toLowerCase().includes(lowerTerm));
      if (matchLineIndex < 0) continue;
      const matchLine = lines[matchLineIndex];
      const lowerLine = matchLine.toLowerCase();

      // Context filters to reduce false positives
      if (check.id === 'governance-marker') {
        // Skip env-var names like SIMPLEBEACON_LICENSE_TOKEN, _LICENSE_SECRET, etc.
        if (/\b\w+_LICENSE_\w+|\b\w+_NOTICE_\w+|SIMPLEBEACON_LICENSE/.test(matchLine)) continue;
        // Skip severity levels in JSDoc/comments: debug | info | notice | warning | critical
        if (/\bdebug\s*\|\s*info\s*\|\s*notice\s*\|\s*warning\s*\|\s*critical\b/.test(matchLine)) continue;
      }
      if (check.id === 'database-patterns') {
        // Skip parameterized queries: $1, $2, ?, or array params after the query string
        if (/\$\d+|\?\s*\]|\[\s*req\.|\[\s*\w+\s*\]/.test(matchLine)) continue;
      }
      if (check.id === 'security-headers') {
        // Skip if file already contains helmet or securityHeaders — those are the fixes
        if (/helmet\(|securityHeaders|security\.headers/.test(lowerContent)) continue;
      }

      issues.push({
        id: `${check.id}-${relativePath}-${term}`, severity: 'low', type: check.id,
        filePath: relativePath, file: relativePath, line: Math.max(1, matchLineIndex + 1), pattern: check.id, count: 1,
        description: `${relativePath}:${Math.max(1, matchLineIndex + 1)} ${check.id} pattern detected`,
        recommendedAction: 'Review and address the identified pattern', affectedFiles: [path.basename(relativePath)],
        metadata: { ruleId: check.id, match: term }
      });
      ruleCounters[check.id] = (ruleCounters[check.id] || 0) + 1;
      break; // Only 1 issue per rule per file
    }
  }

  return issues;
}

async function scanComprehensive(uniqueFiles, options = {}) {
  const results = [];
  let scannedCount = 0;
  const ruleCounters = {};
  const rootDir = options.rootDir || process.cwd();

  // build-readiness: check for missing key project files
  const requiredFiles = ['package.json', '.gitignore', 'README.md', 'LICENSE'];
  for (const req of requiredFiles) {
    if (!fs.existsSync(path.join(rootDir, req))) {
      results.push({
        id: `build-readiness-missing-${req}`, severity: 'low', type: 'build-readiness',
        filePath: req, file: req, line: 1, pattern: 'build-readiness', count: 1,
        description: `Missing ${req} — expected project file not found`,
        recommendedAction: `Add ${req} to project root`, affectedFiles: [req],
        metadata: { ruleId: 'build-readiness', match: req }
      });
    }
  }

  // compliance: check for missing governance files
  const governanceFiles = ['LICENSE', 'CODE_OF_CONDUCT.md', 'SECURITY.md', 'CONTRIBUTING.md'];
  for (const gf of governanceFiles) {
    if (!fs.existsSync(path.join(rootDir, gf))) {
      results.push({
        id: `compliance-missing-${gf}`, severity: 'low', type: 'compliance',
        filePath: gf, file: gf, line: 1, pattern: 'compliance', count: 1,
        description: `Missing ${gf} — governance file not found`,
        recommendedAction: `Add ${gf} to project root`, affectedFiles: [gf],
        metadata: { ruleId: 'compliance', match: gf }
      });
    }
  }

  // test-coverage: build set of test file basenames
  const testBasenames = new Set();
  for (const file of uniqueFiles) {
    const base = path.basename(file.path);
    if (/\.(test|spec)\.(js|ts|jsx|tsx|cjs|mjs)$/i.test(base)) {
      testBasenames.add(base.replace(/\.(test|spec)\.(js|ts|jsx|tsx|cjs|mjs)$/i, ''));
    }
  }

  for (const file of uniqueFiles) {
    if (shouldSkipPath(file.relativePath)) continue;
    let content;
    try {
      content = await fs.promises.readFile(file.path, 'utf8');
    } catch {
      continue;
    }
    scannedCount++;
    results.push(...scanFileFast(file.relativePath, file.ext, content, ruleCounters));

    // test-coverage: flag substantial source files (>50 lines) in meaningful dirs with no test (max 50)
    const baseName = path.basename(file.path, file.ext);
    const rel = file.relativePath.replace(/\\/g, '/');
    const lineCount = content.split('\n').length;
    const isMeaningfulSource = /\/(src|lib|server|app|web|components|views|routes|controllers|models|services)\//i.test(rel) && !/\/(config|configs)\//i.test(rel);
    const isSkippedName = /\b(index|config|types|constants|utils|helpers|setup|init|main|cli|bin)\b/i.test(baseName);
    if ((ruleCounters['test-coverage'] || 0) < 50 && isMeaningfulSource && !isSkippedName && lineCount > 50 && ['.js','.ts','.jsx','.tsx','.cjs','.mjs'].includes(file.ext) && !/\.(test|spec)$/.test(baseName)) {
      if (!testBasenames.has(baseName)) {
        results.push({
          id: `test-coverage-${file.relativePath}`, severity: 'low', type: 'test-coverage',
          filePath: file.relativePath, file: file.relativePath, line: 1, pattern: 'test-coverage', count: 1,
          description: `${file.relativePath}: Source file (${lineCount} lines) has no corresponding test file`,
          recommendedAction: 'Add a test file for this module', affectedFiles: [path.basename(file.relativePath)],
          metadata: { ruleId: 'test-coverage', match: baseName }
        });
        ruleCounters['test-coverage'] = (ruleCounters['test-coverage'] || 0) + 1;
      }
    }
  }

  return {
    scanner: 'comprehensive',
    issues: results,
    summary: `Scanned ${scannedCount} files, found ${results.length} issues across ${new Set(results.map(i => i.type)).size} categories.`
  };
}

module.exports = { scanComprehensive, STRING_CHECKS };
