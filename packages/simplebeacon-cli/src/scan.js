/**
 * Scan workspace mock/sample data directories for fiction, schema drift, and leaks.
 * simplebeacon:production-leak-intent — -sample.json is an exclusion suffix for
 * scan path filtering, not a production leak.
 * @module scan
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
    validateSampleSchema,
    hashFileContent,
    findDuplicateContentGroups
} = require('./lib/mock-data-schema-validator');
const { PAGE_SAMPLE_SPECS } = require('./lib/page-sample-specs');
const { resolveSampleFilePath } = require('./lib/sample-path-resolver');
const { validateRoadmapFiles } = require('./lib/roadmap-json-specs');
const { checkSampleConsistency } = require('./lib/sample-consistency-checker');
const { scanCredentialPatterns } = require('./lib/credential-pattern-scanner');
const { scanProductionLeaks, globMatch } = require('./rules/production-leak');
const { scanSourceFictionPatterns } = require('./rules/fiction-kpi-patterns');
const { scanLlmSlopPatterns } = require('./rules/llm-slop-patterns');
const { scanAgencyHandoffPatterns } = require('./rules/agency-handoff-patterns');
const { scanEuAiActPatterns } = require('./rules/eu-ai-act-patterns');
const { scanTokenBleedPatterns } = require('./rules/token-bleed-patterns');
const { scanArchitectureDriftPatterns } = require('./rules/architecture-drift-patterns');
const { scanSecurityPatterns } = require('./rules/security-pattern-scanner');
const { checkJestBaseline } = require('./rules/jest-baseline');
const { runFileReductionScan } = require('./lib/file-reduction-orchestrator');
const { scanHardcodedUrls } = require('./rules/hardcoded-url-scanner');
const { scanWeakCrypto } = require('./rules/weak-crypto-scanner');
const { scanSecretInComments } = require('./rules/secret-in-comments-scanner');
const { scanSyncIo } = require('./rules/sync-io-scanner');
const { scanEnvInGit } = require('./rules/env-in-git-scanner');
const { scanReDoS } = require('./rules/redos-scanner');
const { scanPiiLogging } = require('./rules/pii-logging-scanner');
const { scanDeadCode } = require('./rules/dead-code-scanner');
const { scanMemoryLeaks } = require('./rules/memory-leak-scanner');
const { scanTypeSafety } = require('./rules/type-safety-scanner');
const { scanHallucinatedImports } = require('./rules/hallucinated-import-scanner');
const { scanAstStructural } = require('./rules/ast-structural-scanner');
const { loadSimplebeaconConfig, resolveScanPaths, isRuleEnabled, getRuleOptions, sanitizeConfigForTier } = require('./config');
const { detectTier } = require('./lib/tier-detector');
const { checkLocalScanQuota, incrementLocalScan, incrementPipelineScan, isPipelineScan } = require('./lib/scan-usage-tracker');
const { resolvePlatformRoot, isIsolatedScanRoot } = require('./project-detect');
const { countRepositoryInventory } = require('./lib/repository-inventory');
const { normalizePathKey } = require('./lib/path-utils');
const { sanitizePath } = require('./lib/path-sanitizer');
const {
    isExternalBenchmarkCachePath,
    partitionBenchmarkIssues,
    MOCK_WALK_SKIP_DIRS,
    FULL_SCAN_SKIP_DIRS
} = require('./lib/benchmark-cache-paths');
const { normalizePlatformScanReport } = require('./lib/normalize-scan-report');
const { evaluateGate } = require('./gate');
const { isBlockingIssue, groupIssues, countBySeverity, computeQualityScoreFromIssues } = require('./lib/issue-utils');
const { clearJsonFileCache } = require('../../../ai-platform/server/lib/json-file-cache.cjs');
const constants = require('../../../ai-platform/server/config/constants.cjs');

// Scan-session file content cache — eliminates redundant I/O when multiple rules read the same file
const fileContentCache = new Map();
/** 256MB cache budget. */
const MAX_CACHE_BYTES = 256 * 1024 * 1024;
let currentCacheBytes = 0;

/**
 * Add a file's content to the LRU cache, evicting oldest entries if over budget.
 * @param {string} filePath
 * @param {string} content
 * @returns {void}
 */
function _addToCache(filePath, content) {
    if (typeof filePath !== 'string' || typeof content !== 'string') return;
    const bytes = Buffer.byteLength(content, 'utf8');
    if (bytes > MAX_CACHE_BYTES) return; // Skip files larger than cache budget

    // If already cached, subtract old size before re-adding so the budget stays correct.
    if (fileContentCache.has(filePath)) {
        const oldContent = fileContentCache.get(filePath);
        if (oldContent !== undefined) {
            currentCacheBytes -= Buffer.byteLength(oldContent, 'utf8');
        }
        fileContentCache.delete(filePath);
    }

    // Evict oldest entries until we have room (LRU via insertion order)
    while (currentCacheBytes + bytes > MAX_CACHE_BYTES && fileContentCache.size > 0) {
        const firstKey = fileContentCache.keys().next().value;
        const firstContent = fileContentCache.get(firstKey);
        if (firstContent === undefined) {
            fileContentCache.delete(firstKey);
            continue;
        }
        currentCacheBytes -= Buffer.byteLength(firstContent, 'utf8');
        fileContentCache.delete(firstKey);
    }
    fileContentCache.set(filePath, content);
    currentCacheBytes += bytes;
}

/**
 * Read a file synchronously with caching.
 * Skips caching for files larger than the cache budget.
 * @param {string} filePath
 * @returns {string}
 */
function readFileCached(filePath) {
    if (typeof filePath !== 'string') throw new TypeError('readFileCached expects a string path');
    if (fileContentCache.has(filePath)) {
        // Touch: delete and re-insert to promote to most-recently-used
        const content = fileContentCache.get(filePath);
        fileContentCache.delete(filePath);
        fileContentCache.set(filePath, content);
        return content;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    if (Buffer.byteLength(content, 'utf8') <= MAX_CACHE_BYTES) {
        _addToCache(filePath, content);
    }
    return content;
}

/**
 * Read a file asynchronously with caching.
 * Skips caching for files larger than the cache budget.
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function readFileCachedAsync(filePath) {
    if (typeof filePath !== 'string') throw new TypeError('readFileCachedAsync expects a string path');
    if (fileContentCache.has(filePath)) {
        const content = fileContentCache.get(filePath);
        fileContentCache.delete(filePath);
        fileContentCache.set(filePath, content);
        return content;
    }
    const content = await fs.promises.readFile(filePath, 'utf8');
    if (Buffer.byteLength(content, 'utf8') <= MAX_CACHE_BYTES) {
        _addToCache(filePath, content);
    }
    return content;
}

/**
 * Clear the scan-session file content cache and reset the byte counter.
 * @returns {void}
 */
function clearFileContentCache() {
    fileContentCache.clear();
    currentCacheBytes = 0;
}

const BINARY_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', '.webp', '.avif',
    '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z', '.bz2',
    '.exe', '.dll', '.so', '.dylib', '.bin',
    '.mp3', '.mp4', '.wav', '.avi', '.mov', '.mkv',
    '.woff', '.woff2', '.ttf', '.otf', '.eot',
    '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.sqlite', '.db', '.lock'
]);

/**
 * Count lines in a text file.
 * @param {string} filePath
 * @param {string} ext
 * @returns {Promise<number>}
 */
async function countFileLines(filePath, ext) {
    if (typeof filePath !== 'string') return 0;
    if (BINARY_EXTENSIONS.has(ext)) return 0;
    try {
        const content = await readFileCachedAsync(filePath);
        // Count newlines without creating a large intermediate array
        let lines = 0;
        for (let i = 0; i < content.length; i++) {
            if (content[i] === '\n') lines++;
        }
        return content.length > 0 ? lines + 1 : 0;
    } catch {
        return 0;
    }
}

const EXT_CATEGORIES = {
    '.json': 'JSON Files',
    '.csv': 'CSV Files',
    '.xml': 'XML Files',
    '.sql': 'Database Files',
    '.db': 'Database Files',
    '.sqlite': 'Database Files',
    '.yaml': 'Config Files',
    '.yml': 'Config Files',
    '.txt': 'Text Files',
    '.md': 'Documentation Files'
};

/**
 * Deduplicate scanned files by normalized path key.
 * @param {Array<{path:string,name:string,ext:string,size:number,relativePath:string}>} files
 * @returns {Array<{path:string,name:string,ext:string,size:number,relativePath:string}>}
 */
function dedupeScannedFiles(files) {
    if (!Array.isArray(files)) return [];
    const seen = new Set();
    const unique = [];
    for (const file of files) {
        const key = normalizePathKey(file.path);
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(file);
    }
    return unique;
}

/**
 * Get a relative path with forward slashes.
 * @param {string} baseDir
 * @param {string} filePath
 * @returns {string}
 */
function displayRelativePath(baseDir, filePath) {
    if (typeof baseDir !== 'string' || typeof filePath !== 'string') return '';
    return path.relative(baseDir, filePath).replace(/\\/g, '/');
}

/**
 * Load .simplebeaconignore patterns from a directory.
 * @param {string} root
 * @returns {string[]}
 */
function loadSimplebeaconIgnorePatterns(root) {
    if (typeof root !== 'string') return [];
    const ignorePath = path.join(root, '.simplebeaconignore');
    const patterns = [];
    try {
        const content = fs.readFileSync(ignorePath, 'utf8');
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                patterns.push(trimmed.replace(/\\/g, '/'));
            }
        }
    } catch {
        // No .simplebeaconignore — that's fine
    }
    return patterns;
}

/**
 * Convert a glob-like pattern to a RegExp.
 * Supports `*`, `**`, and `?` wildcards.
 * @param {string} pattern
 * @returns {RegExp}
 */
function globToRegex(pattern) {
    if (typeof pattern !== 'string') return /(?!)/;
    let regex = '^';
    for (let i = 0; i < pattern.length; i += 1) {
        const c = pattern[i];
        if (c === '*' && pattern[i + 1] === '*') {
            i += 1;
            if (pattern[i + 1] === '/') {
                regex += '(?:.*/)?';
                i += 1;
            } else {
                regex += '.*';
            }
        } else if (c === '*') {
            regex += '[^/]*';
        } else if (c === '?') {
            regex += '[^/]';
        } else {
            regex += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        }
    }
    regex += '$';
    try {
        return new RegExp(regex);
    } catch {
        return /(?!)/;
    }
}

/** Cache of compiled glob-to-regex patterns. */
const _globRegexCache = new Map();

/**
 * Compile a glob pattern to a regex, caching the result.
 * @param {string} pattern
 * @returns {RegExp}
 */
function cachedGlobToRegex(pattern) {
    if (typeof pattern !== 'string') return /(?!)/;
    if (_globRegexCache.has(pattern)) return _globRegexCache.get(pattern);
    const re = globToRegex(pattern);
    _globRegexCache.set(pattern, re);
    return re;
}

/**
 * Check if a relative path matches any ignore pattern.
 * @param {string} rel Relative path to check.
 * @param {string[]} ignorePatterns List of glob or literal ignore patterns.
 * @returns {boolean}
 */
function isIgnoredPath(rel, ignorePatterns) {
    if (!Array.isArray(ignorePatterns)) return false;
    return ignorePatterns.some((pat) => {
        const normalized = pat.replace(/\/$/, '');
        if (rel === pat || rel === normalized) return true;
        if (rel.startsWith(`${normalized}/`)) return true;
        return cachedGlobToRegex(pat).test(rel);
    });
}

/**
 * Check for LICENSE and SECURITY files in or near the project root.
 * @param {string} root Project root directory.
 * @returns {{licenseCount:number,securityCount:number,summary:null,remediation:null}}
 */
function resolveComplianceCounts(root) {
    if (typeof root !== 'string') return { licenseCount: 0, securityCount: 0, summary: null, remediation: null };
    const LICENSE_NAMES = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'license.md', 'license.txt'];
    const SECURITY_NAMES = ['SECURITY.md', 'SECURITY.txt', 'security.md', 'security.txt', 'SECURITY', 'security'];

    function findFile(names, startDir) {
        let dir = startDir;
        for (let depth = 0; depth < 3; depth++) {
            for (const name of names) {
                if (fs.existsSync(path.join(dir, name))) return true;
            }
            const parent = path.dirname(dir);
            if (parent === dir) break;
            dir = parent;
        }
        return false;
    }

    const hasLicense = findFile(LICENSE_NAMES, root);
    const hasSecurity = findFile(SECURITY_NAMES, root);

    return {
        licenseCount: hasLicense ? 1 : 0,
        securityCount: hasSecurity ? 1 : 0,
        summary: null,
        remediation: null
    };
}

/**
 * Push scanner issues (from scanners returning `{ issues: [...] }`) into the issues array.
 * @param {Array<Object>} issues Mutable issues accumulator.
 * @param {{issues?:Array<Object>}} scanResult Scanner output.
 * @param {string} [severityOverride] Optional severity to force on all issues.
 * @returns {void}
 */
function pushScannerIssues(issues, scanResult, severityOverride) {
    if (!Array.isArray(issues)) return;
    if (scanResult?.issues?.length) {
        if (severityOverride) {
            for (const issue of scanResult.issues) {
                issues.push({ ...issue, severity: severityOverride });
            }
        } else {
            issues.push(...scanResult.issues);
        }
    }
}

/**
 * Push scanner findings (from scanners returning `{ results: [{ filePath, findings: [...] }] }`) into the issues array.
 * @param {Array<Object>} issues Mutable issues accumulator.
 * @param {{results?:Array<{filePath:string,findings?:Array<Object>}>}} scanResult Scanner output.
 * @param {string} type Issue type label.
 * @param {string} defaultId Default rule ID.
 * @param {string} defaultDesc Default description.
 * @param {string} [defaultSev='medium'] Default severity.
 * @returns {void}
 */
function pushScannerFindings(issues, scanResult, type, defaultId, defaultDesc, defaultSev = 'medium') {
    if (!Array.isArray(issues)) return;
    if (!scanResult?.results?.length) return;
    for (const r of scanResult.results) {
        for (const f of r.findings || []) {
            const sev = f.severity || defaultSev;
            const cappedSev = (sev === 'critical' || sev === 'high') ? 'medium' : sev;
            issues.push({
                id: f.ruleId || defaultId,
                severity: cappedSev,
                type,
                filePath: r.filePath,
                line: f.line,
                count: 1,
                description: f.snippet || f.description || defaultDesc,
                match: f.match
            });
        }
    }
}

/**
 * Known false positives to suppress from the issue list.
 * Only suppresses in specific file contexts, never blanket-suppresses entire rule types.
 * @param {{filePath?:string,type?:string}} issue
 * @returns {boolean}
 */
function isKnownFalsePositive(issue) {
    if (!issue || typeof issue !== 'object') return false;
    const fp = (issue.filePath || '').replace(/\\/g, '/');
    const type = issue.type || '';
    const isDashboardFile = fp.includes('simplebeacon-dashboard/js-es2018/') || fp.includes('simplebeacon-dashboard/js/') || fp.includes('simplebeacon-dashboard/data/');
    if (type === 'Duplicate Data' && (isDashboardFile || fp.includes('tsconfig.json'))) return true;
    if (type === 'env-inconsistency' && fp.includes('.env.v1-internal')) return true;
    return false;
}

/**
 * Resolve files-scanned count from scanners reporting `.scanned` or `.results.length`.
 * @param {{scanned?:number,results?:Array<unknown>}} scan
 * @returns {number}
 */
function scannedCount(scan) {
    if (!scan || typeof scan !== 'object') return 0;
    return scan.scanned || (scan.results ? scan.results.length : 0) || 0;
}

/**
 * Get a scan result from the resultMap with a key-appropriate fallback default.
 * @param {Map<string,Object>} resultMap
 * @param {string} key
 * @returns {Object}
 */
function _getScanResult(resultMap, key) {
    if (!(resultMap instanceof Map)) return {};
    if (typeof key !== 'string') return {};
    const defaults = {
        roadmap: { checked: 0, passed: 0, issues: [] },
        consistency: { checked: 0, passed: 0, score: null, issues: [] },
        credentials: { scanned: 0, findings: 0, issues: [] },
        'production-leak': { scanned: 0, findings: 0, issues: [] },
        'fiction-kpi-patterns': { scanned: 0, findings: 0, issues: [], patterns: [] },
        'llm-slop-patterns': { scanned: 0, findings: 0, issues: [], patterns: [] },
        'agency-handoff-patterns': { scanned: 0, findings: 0, issues: [], patterns: [] },
        'eu-ai-act-patterns': { scanned: 0, findings: 0, issues: [], summary: null, patterns: [] },
        'jest-baseline': { checked: false, passed: true, issues: [], summary: null },
        'token-bleed-patterns': { scanned: 0, findings: 0, issues: [] },
        'architecture-drift-patterns': { scanned: 0, findings: 0, issues: [] },
        'security-patterns': { scanned: 0, findings: 0, issues: [] },
        'file-reduction': { allFindings: [], findings: {}, summary: {} },
    };
    const simpleDefaults = { scanned: 0, findings: 0, issues: [], results: [] };
    return resultMap.get(key) || defaults[key] || simpleDefaults;
}

/**
 * Resolve findings count from scanners reporting `.findings` or `.count`.
 * @param {{findings?:number,count?:number}} scan
 * @returns {number}
 */
function findingsCount(scan) {
    if (!scan || typeof scan !== 'object') return 0;
    return scan.findings || scan.count || 0;
}

/**
 * Apply tier limits (max files, max findings, score visibility) to a scan report.
 * @param {Object} report
 * @param {Object} [options={}]
 * @param {string} [options.tier='developer']
 * @param {Object} [options.tierLimits={}]
 * @returns {Object} Mutated report.
 */
function applyTierLimits(report, options = {}) {
    if (!report || typeof report !== 'object') return {};
    const tier = options.tier || 'developer';
    const limits = options.tierLimits || {};
    const maxFiles = limits.maxFilesPerScan;
    const maxFindings = limits.maxFindingsShown;
    const showScore = limits.showQualityScore;

    if (typeof maxFiles === 'number' && report.totalFiles > maxFiles) {
        report.filesAnalyzed = Math.min(report.filesAnalyzed || 0, maxFiles);
        report.ruleScopedFilesAnalyzed = Math.min(report.ruleScopedFilesAnalyzed || 0, maxFiles);
        report.totalFiles = maxFiles;
        report.sampleFiles = (report.sampleFiles || []).slice(0, maxFiles);
        report.tierLimitation = `Free tier limited to ${maxFiles} files. Upgrade to Pro for unlimited scans.`;
    }

    if (typeof maxFindings === 'number' && Array.isArray(report.rawIssues)) {
        const truncated = report.rawIssues.length > maxFindings;
        report.rawIssues = (report.rawIssues || []).slice(0, maxFindings);
        report.detectedIssues = (report.detectedIssues || []).slice(0, maxFindings);
        if (truncated) {
            report.tierFindingsLimitation = `Free tier shows ${maxFindings} findings. Upgrade to Pro to see all.`;
        }
    }

    if (showScore === false) {
        delete report.qualityScore;
        delete report.schemaCompliance;
        delete report.consistencyScore;
        report.qualityScoreHidden = true;
    }

    report.tier = tier;
    return report;
}

/**
 * Resolve effective scan paths from config and extra paths.
 * @param {string} scanRoot The directory the user wants to scan.
 * @param {string} platformRoot Detected platform/monorepo root.
 * @param {Object} config Simplebeacon config object.
 * @param {string[]} [extraPaths=[]] Additional paths from CLI.
 * @returns {string[]} Absolute paths to scan.
 */
function resolveEffectiveScanPaths(scanRoot, platformRoot, config, extraPaths = []) {
    if (typeof scanRoot !== 'string' || typeof platformRoot !== 'string') return [];
    if (!config || typeof config !== 'object') return [scanRoot];
    if (config.fullDirectoryScan) {
        return [scanRoot];
    }

    const scanKey = normalizePathKey(scanRoot);
    const platformKey = normalizePathKey(platformRoot);

    if (scanKey === platformKey) {
        if (isIsolatedScanRoot(scanRoot)) {
            const hasConfiguredPaths = Array.isArray(config?.scanPaths) && config.scanPaths.length > 0;
            if (hasConfiguredPaths) {
                const paths = resolveScanPaths(scanRoot, config, extraPaths);
                if (paths.length) return paths;
            }
            return [scanRoot];
        }
        let paths = resolveScanPaths(platformRoot, config, extraPaths);
        paths = paths.filter((p) => normalizePathKey(p) !== platformKey);
        if (!paths.length) {
            paths = resolveScanPaths(platformRoot, config, []);
        }
        return paths;
    }
    if (scanKey.startsWith(`${platformKey}/`)) {
        return [scanRoot];
    }
    if (platformKey.startsWith(`${scanKey}/`)) {
        return resolveScanPaths(platformRoot, config, extraPaths);
    }
    // Scan root is outside platform root (e.g. sibling monorepo package) —
    // scope strictly to scanRoot so we don't leak platform files into the report.
    return [scanRoot, ...(extraPaths || [])];
}

/**
 * Compute the number of files analyzed across the most comprehensive scanners.
 * @param {number} mockCount
 * @param {Object} credentialScan
 * @param {Object} productionLeakScan
 * @param {Object} sourceFictionScan
 * @returns {number}
 */
function computeFilesAnalyzed(mockCount, credentialScan, productionLeakScan, sourceFictionScan) {
    return Math.max(
        mockCount || 0,
        credentialScan?.scanned || 0,
        productionLeakScan?.scanned || 0,
        sourceFictionScan?.scanned || 0
    );
}

/**
 * Recursively walk a directory and collect file entries.
 * @param {string} dir
 * @param {Array<{path:string,name:string,ext:string,size:number,relativePath:string}>} [results=[]]
 * @param {number} [depth=0]
 * @param {string|null} [rootDir=null]
 * @param {number} [maxDepth=6]
 * @param {Set<string>} [skipDirs]
 * @returns {Promise<Array<{path:string,name:string,ext:string,size:number,relativePath:string}>>}
 */
async function walkAndCollectFiles(dir, results = [], depth = 0, rootDir = null, maxDepth = 6, skipDirs = MOCK_WALK_SKIP_DIRS, maxFiles = 500000) {
    if (typeof dir !== 'string') return results;
    if (depth > maxDepth) return results;
    if (results.length >= maxFiles) return results;
    const walkRoot = rootDir || dir;
    let entries;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            entries = await fs.promises.readdir(dir, { withFileTypes: true });
            break;
        } catch {
            if (attempt === 2) return results;
            await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
        }
    }
    if (!entries) return results;

    // Process files concurrently with a concurrency limit to avoid memory pressure
    const CONCURRENCY = 64;
    const batch = [];
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (skipDirs && skipDirs.has(entry.name)) continue;
            batch.push(walkAndCollectFiles(fullPath, results, depth + 1, walkRoot, maxDepth, skipDirs, maxFiles));
            if (batch.length >= CONCURRENCY) {
                await Promise.all(batch);
                batch.length = 0;
                if (results.length >= maxFiles) return results;
            }
            continue;
        }
        if (entry.isSymbolicLink()) {
            batch.push((async () => {
                try {
                    const stat = await fs.promises.stat(fullPath);
                    if (stat.isDirectory()) {
                        if (skipDirs && skipDirs.has(entry.name)) return;
                        await walkAndCollectFiles(fullPath, results, depth + 1, walkRoot, maxDepth, skipDirs, maxFiles);
                        return;
                    }
                    const relativePath = path.relative(walkRoot, fullPath).replace(/\\/g, '/');
                    results.push({
                        path: fullPath,
                        name: entry.name,
                        ext: path.extname(entry.name).toLowerCase(),
                        size: stat.size,
                        relativePath
                    });
                } catch {
                    /* skip broken symlinks */
                }
            })());
            if (batch.length >= CONCURRENCY) {
                await Promise.all(batch);
                batch.length = 0;
            }
            continue;
        }
        if (!entry.isFile()) continue;
        batch.push((async () => {
            const relativePath = path.relative(walkRoot, fullPath).replace(/\\/g, '/');
            let size = 0;
            try {
                const stat = await fs.promises.stat(fullPath);
                size = stat.size;
            } catch {
                /* best-effort size */
            }
            results.push({
                path: fullPath,
                name: entry.name,
                ext: path.extname(entry.name).toLowerCase(),
                size,
                relativePath
            });
        })());
        if (batch.length >= CONCURRENCY) {
            await Promise.all(batch);
            batch.length = 0;
        }
    }
    if (batch.length > 0) {
        await Promise.all(batch);
    }
    return results;
}

/**
 * Format bytes into a human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
    if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '0 B';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
    return `${(bytes / k ** i).toFixed(i === 0 ? 0 : i >= 4 ? 2 : 1)} ${units[i]}`;
}

/**
 * Read and parse a JSON file.
 * @param {string} filePath
 * @returns {Promise<{valid:boolean,payload?:Object,raw?:string,issue?:string}>}
 */
async function readJsonFile(filePath) {
    if (typeof filePath !== 'string') {
        return { valid: false, issue: 'filePath must be a string', raw: null };
    }
    try {
        const raw = await fs.promises.readFile(filePath, 'utf8');
        if (typeof raw !== 'string') {
            return { valid: false, issue: 'not a text file', raw: null };
        }
        if (!raw.trim()) {
            return { valid: false, issue: 'empty file', raw };
        }
        const payload = JSON.parse(raw);
        return { valid: true, payload, raw };
    } catch (error) {
        return { valid: false, issue: error?.message || String(error), raw: null };
    }
}

/**
 * Get a category label for a file extension.
 * @param {string} ext File extension including leading dot.
 * @returns {string}
 */
function categoryForExt(ext) {
    if (typeof ext !== 'string') return 'Other Files';
    return EXT_CATEGORIES[ext] || 'Other Files';
}

/**
 * Validate a page-sample JSON file against its schema spec.
 * Mutates issues, categories, and schemaStats in place.
 * @param {Object} params
 * @param {string} params.fileName
 * @param {string} params.filePath
 * @param {{valid:boolean,payload?:Object}} params.parsed
 * @param {Array<Object>} params.issues
 * @param {Map<string,Object>} params.categories
 * @param {Object} params.schemaStats
 */
function applyPageSampleValidation({
    fileName,
    filePath,
    parsed,
    issues,
    categories,
    schemaStats
}) {
    schemaStats.schemaChecked += 1;
    schemaStats.pageSampleSchemaChecked += 1;
    const category = categoryForExt(path.extname(fileName));
    const bucket = categories.get(category) || {
        category,
        fileCount: 0,
        totalSize: 0,
        issues: 0,
        files: []
    };

    const schema = validateSampleSchema(fileName, parsed.payload);
    if (schema.valid) {
        schemaStats.schemaPassed += 1;
        schemaStats.pageSampleSchemaPassed += 1;
        categories.set(category, bucket);
        return;
    }

    bucket.issues += 1;
    issues.push({
        id: `schema-${fileName}`,
        severity: 'high',
        type: 'Schema Violation',
        filePath,
        count: schema.violations.length,
        description: `${fileName}: ${schema.violations.map((v) => v.message).join('; ')}`,
        recommendedAction: 'Update mock data to conform to dashboard page schema requirements',
        affectedFiles: [fileName],
        metadata: {
            missingFields: schema.missingFields,
            specFile: fileName,
            violations: schema.violations
        }
    });
    categories.set(category, bucket);
}

/**
 * Main scan entry point. Walks scan paths, runs all enabled rule scanners,
 * aggregates findings, computes quality scores, and returns a full report.
 * @param {string} baseDir Root directory to scan.
 * @param {string[]} [extraPaths=[]] Additional paths from CLI.
 * @param {Object} [options={}] Scan options (fullDirectoryScan, quiet, fictionScope, etc).
 * @returns {Promise<Object>} Scan report with summary, issues, scores, and gate evaluation.
 */
async function scanMockDataDirectories(baseDir, extraPaths = [], options = {}) {
    if (typeof baseDir !== 'string') {
        throw new TypeError('scanMockDataDirectories expects baseDir to be a string');
    }
    clearJsonFileCache();
    clearFileContentCache();
    const scanRoot = sanitizePath(baseDir, baseDir);
    try {
        const analyzerCachePath = path.join(scanRoot, '.simplebeacon', 'analyzer-cache.json');
        await fs.promises.unlink(analyzerCachePath);
    } catch {
        /* best-effort cache clear — file may not exist */
    }
    const { platformRoot } = resolvePlatformRoot(scanRoot);
    const root = platformRoot;
    const rawConfig = options.config || loadSimplebeaconConfig(root, options.configPath);
    // Deep-clone to avoid mutating the caller's config object on tier-sanitize / flag overrides
    const config = JSON.parse(JSON.stringify(rawConfig || {}));

    // Merge .simplebeaconignore patterns into config.ignore so all rules respect them
    const simplebeaconIgnorePatterns = loadSimplebeaconIgnorePatterns(root);
    if (simplebeaconIgnorePatterns.length > 0) {
        config.ignore = Array.from(new Set([...(config.ignore || []), ...simplebeaconIgnorePatterns]));
    }

    // --- Scan quota enforcement ---
    const tierInfo = detectTier();
    const isPipeline = options.ci || isPipelineScan();

    if (isPipeline && !tierInfo.paid) {
        return {
            type: 'simplebeacon-report',
            reportVersion: 2,
            generatedAt: new Date().toISOString(),
            error: 'Pipeline scans require a paid license. Upgrade at https://simplebeacon.ai/pricing',
            tier: tierInfo.tier,
            scan_summary: { status: 'BLOCKED', block_merge: true, reason: 'tier_too_low' }
        };
    }

    const quotaCheck = isPipeline
        ? { allowed: true, scansRemaining: tierInfo.limits.maxScansPerPeriod } // Pipeline: validate via token on server
        : checkLocalScanQuota(tierInfo.limits);

    if (!quotaCheck.allowed) {
        return {
            type: 'simplebeacon-report',
            reportVersion: 2,
            generatedAt: new Date().toISOString(),
            error: `Scan quota exceeded (${quotaCheck.scansUsed}/${quotaCheck.quota} used this month). Upgrade at https://simplebeacon.ai/pricing`,
            tier: tierInfo.tier,
            scan_summary: { status: 'BLOCKED', block_merge: true, reason: 'scan_quota_exceeded', scans_used: quotaCheck.scansUsed, scans_remaining: 0 }
        };
    }

    if (isPipeline) {
        incrementPipelineScan(tierInfo.tier);
    } else {
        incrementLocalScan(tierInfo.tier);
    }

    // --- Tier-gated config sanitization ---
    const sanitized = sanitizeConfigForTier(config, tierInfo.tier);
    if (sanitized.scanners) config.scanners = sanitized.scanners;
    if (sanitized.allowlist !== undefined) config.allowlist = sanitized.allowlist;
    if (sanitized.rules) config.rules = sanitized.rules;
    // --- End quota & config enforcement ---

    if (options.fullDirectoryScan) {
        config.fullDirectoryScan = true;
    }
    if (options.withJest && config.rules?.['jest-baseline']) {
        config.rules['jest-baseline'] = { ...config.rules['jest-baseline'], enabled: true, runTests: true };
    }
    const sanitizedExtraPaths = (extraPaths || [])
        .map((entry) => {
            try {
                return sanitizePath(entry, scanRoot);
            } catch {
                return null;
            }
        })
        .filter(Boolean);
    const scanPaths = resolveEffectiveScanPaths(scanRoot, root, config, sanitizedExtraPaths);
    const schemaEnabled = isRuleEnabled(config, 'json-schema');
    const FULL_TREE_MINIMAL_SKIP_DIRS = ['.git', 'github-cache', '.simplebeacon', '.vscode-test'];
    const inventoryPromise = countRepositoryInventory(root, {
        profile: config.fullDirectoryScan ? 'all' : (options.inventoryProfile || 'universal'),
        skipDirs: config.fullDirectoryScan
            ? (config.fullDirectoryScanSkipDirs ? [...config.fullDirectoryScanSkipDirs] : FULL_TREE_MINIMAL_SKIP_DIRS)
            : [...MOCK_WALK_SKIP_DIRS]
    });

    const files = [];
    const scanMaxDepth = config.fullDirectoryScan ? 100 : (config.scanMaxDepth || 12);
    let skipDirs = MOCK_WALK_SKIP_DIRS;
    if (config.fullDirectoryScan) {
        skipDirs = config.fullDirectoryScanSkipDirs ? new Set(config.fullDirectoryScanSkipDirs) : new Set(FULL_TREE_MINIMAL_SKIP_DIRS);
    }
    for (const scanPath of scanPaths) {
        if (fs.existsSync(scanPath)) { // simplebeacon-ignore sync-io — path validation before async walk
            await walkAndCollectFiles(scanPath, files, 0, null, scanMaxDepth, skipDirs);
        }
    }
    let uniqueFiles = dedupeScannedFiles(files);
    if (Array.isArray(options.exclude) && options.exclude.length > 0) {
        const excludePatterns = options.exclude.map((p) => p.replace(/\\/g, '/'));
        uniqueFiles = uniqueFiles.filter((f) => {
            const rel = f.relativePath || '';
            return !excludePatterns.some((pat) => rel.includes(pat));
        });
    }

    const categories = new Map();
    const issues = [];
    const hashEntries = [];
    let invalidJson = 0;
    let emptyFiles = 0;
    const pageSamplesValidated = new Set();
    const schemaStats = {
        schemaChecked: 0,
        schemaPassed: 0,
        pageSampleSchemaChecked: 0,
        pageSampleSchemaPassed: 0
    };

    for (const file of uniqueFiles) {
        const category = categoryForExt(file.ext);
        const bucket = categories.get(category) || {
            category,
            fileCount: 0,
            totalSize: 0,
            issues: 0,
            files: []
        };
        bucket.fileCount += 1;
        bucket.totalSize += file.size;
        bucket.files.push(file.name);

        const isNodeModulesFile = /(^|[\\/])node_modules[\\/]/.test(file.path);

        // Skip stdout capture files that have .json extension but contain plain text
        const isStdoutCapture = /-stdout\.json$/i.test(file.name) || /report-stdout\.json$/i.test(file.name);

        if (file.ext === '.json' && !isStdoutCapture) {
            const parsed = await readJsonFile(file.path);
            if (!parsed.valid) {
                if (!isNodeModulesFile) {
                    bucket.issues += 1;
                    invalidJson += 1;
                    if (parsed.issue === 'empty file') emptyFiles += 1;
                    issues.push({
                        id: `invalid-json-${file.name}`,
                        severity: parsed.issue === 'empty file' ? 'low' : 'high',
                        type: parsed.issue === 'empty file' ? 'Empty File' : 'Invalid JSON',
                        filePath: file.path,
                        count: 1,
                        description: `${file.name}: ${parsed.issue}`,
                        recommendedAction: parsed.issue === 'empty file'
                            ? 'Remove or populate empty mock files'
                            : 'Fix JSON syntax errors in mock data',
                        affectedFiles: [file.name]
                    });
                }
            } else if (!isNodeModulesFile) {
                hashEntries.push({
                    name: file.name,
                    path: file.path,
                    contentHash: hashFileContent(parsed.raw)
                });

                // simplebeacon:production-leak-intent: schema-validator - Validate repository-audit page sample schemas
                if (schemaEnabled && file.name.endsWith('-sample.json') && PAGE_SAMPLE_SPECS[file.name]) {
                    pageSamplesValidated.add(file.name);
                    applyPageSampleValidation({
                        fileName: file.name,
                        filePath: file.path,
                        parsed,
                        issues,
                        categories,
                        schemaStats
                    });
                }
            }
        }

        categories.set(category, bucket);
    }

    let pageSpecsFromAlias = 0;
    if (schemaEnabled) {
        const pageSpecsBeforeAlias = schemaStats.pageSampleSchemaChecked;
        for (const fileName of Object.keys(PAGE_SAMPLE_SPECS)) {
            if (pageSamplesValidated.has(fileName)) continue;
            const filePath = resolveSampleFilePath(root, fileName);
            try {
                await fs.promises.access(filePath);
            } catch {
                continue;
            }
            const parsed = await readJsonFile(filePath);
            if (!parsed.valid) {
                invalidJson += 1;
                if (parsed.issue === 'empty file') emptyFiles += 1;
                issues.push({
                    id: `invalid-json-${fileName}`,
                    severity: parsed.issue === 'empty file' ? 'low' : 'high',
                    type: parsed.issue === 'empty file' ? 'Empty File' : 'Invalid JSON',
                    filePath,
                    count: 1,
                    description: `${fileName}: ${parsed.issue}`,
                    recommendedAction: parsed.issue === 'empty file'
                        ? 'Remove or populate empty mock files'
                        : 'Fix JSON syntax errors in mock data',
                    affectedFiles: [fileName]
                });
                continue;
            }
            pageSamplesValidated.add(fileName);
            applyPageSampleValidation({
                fileName,
                filePath,
                parsed,
                issues,
                categories,
                schemaStats
            });
        }
        pageSpecsFromAlias = schemaStats.pageSampleSchemaChecked - pageSpecsBeforeAlias;
    }

    const nodeModulesRe = /(^|[\\/])node_modules[\\/]/;
    const newFolderRe = /(^|[\\/])New folder[\\/]/;
    const simplebeaconRe = /(^|[\\/])\.simplebeacon[\\/]/;
    const ignorePatterns = config.ignore || [];
    const duplicateGroups = findDuplicateContentGroups(hashEntries).filter((group) => {
        if (group.every((entry) => nodeModulesRe.test(entry.path))) return false;
        if (group.some((entry) => newFolderRe.test(entry.path) || simplebeaconRe.test(entry.path))) return false;
        if (group.every((entry) => isIgnoredPath(displayRelativePath(root, entry.path), ignorePatterns))) return false;
        return true;
    });
    for (const group of duplicateGroups) {
        const relativePaths = group.map((entry) => displayRelativePath(root, entry.path));
        issues.push({
            id: `duplicate-${group[0].contentHash.slice(0, 8)}`,
            severity: 'low',
            type: 'Duplicate Data',
            filePath: group[0].path,
            filePaths: group.map((entry) => entry.path),
            count: group.length,
            description: `${group.length} files share identical JSON content`,
            recommendedAction: 'Remove duplicate entries to optimize data size',
            affectedFiles: relativePaths,
            metadata: {
                duplicatePaths: group.map((entry) => entry.path),
                relativePaths,
                contentHash: group[0].contentHash
            }
        });
    }

    // Run independent rule scans in parallel
    const scanPromises = [];
    const scanKeys = [];

    if (isRuleEnabled(config, 'roadmap')) {
        scanPromises.push(validateRoadmapFiles(root, { baseline: config.baseline, ignoreGlobs: config.ignore }));
        scanKeys.push('roadmap');
    }
    if (isRuleEnabled(config, 'sample-consistency')) {
        scanPromises.push(checkSampleConsistency(root, {
            sampleDir: config.sampleDir,
            baseline: config.baseline,
            anchorSamples: config.consistencyAnchorSamples,
            scanPathFiles: uniqueFiles.filter((file) => file.ext === '.json'),
            fictionScope: options.fictionScope || 'repository-json',
            ignoreGlobs: config.ignore
        }));
        scanKeys.push('consistency');
    }
    if (isRuleEnabled(config, 'credentials')) {
        const credOpts = getRuleOptions(config, 'credentials');
        scanPromises.push(scanCredentialPatterns(uniqueFiles, {
            scanProduction: credOpts.scanProduction !== false,
            baseDir: root,
            productionPaths: credOpts.productionPaths || config.productionPaths,
            ignoreGlobs: config.ignore
        }));
        scanKeys.push('credentials');
    }
    if (isRuleEnabled(config, 'production-leak')) {
        const leakOpts = getRuleOptions(config, 'production-leak');
        scanPromises.push(scanProductionLeaks(root, {
            productionPaths: leakOpts.productionPaths || config.productionPaths,
            ignoreGlobs: leakOpts.ignoreGlobs || config.ignore,
            allowlistFiles: leakOpts.allowlistFiles || [],
            scannerMetaFiles: [
                ...(config.scannerMetaFiles || []),
                ...(leakOpts.scannerMetaFiles || [])
            ],
            severity: leakOpts.severity || 'high',
            intentClassification: leakOpts.intentClassification !== false,
            plainSampleJson: leakOpts.plainSampleJson === true
        }));
        scanKeys.push('production-leak');
    }
    if (isRuleEnabled(config, 'fiction-kpi-patterns')) {
        const fictionOpts = getRuleOptions(config, 'fiction-kpi-patterns');
        scanPromises.push(scanSourceFictionPatterns(root, {
            sourcePaths: fictionOpts.sourcePaths || config.sourceCodeScanPaths,
            ignoreGlobs: fictionOpts.ignoreGlobs || config.ignore,
            pathExclusions: config.pathExclusions || [],
            baseline: config.baseline
        }));
        scanKeys.push('fiction-kpi-patterns');
    }
    if (isRuleEnabled(config, 'llm-slop-patterns')) {
        const slopOpts = getRuleOptions(config, 'llm-slop-patterns');
        scanPromises.push(scanLlmSlopPatterns(root, {
            sourcePaths: slopOpts.sourcePaths || config.sourceCodeScanPaths,
            productionPaths: slopOpts.productionPaths || config.productionPaths,
            ignoreGlobs: slopOpts.ignoreGlobs || config.ignore,
            registryCheck: slopOpts.registryCheck === true
                || process.env.SIMPLEBEACON_REGISTRY_CHECK === 'true',
            registryCheckLimit: slopOpts.registryCheckLimit || 12,
            minConfidence: options.minConfidence ?? config.minConfidence ?? 0.5
        }));
        scanKeys.push('llm-slop-patterns');
    }
    if (isRuleEnabled(config, 'agency-handoff-patterns')) {
        const handoffOpts = getRuleOptions(config, 'agency-handoff-patterns');
        scanPromises.push(scanAgencyHandoffPatterns(root, {
            sourcePaths: handoffOpts.sourcePaths || config.sourceCodeScanPaths,
            productionPaths: handoffOpts.productionPaths || config.productionPaths,
            ignoreGlobs: handoffOpts.ignoreGlobs || config.ignore,
            severity: handoffOpts.severity || 'medium'
        }));
        scanKeys.push('agency-handoff-patterns');
    }
    if (isRuleEnabled(config, 'eu-ai-act-patterns')) {
        const euOpts = getRuleOptions(config, 'eu-ai-act-patterns');
        scanPromises.push(scanEuAiActPatterns(root, {
            sourcePaths: euOpts.sourcePaths || config.sourceCodeScanPaths,
            productionPaths: euOpts.productionPaths || config.productionPaths,
            ignoreGlobs: euOpts.ignoreGlobs || config.ignore,
            severity: euOpts.severity || 'medium'
        }));
        scanKeys.push('eu-ai-act-patterns');
    }
    if (isRuleEnabled(config, 'jest-baseline')) {
        const jestOpts = getRuleOptions(config, 'jest-baseline');
        scanPromises.push(checkJestBaseline(root, {
            baseline: config.baseline,
            runTests: jestOpts.runTests === true,
            testCommand: jestOpts.testCommand,
            timeoutMs: jestOpts.timeoutMs
        }));
        scanKeys.push('jest-baseline');
    }
    if (isRuleEnabled(config, 'token-bleed-patterns')) {
        const tbOpts = getRuleOptions(config, 'token-bleed-patterns');
        scanPromises.push(scanTokenBleedPatterns(root, {
            productionPaths: tbOpts.productionPaths || config.productionPaths,
            ignoreGlobs: tbOpts.ignoreGlobs || config.ignore,
            severity: tbOpts.severity || 'medium'
        }));
        scanKeys.push('token-bleed-patterns');
    }
    if (isRuleEnabled(config, 'architecture-drift-patterns')) {
        const adOpts = getRuleOptions(config, 'architecture-drift-patterns');
        scanPromises.push(scanArchitectureDriftPatterns(root, {
            sourcePaths: adOpts.sourcePaths || config.sourceCodeScanPaths,
            productionPaths: adOpts.productionPaths || config.productionPaths,
            ignoreGlobs: adOpts.ignoreGlobs || config.ignore,
            severity: adOpts.severity || 'medium'
        }));
        scanKeys.push('architecture-drift-patterns');
    }
    if (isRuleEnabled(config, 'file-reduction')) {
        const frOpts = getRuleOptions(config, 'file-reduction');
        scanPromises.push(runFileReductionScan(root, {
            dryRun: frOpts.dryRun !== false,
            scanners: frOpts.scanners || {}
        }));
        scanKeys.push('file-reduction');
    }
    if (isRuleEnabled(config, 'security-patterns')) {
        const secOpts = getRuleOptions(config, 'security-patterns');
        const secPaths = secOpts.sourcePaths || config.sourceCodeScanPaths || config.productionPaths || ['.'];
        const secIgnore = secOpts.ignoreGlobs || config.ignore || [];
        const secIssues = [];
        let secScanned = 0;
        const scannableExts = constants.ALL_EXTENSION_SET;
        for (const file of uniqueFiles) {
            const rel = file.relativePath || '';
            const basename = path.basename(rel);
            const isEnvFile = basename === '.env' || /^\.env\.[a-z]+$/i.test(basename);
            const ext = file.ext || '';
            if (!scannableExts.has(ext) && !isEnvFile) continue;
            if (secIgnore.some((g) => globMatch(rel, g))) continue;
            if (!secPaths.some((sp) => rel.startsWith(sp.replace(/^\.\//, '')))) {
                if (secPaths[0] !== '.') continue;
            }
            try {
                const content = readFileCached(file.path);
                const findings = scanSecurityPatterns(rel, content, ext);
                if (findings.length > 0) {
                    secIssues.push(...findings);
                }
                secScanned += 1;
            } catch {
                // Skip unreadable files
            }
        }
        scanPromises.push(Promise.resolve({ scanned: secScanned, findings: secIssues.length, issues: secIssues }));
        scanKeys.push('security-patterns');
    }
    // Simple pass-through scanners that all use the same {maxDepth, skipDirs} options
    const _simpleScanOpts = { maxDepth: 20, skipDirs: config.skipDirs || MOCK_WALK_SKIP_DIRS };
    /** @type {Array<[string, Function]>} */
    const SIMPLE_SCAN_REGISTRY = [
        ['hardcoded-url', scanHardcodedUrls],
        ['weak-crypto', scanWeakCrypto],
        ['secret-in-comments', scanSecretInComments],
        ['sync-io-async-path', scanSyncIo],
        ['env-in-git', scanEnvInGit],
        ['redos-risk', scanReDoS],
        ['pii-logging', scanPiiLogging],
        ['dead-code', scanDeadCode],
        ['memory-leak', scanMemoryLeaks],
    ];
    for (const [key, fn] of SIMPLE_SCAN_REGISTRY) {
        if (isRuleEnabled(config, key)) {
            scanPromises.push(fn(root, _simpleScanOpts));
            scanKeys.push(key);
        }
    }
    if (isRuleEnabled(config, 'type-safety')) {
        const tsOpts = getRuleOptions(config, 'type-safety');
        scanPromises.push(scanTypeSafety(root, {
            sourcePaths: tsOpts.sourcePaths || config.sourceCodeScanPaths,
            productionPaths: tsOpts.productionPaths || config.productionPaths,
            ignoreGlobs: tsOpts.ignoreGlobs || config.ignore
        }));
        scanKeys.push('type-safety');
    }
    if (isRuleEnabled(config, 'hallucinated-import')) {
        const hiOpts = getRuleOptions(config, 'hallucinated-import');
        scanPromises.push(scanHallucinatedImports(root, {
            sourcePaths: hiOpts.sourcePaths || config.sourceCodeScanPaths,
            productionPaths: hiOpts.productionPaths || config.productionPaths,
            ignoreGlobs: hiOpts.ignoreGlobs || config.ignore
        }));
        scanKeys.push('hallucinated-import');
    }
    if (isRuleEnabled(config, 'ast-structural')) {
        const astOpts = getRuleOptions(config, 'ast-structural');
        scanPromises.push(scanAstStructural(root, {
            sourcePaths: astOpts.sourcePaths || config.sourceCodeScanPaths,
            productionPaths: astOpts.productionPaths || config.productionPaths,
            ignoreGlobs: astOpts.ignoreGlobs || config.ignore
        }));
        scanKeys.push('ast-structural');
    }

    const totalRules = scanPromises.length;
    const quiet = options.quiet || process.env.SIMPLEBEACON_QUIET === '1';
    let completedRules = 0;
    /**
     * Update the TTY progress indicator when a rule scanner finishes.
     * @param {string} name Scanner rule name.
     * @returns {void}
     */
    function tickProgress(name) {
        completedRules++;
        if (!quiet && process.stderr.isTTY && totalRules > 0) {
            process.stderr.write(`\rScanning: ${completedRules}/${totalRules} rules complete (${name})... `);
        }
    }

    const trackedPromises = scanPromises.map((p, i) => p.then((r) => {
        tickProgress(scanKeys[i]);
        return r;
    }).catch((err) => {
        const errMsg = err?.message || String(err);
        console.error(`[simplebeacon] Rule scanner '${scanKeys[i]}' failed: ${errMsg}`);
        return { scanned: 0, findings: 0, issues: [], error: errMsg };
    }));
    const scanResults = await Promise.all(trackedPromises);

    if (!quiet && process.stderr.isTTY && totalRules > 0) {
        process.stderr.write(`\rScanning: ${totalRules}/${totalRules} rules complete.          \n`);
    }

    const resultMap = new Map();
    for (let i = 0; i < scanKeys.length; i++) {
        resultMap.set(scanKeys[i], scanResults[i]);
    }

    const scanResultKeys = [
        ['roadmapValidation', 'roadmap'],
        ['consistency', 'consistency'],
        ['credentialScan', 'credentials'],
        ['productionLeakScan', 'production-leak'],
        ['sourceFictionScan', 'fiction-kpi-patterns'],
        ['llmSlopScan', 'llm-slop-patterns'],
        ['agencyHandoffScan', 'agency-handoff-patterns'],
        ['euAiActScan', 'eu-ai-act-patterns'],
        ['jestBaseline', 'jest-baseline'],
        ['tokenBleedScan', 'token-bleed-patterns'],
        ['architectureDriftScan', 'architecture-drift-patterns'],
        ['securityPatternScan', 'security-patterns'],
        ['fileReduction', 'file-reduction'],
        ['hardcodedUrlScan', 'hardcoded-url'],
        ['weakCryptoScan', 'weak-crypto'],
        ['secretInCommentsScan', 'secret-in-comments'],
        ['syncIoScan', 'sync-io-async-path'],
        ['envInGitScan', 'env-in-git'],
        ['redosScan', 'redos-risk'],
        ['piiLoggingScan', 'pii-logging'],
        ['deadCodeScan', 'dead-code'],
        ['memoryLeakScan', 'memory-leak'],
        ['typeSafetyScan', 'type-safety'],
        ['hallucinatedImportScan', 'hallucinated-import'],
        ['astStructuralScan', 'ast-structural']
    ];
    const resolved = {};
    for (const [varName, key] of scanResultKeys) {
        resolved[varName] = _getScanResult(resultMap, key);
    }
    let {
        roadmapValidation, consistency, credentialScan, productionLeakScan,
        sourceFictionScan, llmSlopScan, agencyHandoffScan, euAiActScan,
        jestBaseline, tokenBleedScan, architectureDriftScan, securityPatternScan,
        fileReduction, hardcodedUrlScan, weakCryptoScan, secretInCommentsScan,
        syncIoScan, envInGitScan, redosScan, piiLoggingScan, deadCodeScan,
        memoryLeakScan, typeSafetyScan, hallucinatedImportScan, astStructuralScan
    } = resolved;

    if (roadmapValidation.issues?.length) {
        schemaStats.schemaChecked += roadmapValidation.checked;
        schemaStats.schemaPassed += roadmapValidation.passed;
        issues.push(...roadmapValidation.issues);
    }
    pushScannerIssues(issues, consistency);
    pushScannerIssues(issues, credentialScan);
    pushScannerIssues(issues, productionLeakScan);
    pushScannerIssues(issues, sourceFictionScan, (getRuleOptions(config, 'fiction-kpi-patterns') || {}).severity || 'medium');
    pushScannerIssues(issues, llmSlopScan, (getRuleOptions(config, 'llm-slop-patterns') || {}).severity || 'medium');
    pushScannerIssues(issues, agencyHandoffScan);
    pushScannerIssues(issues, euAiActScan);
    pushScannerIssues(issues, jestBaseline);
    pushScannerIssues(issues, tokenBleedScan);
    pushScannerIssues(issues, architectureDriftScan);
    pushScannerIssues(issues, securityPatternScan);
    pushScannerFindings(issues, hardcodedUrlScan, 'Hardcoded URL', 'SB-SEC-005', 'Hardcoded IP/URL reference');
    pushScannerFindings(issues, weakCryptoScan, 'Weak Crypto', 'SB-SEC-006', 'Weak crypto or insecure random');
    pushScannerFindings(issues, secretInCommentsScan, 'Secret in Comment', 'SB-SEC-007', 'Secret exposed in comment');
    pushScannerFindings(issues, syncIoScan, 'Sync I/O in Async Path', 'SB-PERF-001', 'Synchronous I/O in async context');
    pushScannerFindings(issues, envInGitScan, 'Secret File in Git', 'SB-SEC-008', 'Secret file tracked by git or not gitignored');
    pushScannerFindings(issues, redosScan, 'ReDoS Risk', 'SB-SEC-009', 'Regex with catastrophic backtracking potential');
    pushScannerFindings(issues, piiLoggingScan, 'PII Logging', 'SB-SEC-010', 'Potential PII in log output');
    pushScannerFindings(issues, deadCodeScan, 'Dead Code', 'SB-QUAL-001', 'Unused import or unreachable code', 'low');
    pushScannerFindings(issues, memoryLeakScan, 'Memory Leak', 'SB-PERF-002', 'Potential memory leak pattern');
    pushScannerFindings(issues, typeSafetyScan, 'Type Safety', 'SB-QUAL-001', 'Type safety gap', 'low');
    pushScannerFindings(issues, hallucinatedImportScan, 'Hallucinated Import', 'SB-FICTION-004', 'Import of package not in package.json');
    if (fileReduction.allFindings?.length) {
        for (const finding of fileReduction.allFindings) {
            issues.push({
                id: finding.id || `file-reduction-${finding.type}-${crypto.randomBytes(3).toString('hex')}`,
                severity: finding.severity || 'low',
                type: finding.type || 'File Reduction',
                filePath: finding.path || finding.filePath || null,
                count: finding.count || 1,
                description: finding.description || finding.message || `${finding.type} finding`,
                recommendedAction: finding.recommendedAction || finding.fixSuggestion || 'Review file-reduction report',
                affectedFiles: finding.affectedFiles || finding.paths || (finding.path ? [finding.path] : []),
                metadata: {
                    scanner: finding.scanner || 'file-reduction',
                    reclaimableBytes: finding.reclaimableBytes || 0,
                    ...(finding.metadata || {})
                }
            });
        }
    }

    const filteredIssues = issues.filter((issue) => !isKnownFalsePositive(issue));
    const { platformIssues, benchmarkCacheIssues } = partitionBenchmarkIssues(filteredIssues);
    const scoringIssues = platformIssues;

    const totalSize = uniqueFiles.reduce((sum, file) => sum + file.size, 0);
    // Batch line-counting to avoid overwhelming the event loop with too many concurrent promises
    const LINE_COUNT_BATCH = 256;
    let totalLines = 0;
    for (let i = 0; i < uniqueFiles.length; i += LINE_COUNT_BATCH) {
        const batch = uniqueFiles.slice(i, i + LINE_COUNT_BATCH);
        const counts = await Promise.all(batch.map((f) => countFileLines(f.path, f.ext)));
        for (const c of counts) totalLines += c;
    }
    const issueCount = scoringIssues
        .filter(isBlockingIssue)
        .reduce((sum, issue) => sum + (issue.count || 1), 0);
    const qualityScore = uniqueFiles.length
        ? computeQualityScoreFromIssues(scoringIssues, config.gate)
        : 0;
    const schemaCompliance = schemaStats.schemaChecked
        ? Math.round((schemaStats.schemaPassed / schemaStats.schemaChecked) * 100)
        : null;

    const mockDataCategories = [...categories.values()].map((cat) => ({
        category: cat.category,
        fileCount: cat.fileCount,
        totalSize: formatBytes(cat.totalSize),
        qualityScore: Math.max(60, Math.min(100, Math.round(100 - (cat.issues / Math.max(cat.fileCount, 1)) * 40))),
        issues: cat.issues,
        confidence: null,
        description: `${cat.category} discovered during filesystem scan`
    }));

    const rawIssues = scoringIssues;
    const severityCounts = countBySeverity(rawIssues);
    const repositoryInventory = await inventoryPromise;
    const ruleScopedFilesAnalyzed = computeFilesAnalyzed(
        uniqueFiles.length,
        credentialScan,
        productionLeakScan,
        sourceFictionScan
    );
    const repositoryFilesTotal = repositoryInventory?.totalFiles ?? null;
    const repositoryFoldersTotal = repositoryInventory?.totalFolders ?? null;
    const rulesEnabled = Object.keys(config.rules || {}).filter((name) => isRuleEnabled(config, name));
    const pageSpecCatalogSize = Object.keys(PAGE_SAMPLE_SPECS).length;
    const scanScope = {
        profile: config.profile || 'standard',
        scannerVersion: '1.0.0',
        rulesEnabled,
        gatePolicy: config.gate || { failOn: ['high'], warnOn: ['medium', 'low'] },
        mockSampleFilesInScanPaths: uniqueFiles.length,
        pageSpecCatalogSize,
        pageSpecsValidated: schemaStats.pageSampleSchemaChecked,
        pageSpecsFromScanPaths: schemaStats.pageSampleSchemaChecked - pageSpecsFromAlias,
        pageSpecsFromAliasPaths: pageSpecsFromAlias,
        productionDirsScanned: productionLeakScan.scanned,
        productionPaths: config.productionPaths || [],
        sourceCodeScanPaths: config.sourceCodeScanPaths || [],
        sourceCodeFilesScanned: sourceFictionScan.scanned,
        sourceFictionPatternHits: sourceFictionScan.findings,
        llmSlopFilesScanned: llmSlopScan.scanned,
        llmSlopPatternHits: llmSlopScan.findings,
        euAiActFilesScanned: euAiActScan.scanned,
        euAiActPatternHits: euAiActScan.findings,
        euAiActHighRiskIndicators: euAiActScan.summary?.highRiskIndicators ?? 0,
        jestExecutedDuringScan: jestBaseline.checked === true,
        consistencyAnchorCount: (config.consistencyAnchorSamples || []).length,
        fictionScope: consistency.scope || 'repository-json',
        fictionJsonFilesScanned: consistency.jsonFilesScanned ?? consistency.checked ?? 0,
        fictionSampleFilesScanned: consistency.samplesScanned ?? 0,
        ruleScopedFilesAnalyzed,
        repositoryFilesTotal,
        repositoryFoldersTotal,
        benchmarkCacheIssuesExcluded: benchmarkCacheIssues.length,
        excludedPathsNote: benchmarkCacheIssues.length
            ? `${benchmarkCacheIssues.length} issue(s) from github-cache/ benchmark clones excluded from gate scores — scan clones with github-cache/.simplebeacon/config.json (profile: benchmark).`
            : null,
        limitations: [
            repositoryFilesTotal != null
                ? `Repository inventory: ${repositoryFilesTotal.toLocaleString()} files — gate rules checked ${ruleScopedFilesAnalyzed} (mock paths, credentials, server/ leaks).`
                : `Gate rules checked ${ruleScopedFilesAnalyzed} files — mock paths, credentials, and production directories only.`,
            'github-cache/ OSS benchmark clones are excluded from platform gate scoring (not your product code).',
            'Pattern matching on JSON samples and server/ production paths — not LLM semantic review.',
            consistency.scope === 'repository-json'
                ? `Fiction/KPI rules scan repository JSON (${consistency.jsonFilesScanned ?? '—'}) plus source code (${sourceFictionScan.scanned ?? 0} files in ${(config.sourceCodeScanPaths || []).join(', ') || 'configured paths'}).`
                : 'Fiction/KPI rules scan configured sample JSON paths only.',
            jestBaseline.checked
                ? 'Jest was executed during this scan.'
                : 'Jest was not executed during this scan — use npm test or simplebeacon:full for live test verification.',
            config.profile === 'cascade'
                ? 'Cascade profile scans server/ for production leaks — src/ stub API is excluded by design.'
                : null
        ].filter(Boolean)
    };

    const highCount = severityCounts.high || 0;
    const mediumCount = severityCounts.medium || 0;
    const totalRisks = issueCount;
    const estimatedCost = totalRisks > 0 ? `$${(totalRisks * 5000).toLocaleString()}` : '$0';
    const gateResult = evaluateGate({ rawIssues: scoringIssues }, config.gate || {});

    const scanSummary = {
        status: gateResult.pass ? 'PASSED' : 'FAILED',
        block_merge: !gateResult.pass,
        total_risks_found: totalRisks,
        high_severity_count: highCount,
        medium_severity_count: mediumCount,
        low_severity_count: severityCounts.low || 0,
        estimated_incident_cost_saved: estimatedCost,
        scan_id: `sb_scan_${crypto.randomBytes(6).toString('hex')}`,
        timestamp: new Date().toISOString(),
        tier: tierInfo.tier,
        scans_remaining: quotaCheck.scansRemaining,
        pipeline_scan: isPipeline
    };

    const draftReport = {
        type: 'simplebeacon-report',
        reportVersion: 2,
        scan_summary: scanSummary,
        generatedAt: new Date().toISOString(),
        generatedBy: 'Simplebeacon',
        projectRoot: scanRoot,
        platformRoot: platformRoot !== scanRoot ? platformRoot : undefined,
        configPath: config.configPath,
        scanPaths,
        repositoryInventory,
        mockSampleFiles: uniqueFiles.filter((f) => {
            const isStructuralUtility = /-(path-resolver|resolver|stub-api|schema-validator|schema|consistency-checker|overrides|config|checker|specs)\.(js|cjs|mjs|ts|json)$/i.test(f.name);
            return !isStructuralUtility && (
                /(?:web\/data|data\/mock|data-central|fixtures?|sample)/i.test(f.relativePath)
                || /-sample\.json$/i.test(f.name)
            );
        }).length,
        totalFiles: uniqueFiles.length,
        totalLines,
        ruleScopedFilesAnalyzed,
        repositoryFilesTotal,
        repositoryFoldersTotal,
        filesAnalyzed: config.fullDirectoryScan ? uniqueFiles.length : ruleScopedFilesAnalyzed,
        totalSizeBytes: totalSize,
        totalSizeLabel: formatBytes(totalSize),
        issueCount,
        invalidJson,
        emptyFiles,
        qualityScore,
        schemaCompliance,
        schemaChecked: schemaStats.schemaChecked,
        schemaPassed: schemaStats.schemaPassed,
        pageSampleSchemaChecked: schemaStats.pageSampleSchemaChecked,
        pageSampleSchemaPassed: schemaStats.pageSampleSchemaPassed,
        duplicateGroups: duplicateGroups.length,
        roadmapSchemaChecked: roadmapValidation.checked,
        roadmapSchemaPassed: roadmapValidation.passed,
        consistencyChecked: consistency.checked,
        consistencyPassed: consistency.passed,
        consistencyScore: consistency.score,
        fictionJsonFilesScanned: consistency.jsonFilesScanned ?? consistency.checked ?? 0,
        fictionSampleFilesScanned: consistency.samplesScanned ?? 0,
        fictionScope: consistency.scope || 'repository-json',
        credentialScanned: credentialScan.scanned,
        credentialFindings: credentialScan.findings,
        productionLeakScanned: productionLeakScan.scanned,
        productionLeakFindings: productionLeakScan.findings,
        productionLeakSuppressedIntent: productionLeakScan.suppressedIntentCount || 0,
        sourceCodeFilesScanned: sourceFictionScan.scanned,
        sourceFictionPatternHits: sourceFictionScan.findings,
        llmSlopFilesScanned: llmSlopScan.scanned,
        llmSlopPatternHits: llmSlopScan.findings,
        euAiActScanned: euAiActScan.scanned,
        euAiActFindings: euAiActScan.findings,
        euAiActSummary: euAiActScan.summary,
        securityPatternFilesScanned: securityPatternScan.scanned,
        securityPatternFindings: securityPatternScan.findings,
        hardcodedUrlFilesScanned: scannedCount(hardcodedUrlScan),
        hardcodedUrlFindings: findingsCount(hardcodedUrlScan),
        weakCryptoFilesScanned: scannedCount(weakCryptoScan),
        weakCryptoFindings: findingsCount(weakCryptoScan),
        secretInCommentsFilesScanned: scannedCount(secretInCommentsScan),
        secretInCommentsFindings: findingsCount(secretInCommentsScan),
        syncIoFilesScanned: scannedCount(syncIoScan),
        syncIoFindings: findingsCount(syncIoScan),
        envInGitFilesScanned: scannedCount(envInGitScan),
        envInGitFindings: findingsCount(envInGitScan),
        redosFilesScanned: scannedCount(redosScan),
        redosFindings: findingsCount(redosScan),
        piiLoggingFilesScanned: scannedCount(piiLoggingScan),
        piiLoggingFindings: findingsCount(piiLoggingScan),
        deadCodeFilesScanned: scannedCount(deadCodeScan),
        deadCodeFindings: findingsCount(deadCodeScan),
        memoryLeakFilesScanned: scannedCount(memoryLeakScan),
        memoryLeakFindings: findingsCount(memoryLeakScan),
        typeSafetyFilesScanned: scannedCount(typeSafetyScan),
        typeSafetyFindings: findingsCount(typeSafetyScan),
        hallucinatedImportFilesScanned: scannedCount(hallucinatedImportScan),
        hallucinatedImportFindings: findingsCount(hallucinatedImportScan),
        astStructuralFilesScanned: scannedCount(astStructuralScan),
        astStructuralFindings: findingsCount(astStructuralScan),
        astAvailable: astStructuralScan.astAvailable || false,
        jestBaselineChecked: jestBaseline.checked,
        jestBaselinePassed: jestBaseline.passed,
        jestSummary: jestBaseline.summary || null,
        severityCounts,
        mockDataCategories,
        compliance: resolveComplianceCounts(root),
        detectedIssues: groupIssues(scoringIssues).slice(0, 12),
        rawIssues,
        benchmarkCacheIssues,
        sampleFiles: uniqueFiles.map((f) => f.name),
        scanScope,
        gate: gateResult
    };

    const gateSummary = draftReport.gate;
    draftReport.gate = {
        pass: gateSummary.pass,
        failOn: gateSummary.failOn,
        warnOn: gateSummary.warnOn,
        blockingCount: (gateSummary.blockingIssues || []).reduce((sum, i) => sum + (i.count || 1), 0),
        warningCount: (gateSummary.warningIssues || []).reduce((sum, i) => sum + (i.count || 1), 0),
        blockingIssues: gateSummary.blockingIssues || [],
        warningIssues: gateSummary.warningIssues || []
    };

    const normalizedReport = normalizePlatformScanReport(draftReport, { gateConfig: config.gate });
    return applyTierLimits(normalizedReport, options);
}

/**
 * Thin wrapper around scanMockDataDirectories for CLI entry point.
 * @param {string} baseDir
 * @param {Object} [options={}]
 * @returns {Promise<Object>}
 */
async function runScan(baseDir, options = {}) {
    if (typeof baseDir !== 'string') {
        throw new TypeError('runScan expects baseDir to be a string');
    }
    const safeOptions = options || {};
    return scanMockDataDirectories(baseDir, safeOptions.extraPaths || [], safeOptions);
}

module.exports = {
    runScan,
    scanMockDataDirectories,
    formatBytes,
    categoryForExt,
    validateSampleSchema,
    groupIssues,
    isBlockingIssue,
    countBySeverity,
    resolveEffectiveScanPaths,
    computeFilesAnalyzed,
    applyTierLimits,
    readFileCached,
    readFileCachedAsync,
    clearFileContentCache,
    loadSimplebeaconIgnorePatterns
};
