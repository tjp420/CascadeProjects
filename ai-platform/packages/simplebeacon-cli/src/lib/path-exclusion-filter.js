/**
 * Safely determines if a file path should be excluded based on configuration rules.
 * Replaces project-specific hardcoded strings with a clean dynamic match.
 * @param {string} filePath - The absolute or relative file path being evaluated.
 * @param {Array<string>} userExclusions - Custom exclusion tokens passed from config.
 * @returns {boolean} True if the path should be skipped.
 */

const GLOBAL_DEFAULTS = [
    'node_modules',
    '.git',
    '.github-sync',
    'coverage',
    'dist',
    'build',
    'archive',
    'github-cache',
    'deliverables',
    'simplebeacon-rule-tests',
    'java-ai-vulnerable'
];

function normalizePath(filePath) {
    return String(filePath || '').replace(/\\/g, '/').toLowerCase();
}

function pathSegments(normalizedPath) {
    return normalizedPath.split('/').filter(Boolean);
}

/** Match vendor/output directory names — never filename substrings like jest-coverage-reader.js */
function matchesGlobalExclusion(normalizedPath, pattern) {
    const token = pattern.toLowerCase();
    return pathSegments(normalizedPath).some((segment) => segment === token);
}

function matchesUserExclusion(normalizedPath, pattern) {
    const token = pattern.toLowerCase();
    if (pathSegments(normalizedPath).some((segment) => segment === token)) {
        return true;
    }
    return normalizedPath.includes(token);
}

function shouldExcludePath(filePath, userExclusions = []) {
    const normalizedPath = normalizePath(filePath);

    if (GLOBAL_DEFAULTS.some((pattern) => matchesGlobalExclusion(normalizedPath, pattern))) {
        return true;
    }

    return userExclusions.some((pattern) => matchesUserExclusion(normalizedPath, pattern));
}

module.exports = { shouldExcludePath };
