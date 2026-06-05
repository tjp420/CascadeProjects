/**
 * Scan workspace mock/sample data directories for fiction, schema drift, and leaks.
 */

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
const { scanProductionLeaks } = require('./rules/production-leak');
const { scanSourceFictionPatterns } = require('./rules/fiction-kpi-patterns');
const { scanLlmSlopPatterns } = require('./rules/llm-slop-patterns');
const { scanAgencyHandoffPatterns } = require('./rules/agency-handoff-patterns');
const { scanEuAiActPatterns, buildEuAiActSummaryFromScan } = require('./rules/eu-ai-act-patterns');
const { scanTokenBleedPatterns } = require('./rules/token-bleed-patterns');
const { scanEnterpriseGuardrailPatterns } = require('./rules/enterprise-guardrail-patterns');
const { scanStructuralIntentPatterns } = require('./rules/structural-intent-patterns');
const { scanArchitectureDriftPatterns } = require('./rules/architecture-drift-patterns');
const { scanFileNamingPatterns } = require('./rules/file-naming-patterns');
const { checkJestBaseline } = require('./rules/jest-baseline');
const { loadSimplebeaconConfig, resolveScanPaths, isRuleEnabled, getRuleOptions, resolveFullTreeSkipDirs, isIntelligenceEnabled, getIntelligenceOptions } = require('./config');
const { resolvePlatformRoot, isIsolatedScanRoot } = require('./project-detect');
const { countRepositoryInventory } = require('./lib/repository-inventory');
const { analyzeFullDirectory } = require('./lib/full-directory-scanner');
const { createScanProgressWriter, resolveScanProgressPath } = require('./lib/scan-progress');
const { normalizePathKey } = require('./lib/path-utils');
const { sanitizePath } = require('./lib/path-sanitizer');
const {
    isExternalBenchmarkCachePath,
    partitionBenchmarkIssues,
    MOCK_WALK_SKIP_DIRS
} = require('./lib/benchmark-cache-paths');
const { normalizePlatformScanReport } = require('./lib/normalize-scan-report');
const { evaluateGate } = require('./gate');
const { isBlockingIssue, groupIssues, countBySeverity, computeQualityScoreFromIssues } = require('./lib/issue-utils');

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

function resolveEffectiveScanPaths(scanRoot, platformRoot, config, extraPaths = []) {
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
    return resolveScanPaths(platformRoot, config, [scanRoot, ...(extraPaths || [])]);
}

function computeFilesAnalyzed(mockCount, credentialScan, productionLeakScan, sourceFictionScan) {
    return Math.max(
        mockCount || 0,
        credentialScan?.scanned || 0,
        productionLeakScan?.scanned || 0,
        sourceFictionScan?.scanned || 0
    );
}

async function walkFiles(dir, results = [], depth = 0, rootDir = null) {
    if (depth > 6) return results;
    const walkRoot = rootDir || dir;
    let entries;
    try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
        return results;
    }

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (MOCK_WALK_SKIP_DIRS.has(entry.name)) continue;
            await walkFiles(fullPath, results, depth + 1, walkRoot);
            continue;
        }
        if (!entry.isFile()) continue;
        try {
            const stat = await fs.promises.stat(fullPath);
            const relativePath = path.relative(walkRoot, fullPath).replace(/\\/g, '/');
            if (isExternalBenchmarkCachePath(relativePath)) continue;
            results.push({
                path: fullPath,
                name: entry.name,
                ext: path.extname(entry.name).toLowerCase(),
                size: stat.size,
                relativePath
            });
        } catch {
            /* skip unreadable files */
        }
    }
    return results;
}

function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
        size /= 1024;
        unit += 1;
    }
    return `${size.toFixed(unit === 0 ? 0 : 1)}${units[unit]}`;
}

function formatFullTreeLimitation(stats, root, fullTreeRoot, skipDirs = []) {
    const scope = displayRelativePath(root, fullTreeRoot) || fullTreeRoot;
    const cap = stats.maxContentBytes;
    const hasCap = Number.isFinite(cap);
    const capPhrase = hasCap
        ? `text content capped at ${Math.round(cap / 1024 / 1024)}MB (${stats.filesLargeHashed.toLocaleString()} hashed without content scan)`
        : 'all text files content-scanned with no size cap';
    const skipList = skipDirs instanceof Set ? [...skipDirs] : (Array.isArray(skipDirs) ? skipDirs : []);
    const skipPhrase = skipList.length
        ? `Skips ${skipList.join(', ')}`
        : 'Skips only .git';
    return `Full-tree scan: ${stats.filesAnalyzed.toLocaleString()} files under ${scope} — ${stats.filesHashed.toLocaleString()} SHA-256 hashed, ${stats.filesContentScanned.toLocaleString()} content-scanned (all gate rules; ${capPhrase}), ${stats.filesBinaryHashed.toLocaleString()} binary hashed only. ${skipPhrase}.`;
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
    const scanRoot = sanitizePath(baseDir, baseDir);
    const { platformRoot } = resolvePlatformRoot(scanRoot);
    const root = platformRoot;
    const progressPath = resolveScanProgressPath(scanRoot, options);
    const progress = createScanProgressWriter(progressPath, {
        projectRoot: scanRoot,
        phase: 'gate'
    });
    progress.update({ label: 'Starting scan', currentFile: null, processed: 0, total: null });

    try {
    const config = options.config || loadSimplebeaconConfig(root, options.configPath);
    const fullDirectoryScan = Boolean(options.fullDirectoryScan ?? config.fullDirectoryScan);
    const fullTreeRoot = scanRoot;
    if (options.withJest && config.rules?.['jest-baseline']) {
        config.rules['jest-baseline'] = { ...config.rules['jest-baseline'], enabled: true, runTests: true };
    }
    const sanitizedExtraPaths = (extraPaths || [])
        .map((entry) => sanitizePath(entry, scanRoot))
        .filter(Boolean);
    const scanPaths = resolveEffectiveScanPaths(scanRoot, root, config, sanitizedExtraPaths);
    const inventoryPromise = fullDirectoryScan
        ? Promise.resolve(null)
        : countRepositoryInventory(root, {
            profile: options.inventoryProfile || 'audit',
            skipDirs: [...MOCK_WALK_SKIP_DIRS]
        });

    const categories = new Map();
    const issues = [];
    let fullDirectoryStats = null;
    let fullDirectoryInventory = null;
    let fullDirectoryEuActStats = null;
    let fullTreeSkipDirs = null;
    let uniqueFiles = [];

    if (fullDirectoryScan) {
        const leakOpts = getRuleOptions(config, 'production-leak');
        const euOpts = getRuleOptions(config, 'eu-ai-act-patterns');
        fullTreeSkipDirs = resolveFullTreeSkipDirs(options, config);
        const full = await analyzeFullDirectory(fullTreeRoot, {
            maxFiles: config.fullDirectoryScanMaxFiles,
            skipDirs: fullTreeSkipDirs,
            config,
            productionLeakOptions: leakOpts,
            euAiActSeverity: euOpts.severity || 'medium',
            rules: {
                productionLeak: isRuleEnabled(config, 'production-leak'),
                agencyHandoff: isRuleEnabled(config, 'agency-handoff-patterns'),
                fiction: isRuleEnabled(config, 'fiction-kpi-patterns'),
                euAiAct: isRuleEnabled(config, 'eu-ai-act-patterns'),
                tokenBleed: isRuleEnabled(config, 'token-bleed-patterns'),
                architectureDrift: isRuleEnabled(config, 'architecture-drift-patterns'),
                fileNaming: isRuleEnabled(config, 'file-naming-patterns')
            },
            onProgress: (evt) => progress.update({
                phase: 'full-tree',
                label: 'Analyzing files',
                fileKind: 'full-tree',
                currentFile: evt.currentFile,
                processed: evt.processed,
                total: evt.total,
                fullDirectoryScan: true,
                skipDirs: [...fullTreeSkipDirs]
            })
        });
        uniqueFiles = full.files;
        fullDirectoryStats = full.stats;
        fullDirectoryInventory = full.inventory;
        fullDirectoryEuActStats = full.euActStats || null;
        for (const issue of full.issues) {
            issues.push(issue);
        }
        for (const cat of full.categories) {
            categories.set(cat.category, cat);
        }
    } else {
        const files = [];
        for (const scanPath of scanPaths) {
            if (fs.existsSync(scanPath)) {
                await walkFiles(scanPath, files);
            }
        }
        uniqueFiles = dedupeScannedFiles(files);
    }

    const hashEntries = [];
    let invalidJson = fullDirectoryStats?.jsonInvalid ?? 0;
    let emptyFiles = fullDirectoryStats?.emptyFiles ?? 0;
    const schemaEnabled = isRuleEnabled(config, 'json-schema');
    const pageSamplesValidated = new Set();
    const schemaStats = {
        schemaChecked: 0,
        schemaPassed: 0,
        pageSampleSchemaChecked: 0,
        pageSampleSchemaPassed: 0
    };

    if (!fullDirectoryScan) {
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

        if (file.ext === '.json') {
            const parsed = await readJsonFile(file.path);
            if (!parsed.valid) {
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
            } else {
                hashEntries.push({
                    name: file.name,
                    path: file.path,
                    contentHash: hashFileContent(parsed.raw)
                });

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
    }

    let pageSpecsFromAlias = 0;
    if (!fullDirectoryScan && schemaEnabled) {
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

    const duplicateGroups = findDuplicateContentGroups(hashEntries);
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

    let roadmapValidation = { checked: 0, passed: 0, issues: [] };
    if (isRuleEnabled(config, 'roadmap')) {
        roadmapValidation = await validateRoadmapFiles(root, { baseline: config.baseline });
        schemaStats.schemaChecked += roadmapValidation.checked;
        schemaStats.schemaPassed += roadmapValidation.passed;
        issues.push(...roadmapValidation.issues);
    }

    let consistency = { checked: 0, passed: 0, score: null, issues: [] };
    if (isRuleEnabled(config, 'sample-consistency')) {
        consistency = await checkSampleConsistency(root, {
            sampleDir: config.sampleDir,
            baseline: config.baseline,
            anchorSamples: config.consistencyAnchorSamples,
            scanPathFiles: uniqueFiles.filter((file) => file.ext === '.json'),
            fictionScope: options.fictionScope || 'repository-json',
            ignoreGlobs: config.ignore
        });
        issues.push(...consistency.issues);
    }

    let credentialScan = { scanned: 0, findings: 0, issues: [] };
    const fullTreeHits = fullDirectoryStats?.ruleHitTotals || null;
    const fullTreeContentScanned = fullDirectoryStats?.filesContentScanned ?? 0;
    if (isRuleEnabled(config, 'credentials')) {
        if (fullDirectoryScan && fullDirectoryStats) {
            credentialScan = {
                scanned: fullTreeContentScanned,
                findings: fullTreeHits?.credentials ?? 0,
                issues: []
            };
        } else {
            const credOpts = getRuleOptions(config, 'credentials');
            credentialScan = await scanCredentialPatterns(uniqueFiles, {
                scanProduction: credOpts.scanProduction !== false,
                baseDir: root,
                productionPaths: credOpts.productionPaths || config.productionPaths,
                ignoreGlobs: config.ignore
            });
            issues.push(...credentialScan.issues);
        }
    }

    const ruleWalkRoot = fullDirectoryScan ? fullTreeRoot : root;

    let productionLeakScan = { scanned: 0, findings: 0, issues: [] };
    if (isRuleEnabled(config, 'production-leak')) {
        if (fullDirectoryScan && fullTreeHits) {
            productionLeakScan = {
                scanned: fullTreeContentScanned,
                findings: fullTreeHits.productionLeak,
                issues: []
            };
        } else {
            const leakOpts = getRuleOptions(config, 'production-leak');
            productionLeakScan = await scanProductionLeaks(ruleWalkRoot, {
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
            });
            issues.push(...productionLeakScan.issues);
        }
    }

    let sourceFictionScan = { scanned: 0, findings: 0, issues: [], patterns: [] };
    if (isRuleEnabled(config, 'fiction-kpi-patterns')) {
        if (fullDirectoryScan && fullTreeHits) {
            sourceFictionScan = {
                scanned: fullTreeContentScanned,
                findings: fullTreeHits.fictionKpi,
                issues: [],
                patterns: []
            };
        } else {
            const fictionOpts = getRuleOptions(config, 'fiction-kpi-patterns');
            sourceFictionScan = await scanSourceFictionPatterns(ruleWalkRoot, {
                sourcePaths: fictionOpts.sourcePaths || config.sourceCodeScanPaths,
                ignoreGlobs: fictionOpts.ignoreGlobs || config.ignore,
                pathExclusions: config.pathExclusions || [],
                baseline: config.baseline
            });
            const severity = fictionOpts.severity || 'medium';
            for (const issue of sourceFictionScan.issues) {
                issue.severity = severity;
            }
            issues.push(...sourceFictionScan.issues);
        }
    }

    let llmSlopScan = { scanned: 0, findings: 0, issues: [], patterns: [] };
    if (isRuleEnabled(config, 'llm-slop-patterns')) {
        if (fullDirectoryScan && fullTreeHits) {
            llmSlopScan = {
                scanned: fullTreeContentScanned,
                findings: fullTreeHits.llmSlop,
                issues: [],
                patterns: []
            };
        } else {
            const slopOpts = getRuleOptions(config, 'llm-slop-patterns');
            llmSlopScan = await scanLlmSlopPatterns(ruleWalkRoot, {
                sourcePaths: slopOpts.sourcePaths || config.sourceCodeScanPaths,
                productionPaths: slopOpts.productionPaths || config.productionPaths,
                ignoreGlobs: slopOpts.ignoreGlobs || config.ignore,
                registryCheck: slopOpts.registryCheck === true
                    || process.env.SIMPLEBEACON_REGISTRY_CHECK === 'true',
                registryCheckLimit: slopOpts.registryCheckLimit || 12
            });
            const severity = slopOpts.severity || 'medium';
            for (const issue of llmSlopScan.issues) {
                if (!issue.severity) issue.severity = severity;
            }
            issues.push(...llmSlopScan.issues);
        }
    }

    const benchmarkScanTarget = isExternalBenchmarkCachePath(scanRoot);

    let agencyHandoffScan = { scanned: 0, findings: 0, issues: [], patterns: [] };
    if (isRuleEnabled(config, 'agency-handoff-patterns') && !benchmarkScanTarget) {
        if (fullDirectoryScan && fullTreeHits) {
            agencyHandoffScan = {
                scanned: fullTreeContentScanned,
                findings: fullTreeHits.agencyHandoff,
                issues: [],
                patterns: []
            };
        } else {
            const handoffOpts = getRuleOptions(config, 'agency-handoff-patterns');
            agencyHandoffScan = await scanAgencyHandoffPatterns(ruleWalkRoot, {
                sourcePaths: handoffOpts.sourcePaths || config.sourceCodeScanPaths,
                productionPaths: handoffOpts.productionPaths || config.productionPaths,
                ignoreGlobs: handoffOpts.ignoreGlobs || config.ignore,
                severity: handoffOpts.severity || 'medium'
            });
            issues.push(...agencyHandoffScan.issues);
        }
    }

    let tokenBleedScan = { scanned: 0, findings: 0, issues: [], patterns: [] };
    if (isRuleEnabled(config, 'token-bleed-patterns') && !benchmarkScanTarget) {
        if (fullDirectoryScan && fullTreeHits) {
            tokenBleedScan = {
                scanned: fullTreeContentScanned,
                findings: fullTreeHits.tokenBleed,
                issues: [],
                patterns: []
            };
        } else {
            const tbOpts = getRuleOptions(config, 'token-bleed-patterns');
            tokenBleedScan = await scanTokenBleedPatterns(ruleWalkRoot, {
                productionPaths: tbOpts.productionPaths || config.productionPaths,
                ignoreGlobs: tbOpts.ignoreGlobs || config.ignore,
                severity: tbOpts.severity || 'medium'
            });
            issues.push(...tokenBleedScan.issues);
        }
    }

    let architectureDriftScan = { scanned: 0, findings: 0, issues: [], patterns: [] };
    if (isRuleEnabled(config, 'architecture-drift-patterns') && !benchmarkScanTarget) {
        if (fullDirectoryScan && fullTreeHits) {
            architectureDriftScan = {
                scanned: fullTreeContentScanned,
                findings: fullTreeHits.architectureDrift,
                issues: [],
                patterns: []
            };
        } else {
            const adOpts = getRuleOptions(config, 'architecture-drift-patterns');
            architectureDriftScan = await scanArchitectureDriftPatterns(ruleWalkRoot, {
                productionPaths: adOpts.productionPaths || config.productionPaths,
                ignoreGlobs: adOpts.ignoreGlobs || config.ignore,
                severity: adOpts.severity || 'high'
            });
            issues.push(...architectureDriftScan.issues);
        }
    }

    let pythonAstScan = { scanned: 0, findings: 0, issues: [], patterns: [], ok: true };
    if (isRuleEnabled(config, 'python-ast-patterns') && !benchmarkScanTarget) {
        const { scanPythonAstPatterns } = require('./lib/python-ast-scanner');
        const pyOpts = getRuleOptions(config, 'python-ast-patterns');
        pythonAstScan = await scanPythonAstPatterns(ruleWalkRoot, {
            productionPaths: pyOpts.productionPaths || config.productionPaths,
            ignoreGlobs: pyOpts.ignoreGlobs || config.ignore,
            severity: pyOpts.severity || 'medium',
            timeoutMs: pyOpts.timeoutMs
        });
        if (pythonAstScan.ok) {
            issues.push(...pythonAstScan.issues);
        }
    }

    let javascriptAstScan = { scanned: 0, findings: 0, issues: [], patterns: [], ok: true };
    if (isRuleEnabled(config, 'javascript-ast-patterns') && !benchmarkScanTarget) {
        const { scanJavascriptAstPatterns } = require('./lib/javascript-ast-scanner');
        const jsOpts = getRuleOptions(config, 'javascript-ast-patterns');
        javascriptAstScan = await scanJavascriptAstPatterns(ruleWalkRoot, {
            productionPaths: jsOpts.productionPaths || config.productionPaths,
            ignoreGlobs: jsOpts.ignoreGlobs || config.ignore,
            severity: jsOpts.severity || 'medium'
        });
        if (javascriptAstScan.ok) {
            issues.push(...javascriptAstScan.issues);
        }
    }

    let euAiActScan = { scanned: 0, findings: 0, issues: [], summary: null, patterns: [] };
    if (isRuleEnabled(config, 'eu-ai-act-patterns') && !benchmarkScanTarget) {
        if (fullDirectoryScan && fullTreeHits) {
            euAiActScan = {
                scanned: fullTreeContentScanned,
                findings: fullTreeHits.euAiAct,
                issues: [],
                summary: buildEuAiActSummaryFromScan(fullTreeRoot, issues, fullDirectoryEuActStats || {}),
                patterns: []
            };
        } else {
            const euOpts = getRuleOptions(config, 'eu-ai-act-patterns');
            euAiActScan = await scanEuAiActPatterns(ruleWalkRoot, {
                fileList: uniqueFiles,
                sourcePaths: euOpts.sourcePaths || config.sourceCodeScanPaths,
                productionPaths: euOpts.productionPaths || config.productionPaths,
                ignoreGlobs: euOpts.ignoreGlobs || config.ignore,
                severity: euOpts.severity || 'medium'
            });
            issues.push(...euAiActScan.issues);
        }
    }

    let enterpriseGuardrailScan = { scanned: 0, findings: 0, issues: [], patterns: [] };
    if (isRuleEnabled(config, 'enterprise-guardrail-patterns') && !benchmarkScanTarget) {
        const entOpts = getRuleOptions(config, 'enterprise-guardrail-patterns');
        enterpriseGuardrailScan = await scanEnterpriseGuardrailPatterns(ruleWalkRoot, {
            sourcePaths: entOpts.sourcePaths || config.sourceCodeScanPaths,
            productionPaths: entOpts.productionPaths || config.productionPaths,
            ignoreGlobs: entOpts.ignoreGlobs || config.ignore,
            severity: entOpts.severity || 'high',
            tokenCapSeverity: entOpts.tokenCapSeverity || 'high',
            extraLeakTokens: entOpts.extraLeakTokens || []
        });
        issues.push(...enterpriseGuardrailScan.issues);
    }

    let fileNamingScan = { scanned: 0, findings: 0, issues: [], patterns: [] };
    if (isRuleEnabled(config, 'file-naming-patterns') && !benchmarkScanTarget) {
        if (fullDirectoryScan && fullTreeHits) {
            fileNamingScan = {
                scanned: fullTreeContentScanned,
                findings: fullTreeHits.fileNaming || 0,
                issues: [],
                patterns: []
            };
        } else {
            const fnOpts = getRuleOptions(config, 'file-naming-patterns');
            fileNamingScan = await scanFileNamingPatterns(ruleWalkRoot, {
                sourcePaths: fnOpts.sourcePaths || config.sourceCodeScanPaths,
                ignoreGlobs: fnOpts.ignoreGlobs || config.ignore,
                severity: fnOpts.severity || 'medium'
            });
            issues.push(...fileNamingScan.issues);
        }
    }

    let structuralIntentScan = {
        scanned: 0,
        findings: 0,
        issues: [],
        available: false,
        enabled: false,
        engine: null
    };
    if (isIntelligenceEnabled(config)) {
        const intelOpts = getIntelligenceOptions(config);
        structuralIntentScan = await scanStructuralIntentPatterns(ruleWalkRoot, {
            sourcePaths: intelOpts.sourcePaths || config.sourceCodeScanPaths,
            productionPaths: config.productionPaths,
            ignoreGlobs: config.ignore,
            intelligence: intelOpts
        });
        const intentSeverity = intelOpts.severity || 'medium';
        const patternSeverity = intelOpts.patternSeverity && typeof intelOpts.patternSeverity === 'object'
            ? intelOpts.patternSeverity
            : {};
        for (const issue of structuralIntentScan.issues) {
            const pattern = issue.pattern || issue.metadata?.ruleId;
            issue.severity = patternSeverity[pattern] || issue.severity || intentSeverity;
            issue.severityBand = issue.severity;
        }
        issues.push(...structuralIntentScan.issues);
    }

    let jestBaseline = { checked: false, passed: true, issues: [], summary: null };
    if (isRuleEnabled(config, 'jest-baseline')) {
        const jestOpts = getRuleOptions(config, 'jest-baseline');
        jestBaseline = await checkJestBaseline(root, {
            baseline: config.baseline,
            runTests: jestOpts.runTests === true,
            testCommand: jestOpts.testCommand,
            timeoutMs: jestOpts.timeoutMs
        });
        issues.push(...jestBaseline.issues);
    }

    const { platformIssues, benchmarkCacheIssues } = partitionBenchmarkIssues(issues);
    const scoringIssues = platformIssues;

    const totalSize = uniqueFiles.reduce((sum, file) => sum + file.size, 0);
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
    const repositoryInventory = fullDirectoryScan
        ? fullDirectoryInventory
        : await inventoryPromise;
    const ruleScopedFilesAnalyzed = fullDirectoryScan && fullDirectoryStats
        ? fullDirectoryStats.filesAnalyzed
        : computeFilesAnalyzed(
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
        enterpriseGuardrailFilesScanned: enterpriseGuardrailScan.scanned,
        enterpriseGuardrailHits: enterpriseGuardrailScan.findings,
        fileNamingFilesScanned: fileNamingScan.scanned,
        fileNamingHits: fileNamingScan.findings,
        structuralIntentEnabled: structuralIntentScan.enabled === true,
        structuralIntentAvailable: structuralIntentScan.available === true,
        structuralIntentFilesScanned: structuralIntentScan.scanned,
        structuralIntentHits: structuralIntentScan.findings,
        structuralIntentEngine: structuralIntentScan.engine || null,
        structuralIntentSlmReviewCount: structuralIntentScan.slmReviewCount || 0,
        tokenBleedFilesScanned: tokenBleedScan.scanned,
        tokenBleedPatternHits: tokenBleedScan.findings,
        architectureDriftFilesScanned: architectureDriftScan.scanned,
        architectureDriftPatternHits: architectureDriftScan.findings,
        pythonAstFilesScanned: pythonAstScan.scanned,
        pythonAstPatternHits: pythonAstScan.findings,
        pythonAstScanOk: pythonAstScan.ok !== false,
        pythonAstScanError: pythonAstScan.ok === false ? pythonAstScan.error : undefined,
        javascriptAstFilesScanned: javascriptAstScan.scanned,
        javascriptAstPatternHits: javascriptAstScan.findings,
        javascriptAstScanOk: javascriptAstScan.ok !== false,
        javascriptAstScanError: javascriptAstScan.ok === false ? javascriptAstScan.error : undefined,
        jestExecutedDuringScan: jestBaseline.checked === true,
        consistencyAnchorCount: (config.consistencyAnchorSamples || []).length,
        fictionScope: consistency.scope || 'repository-json',
        fictionJsonFilesScanned: consistency.jsonFilesScanned ?? consistency.checked ?? 0,
        fictionSampleFilesScanned: consistency.samplesScanned ?? 0,
        ruleScopedFilesAnalyzed,
        repositoryFilesTotal,
        repositoryFoldersTotal,
        fullDirectoryScan,
        fullDirectoryStats: fullDirectoryScan && fullDirectoryStats ? fullDirectoryStats : null,
        benchmarkCacheIssuesExcluded: benchmarkCacheIssues.length,
        excludedPathsNote: benchmarkCacheIssues.length
            ? `${benchmarkCacheIssues.length} issue(s) from github-cache/ clones and .github-sync/ CLI mirror excluded from gate scores — scan clones with github-cache/.simplebeacon/config.json (profile: benchmark).`
            : null,
        limitations: [
            fullDirectoryScan && fullDirectoryStats
                ? formatFullTreeLimitation(fullDirectoryStats, root, fullTreeRoot, fullTreeSkipDirs)
                : repositoryFilesTotal != null
                    ? `Repository inventory: ${repositoryFilesTotal.toLocaleString()} files — gate rules checked ${ruleScopedFilesAnalyzed} (mock paths, credentials, server/ leaks).`
                    : `Gate rules checked ${ruleScopedFilesAnalyzed} files — mock paths, credentials, and production directories only.`,
            fullDirectoryScan && fullDirectoryStats?.truncated
                ? `Inventory truncated at ${fullDirectoryStats.maxFiles?.toLocaleString?.() ?? fullDirectoryStats.maxFiles} files — raise fullDirectoryScanMaxFiles in config for larger trees.`
                : null,
            'github-cache/ OSS benchmark clones and .github-sync/ CLI mirror paths are excluded from platform gate scoring (not your product code).',
            'Pattern matching on JSON samples and server/ production paths — not LLM semantic review.',
            consistency.scope === 'repository-json'
                ? `Fiction/KPI rules scan repository JSON (${consistency.jsonFilesScanned ?? '—'}) plus source code (${sourceFictionScan.scanned ?? 0} files in ${(config.sourceCodeScanPaths || []).join(', ') || 'configured paths'}).`
                : 'Fiction/KPI rules scan configured sample JSON paths only.',
            jestBaseline.checked
                ? 'Jest was executed during this scan.'
                : 'Jest was not executed during this scan — use npm test or simplebeacon:full for live test verification.',
            config.profile === 'cascade'
                ? 'Cascade profile scans server/ for production leaks — src/ stub API is excluded by design.'
                : null,
            config.profile === 'enterprise'
                ? 'Enterprise profile: credentials + data-leak/token-cap guardrails (SB-ENT-001/002) — no fiction, EU AI Act, or opt-in AST rules.'
                : null,
            structuralIntentScan.enabled
                ? `Structural intent (Tier 1): scanned ${structuralIntentScan.scanned} source files via ${structuralIntentScan.engine || 'structural'} engine — local only, no LLM API.`
                : null
        ].filter(Boolean)
    };

    const draftReport = {
        type: 'simplebeacon-report',
        reportVersion: 2,
        generatedAt: new Date().toISOString(),
        generatedBy: 'Simplebeacon',
        projectRoot: scanRoot,
        scanTargetRoot: fullDirectoryScan ? fullTreeRoot : scanRoot,
        platformRoot: platformRoot !== scanRoot ? platformRoot : undefined,
        configPath: config.configPath,
        scanPaths,
        repositoryInventory,
        mockSampleFiles: uniqueFiles.filter((f) =>
            /(?:web\/data|data\/mock|data-central|fixtures?|sample)/i.test(f.relativePath)
            || /-sample\.json$/i.test(f.name)
        ).length,
        totalFiles: uniqueFiles.length,
        ruleScopedFilesAnalyzed,
        repositoryFilesTotal,
        repositoryFoldersTotal,
        filesAnalyzed: repositoryFilesTotal ?? ruleScopedFilesAnalyzed,
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
        enterpriseGuardrailScanned: enterpriseGuardrailScan.scanned,
        enterpriseGuardrailFindings: enterpriseGuardrailScan.findings,
        fileNamingScanned: fileNamingScan.scanned,
        fileNamingFindings: fileNamingScan.findings,
        structuralIntentScanned: structuralIntentScan.scanned,
        structuralIntentFindings: structuralIntentScan.findings,
        structuralIntentEnabled: structuralIntentScan.enabled === true,
        structuralIntentEngine: structuralIntentScan.engine || null,
        structuralIntentSlmReviewCount: structuralIntentScan.slmReviewCount || 0,
        structuralIntentSlmReviews: structuralIntentScan.slmReviews || [],
        jestBaselineChecked: jestBaseline.checked,
        jestBaselinePassed: jestBaseline.passed,
        jestSummary: jestBaseline.summary || null,
        severityCounts,
        mockDataCategories,
        detectedIssues: groupIssues(scoringIssues).slice(0, 12),
        rawIssues,
        benchmarkCacheIssues,
        sampleFiles: uniqueFiles.map((f) => f.name),
        scanScope,
        gate: evaluateGate({ rawIssues: scoringIssues }, config.gate || {})
    };

    const gateSummary = draftReport.gate;
    draftReport.gate = {
        pass: gateSummary.pass,
        failOn: gateSummary.failOn,
        warnOn: gateSummary.warnOn,
        blockingCount: (gateSummary.blockingIssues || []).reduce((sum, i) => sum + (i.count || 1), 0),
        warningCount: (gateSummary.warningIssues || []).reduce((sum, i) => sum + (i.count || 1), 0)
    };

    return normalizePlatformScanReport(draftReport, { gateConfig: config.gate });
    } finally {
        progress.clear();
    }
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
    computeFilesAnalyzed
};
