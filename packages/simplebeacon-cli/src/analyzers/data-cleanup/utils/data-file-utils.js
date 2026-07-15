// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
/**
 * Shared helpers for data-quality analyzers.
 */

const constants = require('../../../lib/constants');
const DATA_EXTENSIONS = new Set(['.json', '.csv', '.yaml', '.yml', '.xml', '.sql', '.sqlite', '.db']);
const DATA_PATH_HINTS = [
    'web/data', // simplebeacon:production-leak-intent: analyzer-classifier - Analyzer-internal data file classification hints
    'data/mock', // simplebeacon:production-leak-intent: analyzer-classifier - Analyzer-internal data file classification hints
    'data-central', // simplebeacon:production-leak-intent: analyzer-classifier - Analyzer-internal data file classification hints
    'mock', // simplebeacon:production-leak-intent: analyzer-classifier - Analyzer-internal data file classification hints
    'fixtures', // simplebeacon:production-leak-intent: analyzer-classifier - Analyzer-internal data file classification hints
    'sample', // simplebeacon:production-leak-intent: analyzer-classifier - Analyzer-internal data file classification hints
    '.simplebeacon'
];

function isDataFile(file) {
    if (!DATA_EXTENSIONS.has(file.ext)) return false;
    const rel = file.relativePath.replace(/\\/g, '/').toLowerCase();
    if (DATA_PATH_HINTS.some((hint) => rel.includes(hint))) return true;
    if (/sample|mock|fixture|seed|snapshot/i.test(file.name)) return true;
    return false;
}

function isDataPath(relativePath) {
    const rel = String(relativePath || '').replace(/\\/g, '/').toLowerCase();
    return DATA_PATH_HINTS.some((hint) => rel.includes(hint))
        || /sample|mock|fixture|seed|snapshot/i.test(rel);
}

function daysSince(date) {
    if (!date) return null;
    const ms = Date.now() - new Date(date).getTime();
    return Math.floor(ms / (24 * 60 * constants.ONE_MINUTE_MS));
}

function getGitLastCommitDate(filePath, projectRoot) {
    try {
        const { execFileSync } = require('child_process');
        const output = execFileSync(
            'git',
            ['log', '-1', '--format=%cI', '--', filePath],
            { cwd: projectRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
        ).trim();
        return output ? new Date(output) : null;
    } catch {
        return null;
    }
}

module.exports = {
    DATA_EXTENSIONS,
    DATA_PATH_HINTS,
    isDataFile,
    isDataPath,
    daysSince,
    getGitLastCommitDate
};
