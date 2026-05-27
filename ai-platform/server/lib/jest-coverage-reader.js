/**
 * Read Jest Istanbul json-summary output from coverage/dashboard/coverage-summary.json.
 */

const fs = require('fs');
const path = require('path');
const { readJsonFileCached } = require('./json-file-cache');

const DEFAULT_RELATIVE_PATH = path.join('coverage', 'dashboard', 'coverage-summary.json');

function normalizeRelativePath(filePath, baseDir) {
    if (!filePath || filePath === 'total') return null;
    const normalized = filePath.replace(/\\/g, '/');
    const root = path.resolve(baseDir).replace(/\\/g, '/');
    if (normalized.startsWith(root)) {
        return normalized.slice(root.length + 1);
    }
    return normalized;
}

function roundPct(value) {
    if (value == null || Number.isNaN(Number(value))) return null;
    return Math.round(Number(value) * 10) / 10;
}

function resolveSummaryPath(baseDir, options = {}) {
    const candidate = options.relativePath
        || process.env.JEST_COVERAGE_SUMMARY_PATH
        || DEFAULT_RELATIVE_PATH;

    if (path.isAbsolute(candidate)) {
        return candidate;
    }

    return path.join(baseDir, candidate);
}

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
            lines: roundPct(metrics.lines?.pct),
            statements: roundPct(metrics.statements?.pct),
            functions: roundPct(metrics.functions?.pct),
            branches: roundPct(metrics.branches?.pct)
        });
    }

    const total = payload.total || {};
    return {
        available: true,
        summaryPath,
        generatedAt: fs.statSync(summaryPath).mtime.toISOString(),
        totals: {
            lines: roundPct(total.lines?.pct),
            statements: roundPct(total.statements?.pct),
            functions: roundPct(total.functions?.pct),
            branches: roundPct(total.branches?.pct)
        },
        files
    };
}

module.exports = {
    DEFAULT_RELATIVE_PATH,
    loadJestCoverageSummary,
    normalizeRelativePath,
    resolveSummaryPath,
    roundPct
};
