/**
 * Read Jest Istanbul json-summary output from coverage/dashboard/coverage-summary.json.
 */

const fs = require('fs');
const path = require('path');
const { readJsonFileCached } = require('./json-file-cache.cjs');

const DEFAULT_RELATIVE_PATH = path.join('coverage', 'dashboard', 'coverage-summary.json');

/**
 * Normalize relative path.
 * @param {string} filePath
 * @param {string} baseDir
 * @returns {any}
 */
function normalizeRelativePath(filePath, baseDir) {
  if (!filePath || filePath === 'total') return null;
  const normalized = filePath.replace(/\\/g, '/');
  const root = path.resolve(baseDir).replace(/\\/g, '/');
  if (normalized.startsWith(root)) {
    return normalized.slice(root.length + 1);
  }
  return normalized;
}

/**
 * Round coverage percentage.
 * @param {any} rawPct
 * @returns {any}
 */
function roundCoveragePercentage(rawPct) {
  if (rawPct == null || Number.isNaN(Number(rawPct))) return null;
  return Math.round(Number(rawPct) * 10) / 10;
}

/**
 * Resolve summary path.
 * @param {string} baseDir
 * @param {Object} options
 * @returns {any}
 */
function resolveSummaryPath(baseDir, options = {}) {
  const candidate =
    options.relativePath || process.env.JEST_COVERAGE_SUMMARY_PATH || DEFAULT_RELATIVE_PATH;

  if (path.isAbsolute(candidate)) {
    return candidate;
  }

  return path.join(baseDir, candidate);
}

/**
 * Load jest coverage summary.
 * @param {string} baseDir
 * @param {Object} options
 * @returns {any}
 */
function loadJestCoverageSummary(baseDir, options = {}) {
  const summaryPath = resolveSummaryPath(baseDir, options);

  if (!fs.existsSync(summaryPath)) {
    return { available: false, summaryPath, totals: null, files: [] };
  }

  let payload;
  try {
    payload = readJsonFileCached(summaryPath);
    if (!payload) {
      return { available: false, summaryPath, totals: null, files: [] };
    }
  } catch (error) {
    return { available: false, summaryPath, error: error.message, totals: null, files: [] };
  }

  const files = [];
  for (const [filePath, metrics] of Object.entries(payload)) {
    if (filePath === 'total' || !metrics || typeof metrics !== 'object') continue;
    files.push({
      relativePath: normalizeRelativePath(filePath, baseDir),
      lines: roundCoveragePercentage(metrics.lines?.pct),
      statements: roundCoveragePercentage(metrics.statements?.pct),
      functions: roundCoveragePercentage(metrics.functions?.pct),
      branches: roundCoveragePercentage(metrics.branches?.pct),
    });
  }

  const total = payload.total || {};
  return {
    available: true,
    summaryPath,
    generatedAt: fs.statSync(summaryPath).mtime.toISOString(),
    totals: {
      lines: roundCoveragePercentage(total.lines?.pct),
      statements: roundCoveragePercentage(total.statements?.pct),
      functions: roundCoveragePercentage(total.functions?.pct),
      branches: roundCoveragePercentage(total.branches?.pct),
    },
    files,
  };
}

module.exports = {
  DEFAULT_RELATIVE_PATH,
  loadJestCoverageSummary,
  normalizeRelativePath,
  resolveSummaryPath,
  roundCoveragePercentage,
};
