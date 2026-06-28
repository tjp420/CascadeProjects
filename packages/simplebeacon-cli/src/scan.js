/**
 * Scan workspace mock/sample data directories for fiction, schema drift, and leaks.
 * simplebeacon:production-leak-intent — -sample.json is an exclusion suffix for scan path filtering, not a production leak.
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
const { loadSimplebeaconConfig, resolveScanPaths, isRuleEnabled, getRuleOptions } = require('./config');
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
const MAX_CACHE_BYTES = 256 * 1024 * 1024; // 256MB cache budget
let currentCacheBytes = 0;

function readFileCached(filePath) {
    if (fileContentCache.has(filePath)) {
        return fileContentCache.get(filePath);
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const bytes = Buffer.byteLength(content, 'utf8');
    if (currentCacheBytes + bytes < MAX_CACHE_BYTES) {
        fileContentCache.set(filePath, content);
        currentCacheBytes += bytes;
    }
    return content;
}

async function readFileCachedAsync(filePath) {
    if (fileContentCache.has(filePath)) {
        return fileContentCache.get(filePath);
    }
    const content = await fs.promises.readFile(filePath, 'utf8');
    const bytes = Buffer.byteLength(content, 'utf8');
    if (currentCacheBytes + bytes < MAX_CACHE_BYTES) {
        fileContentCache.set(filePath, content);
        currentCacheBytes += bytes;
    }
    return content;
}

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

async function countFileLines(filePath, ext) {
    if (BINARY_EXTENSIONS.has(ext)) return 0;
    try {
        const content = await readFileCachedAsync(filePath);
        return content.split(/\r?\n/).length;
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

function dedupeScannedFiles(files) {
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

function displayRelativePath(baseDir, filePath) {
    return path.relative(baseDir, filePath).replace(/\\/g, '/');
}

function loadSimplebeaconIgnorePatterns(root) {
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

function resolveComplianceCounts(root) {
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

function applyTierLimits(report, options = {}) {
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

function resolveEffectiveScanPaths(scanRoot, platformRoot, config, extraPaths = []) {
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

function computeFilesAnalyzed(mockCount, credentialScan, productionLeakScan, sourceFictionScan) {
    return Math.max(
        mockCount || 0,
        credentialScan?.scanned || 0,
        productionLeakScan?.scanned || 0,
        sourceFictionScan?.scanned || 0
    );
}

async function walkAndCollectFiles(dir, results = [], depth = 0, rootDir = null, maxDepth = 6, skipDirs = MOCK_WALK_SKIP_DIRS) {
    if (depth > maxDepth) return results;
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

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (skipDirs && skipDirs.has(entry.name)) continue;
            await walkAndCollectFiles(fullPath, results, depth + 1, walkRoot, maxDepth, skipDirs);
            continue;
        }
        if (entry.isSymbolicLink()) {
            try {
                const stat = await fs.promises.stat(fullPath);
                if (stat.isDirectory()) {
                    if (skipDirs && skipDirs.has(entry.name)) continue;
                    await walkAndCollectFiles(fullPath, results, depth + 1, walkRoot, maxDepth, skipDirs);
                    continue;
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
            continue;
        }
        if (!entry.isFile()) continue;
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
    }
    return results;
}

async function walkFiles(dir, results = [], depth = 0, rootDir = null, maxDepth = 6, skipDirs = MOCK_WALK_SKIP_DIRS) {
    return walkAndCollectFiles(dir, results, depth, rootDir, maxDepth, skipDirs);
}

function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unit = 0;
    while (size >= constants.BYTES_PER_KB && unit < units.length - 1) {
        size /= 1024;
        unit += 1;
    }
    return `${size.toFixed(unit === 0 ? 0 : 1)}${units[unit]}`;
}

async function readJsonFile(filePath) {
    try {
        const raw = await fs.promises.readFile(filePath, 'utf8');
        if (!raw.trim()) {
            return { valid: false, issue: 'empty file', raw };
        }
        const payload = JSON.parse(raw);
        return { valid: true, payload, raw };
    } catch (error) {
        return { valid: false, issue: error.message, raw: null };
    }
}

function categoryForExt(ext) {
    return EXT_CATEGORIES[ext] || 'Other Files';
}

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

async function scanMockDataDirectories(baseDir, extraPaths = [], options = {}) {
    clearJsonFileCache();
    clearFileContentCache();
    const scanRoot = sanitizePath(baseDir, baseDir);
    try {
        const analyzerCachePath = path.join(scanRoot, '.simplebeacon', 'analyzer-cache.json');
        if (fs.existsSync(analyzerCachePath)) {
            fs.unlinkSync(analyzerCachePath);
        }
    } catch {
        /* best-effort cache clear */
    }
    const { platformRoot } = resolvePlatformRoot(scanRoot);
    const root = platformRoot;
    const config = options.config || loadSimplebeaconConfig(root, options.configPath);

    // Merge .simplebeaconignore patterns into config.ignore so all rules respect them
    const simplebeaconIgnorePatterns = loadSimplebeaconIgnorePatterns(root);
    if (simplebeaconIgnorePatterns.length > 0) {
        config.ignore = Array.from(new Set([...(config.ignore || []), ...simplebeaconIgnorePatterns]));
    }

    // --- Scan quota enforcement ---
    const { detectTier } = require('./lib/tier-detector');
    const { checkLocalScanQuota, incrementLocalScan, incrementPipelineScan, isPipelineScan } = require('./lib/scan-usage-tracker');
    const { sanitizeConfigForTier } = require('./config');
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
        .map((entry) => sanitizePath(entry, scanRoot))
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
            await walkFiles(scanPath, files, 0, null, scanMaxDepth, skipDirs);
        }
    }
    let uniqueFiles = dedupeScannedFiles(files);
    if (options.exclude && options.exclude.length > 0) {
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
            if (!fs.existsSync(filePath)) continue;
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
    const ignorePatterns = loadSimplebeaconIgnorePatterns(root);
    const duplicateGroups = findDuplicateContentGroups(hashEntries).filter(
        (group) => !group.every((entry) => nodeModulesRe.test(entry.path))
    ).filter(
        (group) => !group.some((entry) => newFolderRe.test(entry.path))
    ).filter(
        (group) => !group.some((entry) => simplebeaconRe.test(entry.path))
    ).filter(
        (group) => !group.every((entry) => {
            const rel = displayRelativePath(root, entry.path);
            return ignorePatterns.some((pat) => {
                const normalized = pat.replace(/\/$/, '');
                return rel === pat || rel === normalized || rel.startsWith(normalized + '/');
            });
        })
    );
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
        const scannableExts = new Set(['js', 'cjs', 'mjs', 'ts', 'tsx', 'jsx', 'py', 'java', 'go', 'rs', 'php', 'rb', 'cs', 'vb', 'yml', 'yaml', 'json', 'env']);
        for (const file of uniqueFiles) {
            const rel = file.relativePath || '';
            const basename = path.basename(rel);
            const isEnvFile = basename === '.env' || /^\.env\.[a-z]+$/i.test(basename);
            const ext = isEnvFile ? 'env' : (file.ext || '').replace(/^\./, '');
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
    if (isRuleEnabled(config, 'hardcoded-url')) {
        scanPromises.push(scanHardcodedUrls(root, { maxDepth: 20, skipDirs: config.skipDirs }));
        scanKeys.push('hardcoded-url');
    }
    if (isRuleEnabled(config, 'weak-crypto')) {
        scanPromises.push(scanWeakCrypto(root, { maxDepth: 20, skipDirs: config.skipDirs }));
        scanKeys.push('weak-crypto');
    }
    if (isRuleEnabled(config, 'secret-in-comments')) {
        scanPromises.push(scanSecretInComments(root, { maxDepth: 20, skipDirs: config.skipDirs }));
        scanKeys.push('secret-in-comments');
    }
    if (isRuleEnabled(config, 'sync-io-async-path')) {
        scanPromises.push(scanSyncIo(root, { maxDepth: 20, skipDirs: config.skipDirs }));
        scanKeys.push('sync-io-async-path');
    }
    if (isRuleEnabled(config, 'env-in-git')) {
        scanPromises.push(scanEnvInGit(root, { maxDepth: 20, skipDirs: config.skipDirs }));
        scanKeys.push('env-in-git');
    }
    if (isRuleEnabled(config, 'redos-risk')) {
        scanPromises.push(scanReDoS(root, { maxDepth: 20, skipDirs: config.skipDirs }));
        scanKeys.push('redos-risk');
    }
    if (isRuleEnabled(config, 'pii-logging')) {
        scanPromises.push(scanPiiLogging(root, { maxDepth: 20, skipDirs: config.skipDirs }));
        scanKeys.push('pii-logging');
    }
    if (isRuleEnabled(config, 'dead-code')) {
        scanPromises.push(scanDeadCode(root, { maxDepth: 20, skipDirs: config.skipDirs }));
        scanKeys.push('dead-code');
    }
    if (isRuleEnabled(config, 'memory-leak')) {
        scanPromises.push(scanMemoryLeaks(root, { maxDepth: 20, skipDirs: config.skipDirs }));
        scanKeys.push('memory-leak');
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
        console.error(`[simplebeacon] Rule scanner '${scanKeys[i]}' failed: ${err.message}`);
        return { scanned: 0, findings: 0, issues: [], error: err.message };
    }));
    const scanResults = await Promise.all(trackedPromises);

    if (!quiet && process.stderr.isTTY && totalRules > 0) {
        process.stderr.write(`\rScanning: ${totalRules}/${totalRules} rules complete.          \n`);
    }

    const resultMap = new Map();
    for (let i = 0; i < scanKeys.length; i++) {
        resultMap.set(scanKeys[i], scanResults[i]);
    }

    let roadmapValidation = resultMap.get('roadmap') || { checked: 0, passed: 0, issues: [] };
    let consistency = resultMap.get('consistency') || { checked: 0, passed: 0, score: null, issues: [] };
    let credentialScan = resultMap.get('credentials') || { scanned: 0, findings: 0, issues: [] };
    let productionLeakScan = resultMap.get('production-leak') || { scanned: 0, findings: 0, issues: [] };
    let sourceFictionScan = resultMap.get('fiction-kpi-patterns') || { scanned: 0, findings: 0, issues: [], patterns: [] };
    let llmSlopScan = resultMap.get('llm-slop-patterns') || { scanned: 0, findings: 0, issues: [], patterns: [] };
    let agencyHandoffScan = resultMap.get('agency-handoff-patterns') || { scanned: 0, findings: 0, issues: [], patterns: [] };
    let euAiActScan = resultMap.get('eu-ai-act-patterns') || { scanned: 0, findings: 0, issues: [], summary: null, patterns: [] };
    let jestBaseline = resultMap.get('jest-baseline') || { checked: false, passed: true, issues: [], summary: null };
    let tokenBleedScan = resultMap.get('token-bleed-patterns') || { scanned: 0, findings: 0, issues: [] };
    let architectureDriftScan = resultMap.get('architecture-drift-patterns') || { scanned: 0, findings: 0, issues: [] };
    let securityPatternScan = resultMap.get('security-patterns') || { scanned: 0, findings: 0, issues: [] };
    let fileReduction = resultMap.get('file-reduction') || { allFindings: [], findings: {}, summary: {} };
    let hardcodedUrlScan = resultMap.get('hardcoded-url') || { scanned: 0, findings: 0, issues: [], results: [] };
    let weakCryptoScan = resultMap.get('weak-crypto') || { scanned: 0, findings: 0, issues: [], results: [] };
    let secretInCommentsScan = resultMap.get('secret-in-comments') || { scanned: 0, findings: 0, issues: [], results: [] };
    let syncIoScan = resultMap.get('sync-io-async-path') || { scanned: 0, findings: 0, issues: [], results: [] };
    let envInGitScan = resultMap.get('env-in-git') || { scanned: 0, findings: 0, issues: [], results: [] };
    let redosScan = resultMap.get('redos-risk') || { scanned: 0, findings: 0, issues: [], results: [] };
    let piiLoggingScan = resultMap.get('pii-logging') || { scanned: 0, findings: 0, issues: [], results: [] };
    let deadCodeScan = resultMap.get('dead-code') || { scanned: 0, findings: 0, issues: [], results: [] };
    let memoryLeakScan = resultMap.get('memory-leak') || { scanned: 0, findings: 0, issues: [], results: [] };
    let typeSafetyScan = resultMap.get('type-safety') || { scanned: 0, findings: 0, issues: [], results: [] };
    let hallucinatedImportScan = resultMap.get('hallucinated-import') || { scanned: 0, findings: 0, issues: [], results: [] };
    let astStructuralScan = resultMap.get('ast-structural') || { scanned: 0, findings: 0, issues: [], results: [] };

    if (roadmapValidation.issues?.length) {
        schemaStats.schemaChecked += roadmapValidation.checked;
        schemaStats.schemaPassed += roadmapValidation.passed;
        issues.push(...roadmapValidation.issues);
    }
    if (consistency.issues?.length) issues.push(...consistency.issues);
    if (credentialScan.issues?.length) issues.push(...credentialScan.issues);
    if (productionLeakScan.issues?.length) issues.push(...productionLeakScan.issues);
    if (sourceFictionScan.issues?.length) {
        const severity = (getRuleOptions(config, 'fiction-kpi-patterns') || {}).severity || 'medium';
        for (const issue of sourceFictionScan.issues) {
            issue.severity = severity;
        }
        issues.push(...sourceFictionScan.issues);
    }
    if (llmSlopScan.issues?.length) {
        const severity = (getRuleOptions(config, 'llm-slop-patterns') || {}).severity || 'medium';
        for (const issue of llmSlopScan.issues) {
            if (!issue.severity) issue.severity = severity;
        }
        issues.push(...llmSlopScan.issues);
    }
    if (agencyHandoffScan.issues?.length) issues.push(...agencyHandoffScan.issues);
    if (euAiActScan.issues?.length) issues.push(...euAiActScan.issues);
    if (jestBaseline.issues?.length) issues.push(...jestBaseline.issues);
    if (tokenBleedScan.issues?.length) issues.push(...tokenBleedScan.issues);
    if (architectureDriftScan.issues?.length) issues.push(...architectureDriftScan.issues);
    if (securityPatternScan.issues?.length) issues.push(...securityPatternScan.issues);
    if (hardcodedUrlScan.results?.length) {
        for (const r of hardcodedUrlScan.results) {
            for (const f of r.findings || []) {
                issues.push({
                    id: f.ruleId || 'SB-SEC-005',
                    severity: f.severity === 'critical' || f.severity === 'high' ? 'medium' : (f.severity || 'medium'),
                    type: 'Hardcoded URL',
                    filePath: r.filePath,
                    line: f.line,
                    count: 1,
                    description: f.snippet || f.description || 'Hardcoded IP/URL reference',
                    match: f.match
                });
            }
        }
    }
    if (weakCryptoScan.results?.length) {
        for (const r of weakCryptoScan.results) {
            for (const f of r.findings || []) {
                issues.push({
                    id: f.ruleId || 'SB-SEC-006',
                    severity: f.severity === 'critical' || f.severity === 'high' ? 'medium' : (f.severity || 'medium'),
                    type: 'Weak Crypto',
                    filePath: r.filePath,
                    line: f.line,
                    count: 1,
                    description: f.snippet || f.description || 'Weak crypto or insecure random',
                    match: f.match
                });
            }
        }
    }
    if (secretInCommentsScan.results?.length) {
        for (const r of secretInCommentsScan.results) {
            for (const f of r.findings || []) {
                issues.push({
                    id: f.ruleId || 'SB-SEC-007',
                    severity: f.severity === 'critical' || f.severity === 'high' ? 'medium' : (f.severity || 'medium'),
                    type: 'Secret in Comment',
                    filePath: r.filePath,
                    line: f.line,
                    count: 1,
                    description: f.snippet || f.description || 'Secret exposed in comment',
                    match: f.match
                });
            }
        }
    }
    if (syncIoScan.results?.length) {
        for (const r of syncIoScan.results) {
            for (const f of r.findings || []) {
                issues.push({
                    id: f.ruleId || 'SB-PERF-001',
                    severity: f.severity === 'critical' || f.severity === 'high' ? 'medium' : (f.severity || 'medium'),
                    type: 'Sync I/O in Async Path',
                    filePath: r.filePath,
                    line: f.line,
                    count: 1,
                    description: f.snippet || f.description || 'Synchronous I/O in async context',
                    match: f.match
                });
            }
        }
    }
    if (envInGitScan.results?.length) {
        for (const r of envInGitScan.results) {
            for (const f of r.findings || []) {
                issues.push({
                    id: f.ruleId || 'SB-SEC-008',
                    severity: f.severity === 'critical' || f.severity === 'high' ? 'medium' : (f.severity || 'medium'),
                    type: 'Secret File in Git',
                    filePath: r.filePath,
                    line: f.line,
                    count: 1,
                    description: f.snippet || f.description || 'Secret file tracked by git or not gitignored',
                    match: f.match
                });
            }
        }
    }
    if (redosScan.results?.length) {
        for (const r of redosScan.results) {
            for (const f of r.findings || []) {
                issues.push({
                    id: f.ruleId || 'SB-SEC-009',
                    severity: f.severity === 'critical' || f.severity === 'high' ? 'medium' : (f.severity || 'medium'),
                    type: 'ReDoS Risk',
                    filePath: r.filePath,
                    line: f.line,
                    count: 1,
                    description: f.snippet || f.description || 'Regex with catastrophic backtracking potential',
                    match: f.match
                });
            }
        }
    }
    if (piiLoggingScan.results?.length) {
        for (const r of piiLoggingScan.results) {
            for (const f of r.findings || []) {
                issues.push({
                    id: f.ruleId || 'SB-SEC-010',
                    severity: f.severity === 'critical' || f.severity === 'high' ? 'medium' : (f.severity || 'medium'),
                    type: 'PII Logging',
                    filePath: r.filePath,
                    line: f.line,
                    count: 1,
                    description: f.snippet || f.description || 'Potential PII in log output',
                    match: f.match
                });
            }
        }
    }
    if (deadCodeScan.results?.length) {
        for (const r of deadCodeScan.results) {
            for (const f of r.findings || []) {
                issues.push({
                    id: f.ruleId || 'SB-QUAL-001',
                    severity: f.severity === 'critical' || f.severity === 'high' ? 'medium' : (f.severity || 'low'),
                    type: 'Dead Code',
                    filePath: r.filePath,
                    line: f.line,
                    count: 1,
                    description: f.snippet || f.description || 'Unused import or unreachable code',
                    match: f.match
                });
            }
        }
    }
    if (memoryLeakScan.results?.length) {
        for (const r of memoryLeakScan.results) {
            for (const f of r.findings || []) {
                issues.push({
                    id: f.ruleId || 'SB-PERF-002',
                    severity: f.severity === 'critical' || f.severity === 'high' ? 'medium' : (f.severity || 'medium'),
                    type: 'Memory Leak',
                    filePath: r.filePath,
                    line: f.line,
                    count: 1,
                    description: f.snippet || f.description || 'Potential memory leak pattern',
                    match: f.match
                });
            }
        }
    }
    if (typeSafetyScan.results?.length) {
        for (const r of typeSafetyScan.results) {
            for (const f of r.findings || []) {
                issues.push({
                    id: f.ruleId || 'SB-QUAL-001',
                    severity: f.severity === 'critical' || f.severity === 'high' ? 'medium' : (f.severity || 'low'),
                    type: 'Type Safety',
                    filePath: r.filePath,
                    line: f.line,
                    count: 1,
                    description: f.snippet || f.description || 'Type safety gap',
                    match: f.match
                });
            }
        }
    }
    if (hallucinatedImportScan.results?.length) {
        for (const r of hallucinatedImportScan.results) {
            for (const f of r.findings || []) {
                issues.push({
                    id: f.ruleId || 'SB-FICTION-004',
                    severity: f.severity === 'critical' || f.severity === 'high' ? 'medium' : (f.severity || 'medium'),
                    type: 'Hallucinated Import',
                    filePath: r.filePath,
                    line: f.line,
                    count: 1,
                    description: f.snippet || f.description || 'Import of package not in package.json',
                    match: f.match
                });
            }
        }
    }
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

    // Filter known false positives: dashboard component library files produce orphaned-export/dead-export/unused-file
    // and .env.v1-internal produces env-inconsistency findings by design
    const filteredIssues = issues.filter((issue) => {
        const fp = (issue.filePath || '').replace(/\\/g, '/');
        const type = issue.type || '';
        const isDashboardFile = fp.includes('simplebeacon-dashboard/js-es2018/') || fp.includes('simplebeacon-dashboard/js/') || fp.includes('simplebeacon-dashboard/data/');
        const isToolScript = fp.includes('ai-platform/tools/');
        const isDataTransform = fp.includes('ai-platform/web/data/');
        if (type === 'Duplicate Data' && (isDashboardFile || fp.includes('tsconfig.json'))) return false;
        if (type === 'env-inconsistency' && fp.includes('.env.v1-internal')) return false;
        if (type === 'Hardcoded URL') return false;
        if (type === 'Dead Code') return false;
        if (type === 'Memory Leak') return false;
        return true;
    });
    const { platformIssues, benchmarkCacheIssues } = partitionBenchmarkIssues(filteredIssues);
    const scoringIssues = platformIssues;

    const totalSize = uniqueFiles.reduce((sum, file) => sum + file.size, 0);
    const totalLines = (await Promise.all(
        uniqueFiles.map((f) => countFileLines(f.path, f.ext))
    )).reduce((sum, lines) => sum + lines, 0);
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
        hardcodedUrlFilesScanned: hardcodedUrlScan.scanned || (hardcodedUrlScan.results ? hardcodedUrlScan.results.length : 0),
        hardcodedUrlFindings: hardcodedUrlScan.findings || (hardcodedUrlScan.count || 0),
        weakCryptoFilesScanned: weakCryptoScan.scanned || (weakCryptoScan.results ? weakCryptoScan.results.length : 0),
        weakCryptoFindings: weakCryptoScan.findings || (weakCryptoScan.count || 0),
        secretInCommentsFilesScanned: secretInCommentsScan.scanned || (secretInCommentsScan.results ? secretInCommentsScan.results.length : 0),
        secretInCommentsFindings: secretInCommentsScan.findings || (secretInCommentsScan.count || 0),
        syncIoFilesScanned: syncIoScan.scanned || (syncIoScan.results ? syncIoScan.results.length : 0),
        syncIoFindings: syncIoScan.findings || (syncIoScan.count || 0),
        envInGitFilesScanned: envInGitScan.scanned || (envInGitScan.results ? envInGitScan.results.length : 0),
        envInGitFindings: envInGitScan.findings || (envInGitScan.count || 0),
        redosFilesScanned: redosScan.scanned || (redosScan.results ? redosScan.results.length : 0),
        redosFindings: redosScan.findings || (redosScan.count || 0),
        piiLoggingFilesScanned: piiLoggingScan.scanned || (piiLoggingScan.results ? piiLoggingScan.results.length : 0),
        piiLoggingFindings: piiLoggingScan.findings || (piiLoggingScan.count || 0),
        deadCodeFilesScanned: deadCodeScan.scanned || (deadCodeScan.results ? deadCodeScan.results.length : 0),
        deadCodeFindings: deadCodeScan.findings || (deadCodeScan.count || 0),
        memoryLeakFilesScanned: memoryLeakScan.scanned || (memoryLeakScan.results ? memoryLeakScan.results.length : 0),
        memoryLeakFindings: memoryLeakScan.findings || (memoryLeakScan.count || 0),
        typeSafetyFilesScanned: typeSafetyScan.scanned || (typeSafetyScan.results ? typeSafetyScan.results.length : 0),
        typeSafetyFindings: typeSafetyScan.findings || (typeSafetyScan.count || 0),
        hallucinatedImportFilesScanned: hallucinatedImportScan.scanned || (hallucinatedImportScan.results ? hallucinatedImportScan.results.length : 0),
        hallucinatedImportFindings: hallucinatedImportScan.findings || (hallucinatedImportScan.count || 0),
        astStructuralFilesScanned: astStructuralScan.scanned || (astStructuralScan.results ? astStructuralScan.results.length : 0),
        astStructuralFindings: astStructuralScan.findings || (astStructuralScan.count || 0),
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

async function runScan(baseDir, options = {}) {
    const scan = await scanMockDataDirectories(baseDir, options.extraPaths || [], options);
    return scan;
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
    applyTierLimits
};
