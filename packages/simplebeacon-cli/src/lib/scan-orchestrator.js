/**
 * Scan pipeline phases — discovery, rule engines, aggregation.
 * CLI and MCP use scan.js; this module documents and composes the lifecycle.
 */

const { analyzeFullDirectory } = require('./full-directory-scanner');
const { runTextRulePasses } = require('./full-tree-rule-pass');
const { runTextRulePassesParallel } = require('./full-tree-scan-pool');
const { scanPythonAstPatterns } = require('./python-ast-scanner');
const { scanJavascriptAstPatterns } = require('./javascript-ast-scanner');

const PHASES = ['discover', 'text-rules', 'python-ast', 'javascript-ast', 'aggregate'];

/**
 * Full-tree scan with optional parallel text-rule workers and AST sidecars.
 */
async function runFullTreePipeline(rootDir, options = {}) {
  const full = await analyzeFullDirectory(rootDir, options);
  const config = options.config || {};
  const sidecarIssues = [];

  if (
    options.rules?.pythonAst !== false &&
    config.rules?.['python-ast-patterns']?.enabled !== false
  ) {
    const py = await scanPythonAstPatterns(rootDir, {
      productionPaths: config.productionPaths,
      ignoreGlobs: config.ignore,
      severity: config.rules?.['python-ast-patterns']?.severity,
    });
    if (py.ok) sidecarIssues.push(...py.issues);
  }

  if (
    options.rules?.javascriptAst !== false &&
    config.rules?.['javascript-ast-patterns']?.enabled !== false
  ) {
    const js = await scanJavascriptAstPatterns(rootDir, {
      productionPaths: config.productionPaths,
      ignoreGlobs: config.ignore,
      severity: config.rules?.['javascript-ast-patterns']?.severity,
    });
    if (js.ok) sidecarIssues.push(...js.issues);
  }

  if (sidecarIssues.length) {
    full.issues = [...full.issues, ...sidecarIssues];
  }

  return {
    phases: PHASES,
    ...full,
  };
}

module.exports = {
  PHASES,
  runFullTreePipeline,
  runTextRulePasses,
  runTextRulePassesParallel,
  scanPythonAstPatterns,
  scanJavascriptAstPatterns,
};
