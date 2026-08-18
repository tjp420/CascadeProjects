/**
 * Real-time file watcher for MCP server.
 *
 * Watches the project directory for changes, debounces per-file (500ms),
 * runs the SimpleBeacon scanners on each changed file, and pushes findings
 * to the MCP client via notifications/message.
 *
 * This gives Cursor, Windsurf, Claude Code, Cline, and Aider the same
 * real-time feedback that the VS Code extension provides natively.
 */

const path = require('path');
const fs = require('fs');

const DEFAULT_DEBOUNCE_MS = 500;
const DEFAULT_MAX_FILE_SIZE_KB = 512; // skip files > 512KB
const SCANABLE_EXTENSIONS = new Set([
    '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.mts', '.cts',
    '.py', '.go', '.rs', '.java', '.kt', '.rb', '.php', '.cs',
    '.vue', '.svelte', '.astro',
    '.json', '.yml', '.yaml', '.toml', '.xml', '.html', '.css', '.scss',
    '.sh', '.bash', '.zsh',
    '.sql', '.graphql', '.gql',
    '.lua'
]);

const SKIP_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', 'out', 'coverage',
    '.next', '.nuxt', '.cache', '.turbo', '.simplebeacon',
    '__pycache__', '.pytest_cache', 'vendor', '.venv', 'venv',
    '.vscode-test', '.vscode', '.cursor', '.windsurf', '.codeium',
    'target', 'debug', 'release'
]);

function isScanable(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (!ext || !SCANABLE_EXTENSIONS.has(ext)) return false;
    // Skip files inside skip directories
    const parts = filePath.replace(/\\/g, '/').split('/');
    if (parts.some((p) => SKIP_DIRS.has(p))) return false;
    return true;
}

function isWithinSize(filePath, maxKB) {
    try {
        const stat = fs.statSync(filePath);
        return stat.isFile() && stat.size <= maxKB * 1024;
    } catch {
        return false;
    }
}

/**
 * Create a real-time watcher for a project root.
 *
 * @param {object} options
 * @param {string} options.projectRoot - Absolute path to watch
 * @param {function} options.scanFile - (absolutePath) => scan result object
 * @param {function} options.onFindings - (filePath, findings, summary) => void
 * @param {number} [options.debounceMs] - Per-file debounce (default 500ms)
 * @param {number} [options.maxFileSizeKB] - Skip files larger than this (default 512KB)
 * @param {object} [options.logger] - { log, error }
 * @returns {{ start: () => void, stop: () => void, isActive: () => boolean, getStats: () => object }}
 */
function createRealtimeWatcher(options) {
    const {
        projectRoot,
        scanFile,
        onFindings,
        debounceMs = DEFAULT_DEBOUNCE_MS,
        maxFileSizeKB = DEFAULT_MAX_FILE_SIZE_KB,
        logger = { log: () => {}, error: () => {} }
    } = options;

    if (!projectRoot || typeof projectRoot !== 'string') {
        throw new Error('projectRoot is required');
    }
    if (typeof scanFile !== 'function') {
        throw new Error('scanFile function is required');
    }
    if (typeof onFindings !== 'function') {
        throw new Error('onFindings callback is required');
    }

    let chokidarWatcher = null;
    let debounceTimers = new Map();
    let active = false;
    let stats = {
        filesWatched: 0,
        filesScanned: 0,
        findingsEmitted: 0,
        errors: 0,
        startedAt: null
    };

    function clearDebounce(filePath) {
        const timer = debounceTimers.get(filePath);
        if (timer) {
            clearTimeout(timer);
            debounceTimers.delete(filePath);
        }
    }

    function clearAllDebounces() {
        for (const timer of debounceTimers.values()) {
            clearTimeout(timer);
        }
        debounceTimers.clear();
    }

    function handleFileChange(filePath) {
        if (!active || !isScanable(filePath) || !isWithinSize(filePath, maxFileSizeKB)) {
            return;
        }

        // Debounce: reset timer for this file
        clearDebounce(filePath);

        const timer = setTimeout(() => {
            debounceTimers.delete(filePath);
            runScan(filePath);
        }, debounceMs);

        debounceTimers.set(filePath, timer);
    }

    function runScan(filePath) {
        try {
            const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
            const result = scanFile(filePath);

            if (!result) return;

            const findings = result.findings || [];
            const blockingCount = result.blockingCount || 0;
            const findingCount = findings.length;

            stats.filesScanned++;

            if (findingCount > 0) {
                stats.findingsEmitted += findingCount;
                logger.log(`[watcher] ${relativePath}: ${findingCount} findings (${blockingCount} blocking)`);
                onFindings(relativePath, findings, {
                    filePath: relativePath,
                    blockingCount,
                    findingCount,
                    severityBreakdown: summarizeSeverities(findings),
                    timestamp: new Date().toISOString()
                });
            } else {
                logger.log(`[watcher] ${relativePath}: clean`);
            }
        } catch (err) {
            stats.errors++;
            logger.error(`[watcher] scan error for ${filePath}:`, err.message);
        }
    }

    function summarizeSeverities(findings) {
        const counts = { critical: 0, high: 0, medium: 0, low: 0 };
        for (const f of findings) {
            const sev = String(f.severity || 'low').toLowerCase();
            if (counts[sev] !== undefined) counts[sev]++;
        }
        return counts;
    }

    function start() {
        if (active) {
            logger.log('[watcher] already active');
            return;
        }

        let chokidar;
        try {
            chokidar = require('chokidar');
        } catch {
            logger.error('[watcher] chokidar not available — real-time monitoring disabled');
            return;
        }

        active = true;
        stats.startedAt = new Date().toISOString();

        const watchGlob = path.join(projectRoot, '**', '*').replace(/\\/g, '/');

        chokidarWatcher = chokidar.watch(projectRoot, {
            ignored: (p) => {
                const parts = p.replace(/\\/g, '/').split('/');
                return parts.some((part) => SKIP_DIRS.has(part));
            },
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 200,
                pollInterval: 50
            }
        });

        chokidarWatcher.on('change', (filePath) => {
            handleFileChange(filePath);
        });

        chokidarWatcher.on('add', (filePath) => {
            handleFileChange(filePath);
        });

        chokidarWatcher.on('error', (err) => {
            stats.errors++;
            logger.error('[watcher] chokidar error:', err.message);
        });

        chokidarWatcher.on('ready', () => {
            const watched = chokidarWatcher.getWatched();
            let count = 0;
            for (const dir of Object.keys(watched)) {
                count += watched[dir].length;
            }
            stats.filesWatched = count;
            logger.log(`[watcher] watching ${count} files in ${projectRoot}`);
        });

        logger.log('[watcher] starting real-time monitoring for', projectRoot);
    }

    function stop() {
        if (!active) return;
        active = false;
        clearAllDebounces();

        if (chokidarWatcher) {
            chokidarWatcher.close().then(() => {
                logger.log('[watcher] stopped');
            }).catch(() => {});
            chokidarWatcher = null;
        }
    }

    function isActive() {
        return active;
    }

    function getStats() {
        return {
            ...stats,
            active,
            projectRoot,
            uptimeMs: stats.startedAt ? Date.now() - new Date(stats.startedAt).getTime() : 0
        };
    }

    return { start, stop, isActive, getStats };
}

module.exports = {
    createRealtimeWatcher,
    isScanable,
    SCANABLE_EXTENSIONS,
    SKIP_DIRS,
    DEFAULT_DEBOUNCE_MS
};
