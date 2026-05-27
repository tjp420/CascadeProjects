/**
 * Path and repository URL validation for analysis/upload endpoints.
 */

const fs = require('fs');
const path = require('path');
const logger = require('./app-logger');

const PLATFORM_DIR_NAMES = ['ai-platform'];

const DEFAULT_ALLOWED_SCHEMES = ['https:'];
const DEFAULT_ALLOWED_HOSTS = [
    'github.com',
    'www.github.com',
    'gitlab.com',
    'www.gitlab.com',
    'bitbucket.org',
    'www.bitbucket.org'
];

function shouldLogPathAccess() {
    return process.env.LOG_ANALYZE_PATH_ACCESS === 'true'
        || process.env.LOG_RUNTIME_INFO === 'true'
        || process.env.RUNTIME_DEBUG === 'true';
}

function formatAllowedRootsSummary(allowedRoots, limit = 8) {
    return dedupeResolvedRoots(allowedRoots)
        .slice(0, limit)
        .join('; ');
}

function logPathAccess(event, targetPath, allowedRoots) {
    if (!shouldLogPathAccess()) return;
    logger.info(
        `[path-safety] ${event}: ${path.resolve(targetPath)} (roots: ${formatAllowedRootsSummary(allowedRoots, 4) || '(none)'})`
    );
}

function logResolvedAllowedRoots(allowedRoots, context = 'startup') {
    if (!shouldLogPathAccess()) return;
    const summary = formatAllowedRootsSummary(allowedRoots);
    logger.info(`[path-safety] ${context}: allowed analysis roots -> ${summary || '(none)'}`);
}

function parseAllowedRoots(envValue, fallbackRoots = []) {
    const fromEnv = String(envValue || '')
        .split(/[;,]/)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => path.resolve(entry));

    const roots = [...fallbackRoots.map((entry) => path.resolve(entry)), ...fromEnv];
    return [...new Set(roots)];
}

function detectMonorepoRoot(platformRoot) {
    const resolved = path.resolve(platformRoot);
    const parent = path.dirname(resolved);
    if (parent === resolved) return null;

    const baseName = path.basename(resolved).toLowerCase();
    if (PLATFORM_DIR_NAMES.includes(baseName)) {
        return parent;
    }

    for (const name of PLATFORM_DIR_NAMES) {
        const sibling = path.join(parent, name);
        if (fs.existsSync(path.join(sibling, 'gguf-dashboard-server.js'))
            || fs.existsSync(path.join(sibling, 'packages', 'simplebeacon-cli'))) {
            return parent;
        }
    }

    if (fs.existsSync(path.join(resolved, 'packages', 'simplebeacon-cli'))
        && fs.existsSync(path.join(parent, '.git'))) {
        return parent;
    }

    return null;
}

function loadConfigAnalyzeRoots(platformRoot) {
    try {
        const configPath = path.join(platformRoot, '.simplebeacon', 'config.json');
        if (!fs.existsSync(configPath)) return [];
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const roots = config.allowedAnalysisRoots || config.analyzeRoots;
        if (!Array.isArray(roots)) return [];
        const platform = path.resolve(platformRoot);
        return roots
            .map((entry) => String(entry || '').trim())
            .filter(Boolean)
            .map((entry) => (path.isAbsolute(entry) ? path.resolve(entry) : path.resolve(platform, entry)));
    } catch {
        return [];
    }
}

function dedupeResolvedRoots(roots) {
    const seen = new Set();
    const unique = [];
    for (const entry of roots) {
        const resolved = path.resolve(entry);
        const key = normalizePathKey(resolved);
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(resolved);
    }
    return unique;
}

function resolveDefaultAllowedRoots(platformRoot, options = {}) {
    const platform = path.resolve(platformRoot);
    const chain = [];

    const envRoots = parseAllowedRoots(process.env.ANALYZE_ALLOWED_ROOTS, []);
    chain.push(...envRoots);
    chain.push(...loadConfigAnalyzeRoots(platform));

    const monorepoRoot = options.monorepoRoot
        ? path.resolve(options.monorepoRoot)
        : detectMonorepoRoot(platform);
    if (monorepoRoot) {
        chain.push(monorepoRoot);
    }

    chain.push(platform);

    const merged = dedupeResolvedRoots(chain);
    const cwd = path.resolve(process.cwd());
    if (isPathWithinRoots(cwd, merged)) {
        merged.push(cwd);
    }

    return dedupeResolvedRoots(merged);
}

function normalizePathKey(value) {
    return path.resolve(value).replace(/\\/g, '/').toLowerCase();
}

function isPathWithinRoots(targetPath, allowedRoots) {
    const resolved = path.resolve(targetPath);
    const targetKey = normalizePathKey(resolved);

    return allowedRoots.some((root) => {
        const rootKey = normalizePathKey(root);
        return targetKey === rootKey || targetKey.startsWith(`${rootKey}/`);
    });
}

function assertSafeProjectPath(targetPath, allowedRoots, label = 'projectPath') {
    const raw = String(targetPath || '').trim();
    if (!raw) {
        throw new Error(`${label} is required`);
    }
    if (/\0/.test(raw)) {
        throw new Error(`${label} contains invalid characters`);
    }

    const resolved = path.resolve(raw);
    if (!isPathWithinRoots(resolved, allowedRoots)) {
        logPathAccess('deny', resolved, allowedRoots);
        const allowedSummary = formatAllowedRootsSummary(allowedRoots, 6);
        throw new Error(
            `${label} is outside allowed analysis roots. `
            + `Requested: ${resolved}. `
            + `Allowed: ${allowedSummary || '(none)'}. `
            + 'Add the path to ANALYZE_ALLOWED_ROOTS or .simplebeacon/config.json allowedAnalysisRoots, then restart the server.'
        );
    }
    if (!fs.existsSync(resolved)) {
        throw new Error(`${label} does not exist`);
    }
    logPathAccess('allow', resolved, allowedRoots);
    return resolved;
}

function validateRepoUrl(rawUrl, options = {}) {
    const value = String(rawUrl || '').trim();
    if (!value) {
        throw new Error('repoUrl is required');
    }

    let parsed;
    try {
        parsed = new URL(value);
    } catch {
        throw new Error('repoUrl must be a valid HTTPS URL');
    }

    const allowedSchemes = options.allowedSchemes || DEFAULT_ALLOWED_SCHEMES;
    const allowedHosts = options.allowedHosts || DEFAULT_ALLOWED_HOSTS;

    if (!allowedSchemes.includes(parsed.protocol)) {
        throw new Error('repoUrl must use HTTPS');
    }
    if (!allowedHosts.includes(parsed.hostname.toLowerCase())) {
        throw new Error('repoUrl host is not in the allowed provider list');
    }
    if (/[<>"'`$\\;|&]/.test(value)) {
        throw new Error('repoUrl contains invalid characters');
    }
    if (!/^\/[\w.\-/]+(\.git)?\/?$/i.test(parsed.pathname)) {
        throw new Error('repoUrl path is not a valid repository path');
    }

    return parsed.toString().replace(/\/$/, '');
}

function assertSafeExecutablePath(binPath, label = 'executable') {
    const value = String(binPath || '').trim();
    if (!value) {
        throw new Error(`${label} path is required`);
    }
    if (!path.isAbsolute(value)) {
        throw new Error(`${label} must be an absolute path`);
    }
    if (/[<>"'`$;|&\n\r]/.test(value)) {
        throw new Error(`${label} contains invalid characters`);
    }
    return value;
}

module.exports = {
    parseAllowedRoots,
    resolveDefaultAllowedRoots,
    detectMonorepoRoot,
    loadConfigAnalyzeRoots,
    formatAllowedRootsSummary,
    logResolvedAllowedRoots,
    isPathWithinRoots,
    assertSafeProjectPath,
    validateRepoUrl,
    assertSafeExecutablePath,
    DEFAULT_ALLOWED_HOSTS
};
