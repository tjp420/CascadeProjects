/**
 * Path and repository URL validation for analysis/upload endpoints.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('../../src/lib/app-logger.cjs');
const { readJsonFileCached } = require('./json-file-cache.cjs');

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

/**
 * Should log path access.
 * @returns {any}
 */
function shouldLogPathAccess() {
    return process.env.LOG_ANALYZE_PATH_ACCESS === 'true'
        || process.env.LOG_RUNTIME_INFO === 'true'
        || process.env.RUNTIME_DEBUG === 'true';
}

/**
 * Format allowed roots summary.
 * @param {Array} allowedRoots
 * @param {number} limit
 * @returns {any}
 */
function formatAllowedRootsSummary(allowedRoots, limit = 8) {
    return dedupeResolvedRoots(allowedRoots)
        .slice(0, limit)
        .join('; ');
}

/**
 * Log path access.
 * @param {any} event
 * @param {string} targetPath
 * @param {Array} allowedRoots
 * @returns {any}
 */
function logPathAccess(event, targetPath, allowedRoots) {
    if (!shouldLogPathAccess()) return;
    logger.info(
        `[path-safety] ${event}: ${path.resolve(targetPath)} (roots: ${formatAllowedRootsSummary(allowedRoots, 4) || '(none)'})`
    );
}

/**
 * Log resolved allowed roots.
 * @param {Array} allowedRoots
 * @param {string} context
 * @returns {any}
 */
function logResolvedAllowedRoots(allowedRoots, context = 'startup') {
    if (!shouldLogPathAccess()) return;
    const summary = formatAllowedRootsSummary(allowedRoots);
    logger.info(`[path-safety] ${context}: allowed analysis roots -> ${summary || '(none)'}`);
}

/**
 * Parse allowed roots.
 * @param {any} envValue
 * @param {Array} fallbackRoots
 * @returns {any}
 */
function parseAllowedRoots(envValue, fallbackRoots = []) {
    const fromEnv = String(envValue || '')
        .split(/[;,]/)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => path.resolve(entry));

    const roots = [...fallbackRoots.map((entry) => path.resolve(entry)), ...fromEnv];
    return [...new Set(roots)];
}

/**
 * Detect monorepo root.
 * @param {any} platformRoot
 * @returns {any}
 */
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
        if (fs.existsSync(path.join(sibling, 'simplebeacon-server.js'))
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

/**
 * Load config analyze roots.
 * @param {any} platformRoot
 * @returns {any}
 */
function isWindowsDrivePath(entry) {
    return /^[A-Za-z]:[\\/]/.test(String(entry || '').trim());
}

function loadConfigAnalyzeRoots(platformRoot) {
    try {
        const configPath = path.join(platformRoot, '.simplebeacon', 'config.json');
        if (!fs.existsSync(configPath)) return [];
        const config = readJsonFileCached(configPath);
        if (!config) return [];
        const roots = config.allowedAnalysisRoots || config.analyzeRoots;
        if (!Array.isArray(roots)) return [];
        const platform = path.resolve(platformRoot);
        const isWindowsHost = process.platform === 'win32' || /^win/.test(process.platform);
        return roots
            .map((entry) => String(entry || '').trim())
            .filter(Boolean)
            .filter((entry) => isWindowsHost || !isWindowsDrivePath(entry))
            .map((entry) => (path.isAbsolute(entry) ? path.resolve(entry) : path.resolve(platform, entry)));
    } catch {
        return [];
    }
}

/**
 * Dedupe resolved roots.
 * @param {Array} roots
 * @returns {any}
 */
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

/**
 * Resolve default allowed roots.
 * @param {any} platformRoot
 * @param {Object} options
 * @returns {any}
 */
function listLocalDriveRoots() {
    const drives = [];
    for (let i = 65; i <= 90; i++) {
        const letter = String.fromCharCode(i);
        const drive = `${letter}:/`;
        try {
            if (fs.existsSync(drive)) {
                drives.push(drive);
            }
        }
        catch (e) { /* skip inaccessible drives */ }
    }
    return drives;
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

    // Include all local drives (Windows) or the platform drive root so the
    // directory browser can reach folders outside the default workspace.
    chain.push(...listLocalDriveRoots());

    const tmpGitCache = path.join(os.tmpdir(), 'sb-github-cache');
    chain.push(tmpGitCache);

    // Render deployment fallback: allow the standard Render project checkout root
    // when the platform directory is located inside it, and also allow the Render
    // working directory root so users can scan projects placed directly under /opt/render.
    if (process.env.RENDER === 'true' || platform.includes('/opt/render/project/src/')) {
        const renderProjectRoot = path.resolve('/opt/render/project/src');
        const platformParent = path.resolve(path.join(platform, '..'));
        if (platformParent.startsWith(renderProjectRoot) && fs.existsSync(platformParent)) {
            chain.push(platformParent);
        }
        const renderRoot = path.resolve('/opt/render');
        if (platform.startsWith(renderRoot) && fs.existsSync(renderRoot)) {
            chain.push(renderRoot);
        }
    }

    const merged = dedupeResolvedRoots(chain);
    const cwd = path.resolve(process.cwd());
    if (isPathWithinRoots(cwd, merged)) {
        merged.push(cwd);
    }

    return dedupeResolvedRoots(merged);
}

/**
 * Normalize path key.
 * @param {any} value
 * @returns {any}
 */
function normalizePathKey(value) {
    return path.resolve(value).replace(/\\/g, '/').toLowerCase();
}

/**
 * Is path within roots.
 * @param {string} targetPath
 * @param {Array} allowedRoots
 * @returns {any}
 */
function isPathWithinRoots(targetPath, allowedRoots) {
    const resolved = path.resolve(targetPath);
    const targetKey = normalizePathKey(resolved);

    // Direct match or child path
    const directMatch = allowedRoots.some((root) => {
        const rootKey = normalizePathKey(root);
        return targetKey === rootKey || targetKey.startsWith(`${rootKey}/`);
    });
    if (directMatch) return true;

    // Bare directory name: try resolving against each allowed root
    const isBareName = !path.isAbsolute(targetPath) && !targetPath.includes(path.sep) && !targetPath.includes('/');
    if (isBareName) {
        return allowedRoots.some((root) => {
            const rootKey = normalizePathKey(root);
            const joined = normalizePathKey(path.join(root, targetPath));
            return joined === rootKey || joined.startsWith(`${rootKey}/`);
        });
    }

    return false;
}

/**
 * Is path an ancestor of any allowed root (but not itself within roots).
 * Useful for directory browsers that need to walk up from a project root.
 * @param {string} targetPath
 * @param {Array} allowedRoots
 * @returns {boolean}
 */
function isPathAncestorOfRoots(targetPath, allowedRoots) {
    const resolved = path.resolve(targetPath);
    const targetKey = normalizePathKey(resolved);
    return allowedRoots.some((root) => {
        const rootKey = normalizePathKey(root);
        return rootKey.startsWith(`${targetKey}/`);
    });
}

/**
 * Find the shallowest allowed root that is a strict descendant of targetPath.
 * Returns null if no descendant exists. Shallowest is preferred for analysis
 * so that selecting an ancestor (e.g., /opt) resolves to the project root
 * rather than a nested platform directory.
 * @param {string} targetPath
 * @param {Array} allowedRoots
 * @returns {string|null}
 */
function findShallowestDescendantRoot(targetPath, allowedRoots) {
    const resolved = path.resolve(targetPath);
    const targetKey = normalizePathKey(resolved);
    const descendants = allowedRoots
        .map((root) => ({ root, key: normalizePathKey(root) }))
        .filter(({ key }) => key.startsWith(`${targetKey}/`))
        .sort((a, b) => a.key.length - b.key.length);
    return descendants.length ? descendants[0].root : null;
}

/**
 * Assert safe project path.
 * @param {string} targetPath
 * @param {Array} allowedRoots
 * @param {any} label
 * @returns {any}
 */
function assertSafeProjectPath(targetPath, allowedRoots, label = 'projectPath') {
    const raw = String(targetPath || '').trim();
    if (!raw) {
        throw new Error(`${label} is required`);
    }
    if (/\0/.test(raw)) {
        throw new Error(`${label} contains invalid characters`);
    }

    let resolved = path.resolve(raw);

    // Render deployment fallback: if the requested path does not exist but is
    // inside a Render-style monorepo checkout, fall back to the monorepo root.
    if (!fs.existsSync(resolved) && allowedRoots.length) {
        const normalizedResolved = normalizePathKey(resolved);
        const monoRoot = allowedRoots.find((root) => {
            const normalized = normalizePathKey(root);
            return normalized.endsWith('/ai-platform') === false && normalizedResolved.startsWith(normalized + '/');
        });
        if (monoRoot) {
            const platformDir = path.join(monoRoot, 'ai-platform');
            if (fs.existsSync(platformDir)) {
                resolved = path.resolve(monoRoot);
            }
        }
    }

    // Second Render fallback: the path may contain ai-platform/<repoName> where the
    // actual repo was cloned into <repoName>. Try <parent>/ai-platform/<repoName>
    // translated to <parent>/<repoName>/ai-platform as the platform root.
    if (!fs.existsSync(resolved)) {
        const normalized = normalizePathKey(resolved);
        const platformIdx = normalized.indexOf('/ai-platform/');
        if (platformIdx !== -1) {
            const aiPlatformParent = path.dirname(resolved);
            const segment = path.basename(resolved);
            if (segment) {
                const candidateRoot = path.join(path.dirname(aiPlatformParent), segment);
                const candidatePlatform = path.join(candidateRoot, 'ai-platform');
                if (fs.existsSync(candidatePlatform)) {
                    resolved = path.resolve(candidateRoot);
                    // The resolved root may not be in the pre-populated allowedRoots,
                    // so register it now before the final safety check.
                    allowedRoots.push(resolved);
                    allowedRoots = dedupeResolvedRoots(allowedRoots);
                }
            }
        }
    }

    if (!isPathWithinRoots(resolved, allowedRoots)) {
        // Bare directory name: try resolving against each allowed root
        const isBareName = !path.isAbsolute(raw) && !raw.includes(path.sep) && !raw.includes('/');
        if (isBareName) {
            for (const root of allowedRoots) {
                const candidate = path.join(root, raw);
                if (isPathWithinRoots(candidate, allowedRoots)) {
                    resolved = candidate;
                    break;
                }
            }
        }
    }

    // Allow a Render-style fallback root that contains an ai-platform directory,
    // even if it wasn't pre-populated in allowedRoots.
    if (!isPathWithinRoots(resolved, allowedRoots) && !fs.existsSync(resolved)) {
        const platformDir = path.join(resolved, 'ai-platform');
        if (fs.existsSync(platformDir)) {
            allowedRoots.push(resolved);
        }
    }

    // Ancestor fallback: if the requested path is a parent of an allowed root,
    // redirect to the shallowest allowed descendant rather than rejecting the request.
    // This lets users browse up from a project root and still analyze the project root.
    if (!isPathWithinRoots(resolved, allowedRoots) && fs.existsSync(resolved)) {
        const shallowest = findShallowestDescendantRoot(resolved, allowedRoots);
        if (shallowest) {
            resolved = path.resolve(shallowest);
        }
    }

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

/**
 * Validate repo url.
 * @param {string} rawUrl
 * @param {Object} options
 * @returns {any}
 */
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

/**
 * Assert safe executable path.
 * @param {string} binPath
 * @param {any} label
 * @returns {any}
 */
function assertSafeExecutablePath(binPath, label = 'executable') {
    const normalizedExecutablePath = String(binPath || '').trim();
    if (!normalizedExecutablePath) {
        throw new Error(`${label} path is required`);
    }
    if (!path.isAbsolute(normalizedExecutablePath)) {
        throw new Error(`${label} must be an absolute path`);
    }
    if (/[<>"'`$;|&\n\r]/.test(normalizedExecutablePath)) {
        throw new Error(`${label} contains invalid characters`);
    }
    return normalizedExecutablePath;
}

module.exports = {
    parseAllowedRoots,
    resolveDefaultAllowedRoots,
    detectMonorepoRoot,
    loadConfigAnalyzeRoots,
    formatAllowedRootsSummary,
    logResolvedAllowedRoots,
    isPathWithinRoots,
    isPathAncestorOfRoots,
    findShallowestDescendantRoot,
    assertSafeProjectPath,
    dedupeResolvedRoots,
    validateRepoUrl,
    assertSafeExecutablePath,
    DEFAULT_ALLOWED_HOSTS
};
