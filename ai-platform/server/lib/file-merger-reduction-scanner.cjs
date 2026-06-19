/**
 * Phase 1 file merger & reduction scanner — filesystem analysis only.
 * Reuses repository-audit scan paths; no GGUF embeddings or auto-merge.
 */

const fs = require('fs');
const path = require('path');
const constants = require('../config/constants.cjs');
const {
    hashFileContent,
    findDuplicateContentGroups
} = require('./mock-data-schema-validator.cjs');
const { resolveMockDataScanPaths } = require('./central-data-config.cjs');
const { formatBytes } = require('./mock-data-scanner.cjs');
const { SAMPLE_FILE_OVERRIDES } = require('./sample-path-resolver.cjs');
const {
    buildAdvancedAnalysis,
    buildFuzzyMergeCandidates,
    DEFAULT_FUZZY_THRESHOLD
} = require('./fuzzy-content-matcher.cjs');
const { isDistinctCanonicalRoadmapPair } = require('./canonical-roadmap-files.cjs');
const { consolidationCandidateTouchesExcluded, countIntentionalPairExclusions, countRepositoryInventory, isConsolidationExcludedPair, isExternalBenchmarkCachePath, resolvePlatformRoot } = require('./simplebeacon-proxy.cjs');


const DEFAULT_EXTRA_PATHS = ['data/roadmap'];
const REPO_SKIP_DIRS = new Set([
    'node_modules', '.git', 'uploads', 'coverage', 'archive', 'dist', 'build',
    '.next', '.cache', 'github-cache', 'deliverables', 'data-central',
    'java-ai-vulnerable', 'security-reports', '.simplebeacon', '__pycache__', '.venv', 'htmlcov',
    '.github-sync'
]);

/**
 * Is excluded consolidation path.
 * @param {string} filePath
 * @returns {any}
 */
function isExcludedConsolidationPath(filePath) {
    const rel = normalizeRelativePath(filePath);
    if (isExternalBenchmarkCachePath(rel)) return true;
    if (rel.startsWith('node_modules/') || rel.includes('/node_modules/')) return true;
    if (rel.startsWith('deliverables/') || rel.includes('/deliverables/')) return true;
    if (rel.startsWith('github-cache/') || rel.includes('/github-cache/')) return true;
    if (rel.startsWith('.github-sync/') || rel.includes('/.github-sync/')) return true;
    // Root npm publish tree mirrors ai-platform/packages/simplebeacon-cli (intentional).
    if (/^packages\/simplebeacon-cli\//.test(rel) && !rel.startsWith('ai-platform/')) return true;
    return false;
}

/**
 * Is intentional mirror duplicate group.
 * @param {any} group
 * @returns {any}
 */
function isIntentionalMirrorDuplicateGroup(group) {
    if (!group || group.length < 2) return false;
    const paths = group.map((entry) => entry.relativePath || entry.path);
    for (let i = 0; i < paths.length; i++) {
        for (let j = i + 1; j < paths.length; j++) {
            if (isConsolidationExcludedPair(paths[i], paths[j])) return true;
        }
    }
    return false;
}

/**
 * Candidate touches excluded path.
 * @param {string} candidate
 * @returns {any}
 */
function candidateTouchesExcludedPath(candidate) {
    if (consolidationCandidateTouchesExcluded(candidate)) return true;
/**
 * Paths.
 * @param {string} candidate?.files || []
 * @returns {any}
 */
    const paths = (candidate?.files || []).map((file) => file.path || file.relativePath || file.name);
    return paths.some(isExcludedConsolidationPath);
}

/**
 * Filter advanced analysis.
 * @param {Array} analysis
 * @returns {any}
 */
function filterAdvancedAnalysis(analysis) {
    if (!analysis) return analysis;
    const fuzzyPairs = (analysis.fuzzyNearDuplicates?.pairs || [])
        .filter((pair) => !isExcludedConsolidationPath(pair.fileA) && !isExcludedConsolidationPath(pair.fileB));
    const patternGroups = (analysis.patternConsolidation?.recommendations || [])
        .filter((group) => !(group.files || []).every((file) => isExcludedConsolidationPath(file.path)));
    return {
        ...analysis,
        fuzzyNearDuplicates: {
            ...analysis.fuzzyNearDuplicates,
            pairsFound: fuzzyPairs.length,
            pairs: fuzzyPairs
        },
        patternConsolidation: {
            ...analysis.patternConsolidation,
            groupsFound: patternGroups.length,
            recommendations: patternGroups
        }
    };
}
const SAMPLE_WALK_MAX_DEPTH = 6;
const REPO_WALK_MAX_DEPTH = 24;
const JSON_MAX_BYTES = 512000;
const OVERSIZED_THRESHOLD_BYTES = 256000;
const OVERSIZED_SKIP_PATH_SEGMENTS = [
    '/.venv/',
    '/site-packages/',
    '/htmlcov/',
    '/__pycache__/',
    '/blobs/',
    '.simplebeacon/',
    'web/api/mock-backend.js',
    'web/scripts/dashboard-scripts.js',
    'web/simplebeacon-dashboard/js/views/'
];
const OVERSIZED_SKIP_FILENAMES = new Set([
    'package-lock.json'
]);
const OVERSIZED_ELIGIBLE_EXTENSIONS = new Set([
    '.md', '.txt', '.json', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.html', '.css', '.scss', '.yaml', '.yml'
]);
const STRUCTURE_SIMILARITY_THRESHOLD = 0.92;
const MAX_STRUCTURE_PAIRS = 12;
const SIGNIN_SITE_CANONICAL_DUPE_PAIRS = [
    ['ai-platform/public/trust-verification.json', 'deployments/signin-site/trust-verification.json'],
    ['coming-soon/stripe-audit-product.ids.json', 'deployments/signin-site/stripe-audit-product.ids.json']
];

/**
 * Normalize relative path.
 * @param {string} relativePath
 * @returns {any}
 */
function normalizeRelativePath(relativePath) {
    return String(relativePath || '').replace(/\\/g, '/');
}

/**
 * Is known sample alias pair.
 * @param {string} fileA
 * @param {string} fileB
 * @returns {any}
 */
function isKnownSampleAliasPair(fileA, fileB) {
    const nameA = fileA.name;
    const nameB = fileB.name;
    const canonicalA = SAMPLE_FILE_OVERRIDES[nameA];
    const canonicalB = SAMPLE_FILE_OVERRIDES[nameB];
    if (canonicalA && canonicalB && canonicalA === canonicalB) return true;

    const relA = normalizeRelativePath(fileA.relativePath || fileA.path);
    const relB = normalizeRelativePath(fileB.relativePath || fileB.path);
    if (Object.values(SAMPLE_FILE_OVERRIDES).includes(relA)
        && Object.values(SAMPLE_FILE_OVERRIDES).includes(relB)
        && relA === relB) {
        return true;
    }
    return false;
}

/**
 * Is dashboard sample.
 * @param {string} name
 * @returns {any}
 */
function isDashboardSample(name) {
    return /-sample\.json$/i.test(name);
}

/**
 * Is eligible structure pair.
 * @param {string} fileA
 * @param {string} fileB
 * @returns {any}
 */
function isEligibleStructurePair(fileA, fileB) {
    if (fileA.path === fileB.path) return false;
    if (isDashboardSample(fileA.name) && isDashboardSample(fileB.name)) return false;
    const dirA = path.dirname(fileA.relativePath || fileA.path);
    const dirB = path.dirname(fileB.relativePath || fileB.path);
    return dirA !== dirB || fileA.name === fileB.name;
}

/**
 * Is known canonical link pair.
 * @param {string} pathA
 * @param {string} pathB
 * @returns {any}
 */
function isKnownCanonicalLinkPair(pathA, pathB) {
    const sorted = [normalizeRelativePath(pathA), normalizeRelativePath(pathB)].sort();
    return SIGNIN_SITE_CANONICAL_DUPE_PAIRS.some((pair) => {
        const pairSorted = [...pair].sort();
        return sorted[0] === pairSorted[0] && sorted[1] === pairSorted[1];
    });
}

/**
 * Shares filesystem link.
 * @param {string} pathA
 * @param {string} pathB
 * @returns {any}
 */
async function sharesFilesystemLink(pathA, pathB) {
    try {
        const statA = await fs.promises.stat(pathA);
        const statB = await fs.promises.stat(pathB);
        return statA.ino === statB.ino && statA.dev === statB.dev;
    } catch {
        return false;
    }
}

/**
 * Filter resolved duplicate groups.
 * @param {Array} groups
 * @returns {any}
 */
async function filterResolvedDuplicateGroups(groups) {
    const kept = [];
    for (const group of groups) {
        if (isIntentionalMirrorDuplicateGroup(group)) continue;
        if (group.length === 2) {
            const relA = group[0].relativePath || group[0].path;
            const relB = group[1].relativePath || group[1].path;
            if (isKnownCanonicalLinkPair(relA, relB)) continue;
            if (isConsolidationExcludedPair(relA, relB)) continue;
            if (await sharesFilesystemLink(group[0].path, group[1].path)) continue;
        }
        kept.push(group);
    }
    return kept;
}

/**
 * Walk files.
 * @param {string} dir
 * @param {Array} results
 * @param {Object} options
 * @returns {any}
 */
async function walkFiles(dir, results, options = {}) {
    const {
        depth = 0,
        maxDepth = SAMPLE_WALK_MAX_DEPTH,
        skipDirs = REPO_SKIP_DIRS,
        baseDir = null
    } = options;
    if (depth > maxDepth) return results;
    let entries;
    try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
        return results;
    }

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (skipDirs.has(entry.name)) continue;
            await walkFiles(fullPath, results, { ...options, depth: depth + 1 });
            continue;
        }
        if (!entry.isFile()) continue;
        try {
            const stat = await fs.promises.stat(fullPath);
            results.push({
                path: fullPath,
                name: entry.name,
                ext: path.extname(entry.name).toLowerCase(),
                size: stat.size,
                relativePath: baseDir
                    ? path.relative(baseDir, fullPath).replace(/\\/g, '/')
                    : fullPath
            });
        } catch {
            /* skip */
        }
    }
    return results;
}

/**
 * Collect sample data files.
 * @param {string} baseDir
 * @param {Array} extraPaths
 * @returns {any}
 */
async function collectSampleDataFiles(baseDir, extraPaths = []) {
    const scanPaths = resolveMockDataScanPaths(baseDir, [...DEFAULT_EXTRA_PATHS, ...extraPaths]);
    const files = [];
    for (const scanPath of scanPaths) {
        if (fs.existsSync(scanPath)) {
            await walkFiles(scanPath, files, {
                maxDepth: SAMPLE_WALK_MAX_DEPTH,
                skipDirs: REPO_SKIP_DIRS,
                baseDir
            });
        }
    }
    return { scanPaths, files };
}

/**
 * Collect repository files.
 * @param {string} baseDir
 * @returns {any}
 */
async function collectRepositoryFiles(baseDir) {
    const files = [];
    if (fs.existsSync(baseDir)) {
        await walkFiles(baseDir, files, {
            maxDepth: REPO_WALK_MAX_DEPTH,
            skipDirs: REPO_SKIP_DIRS,
            baseDir
        });
    }
    return files;
}

/**
 * Extract json structure.
 * @param {any} node
 * @param {any} depth
 * @returns {any}
 */
function extractJsonStructure(node, depth = 0) {
    if (depth > 6 || node == null) return typeof node;
    if (Array.isArray(node)) {
        return node.length ? ['array', extractJsonStructure(node[0], depth + 1)] : ['array', 'empty'];
    }
    if (typeof node === 'object') {
        return Object.keys(node).sort().map((key) => [key, extractJsonStructure(node[key], depth + 1)]);
    }
    return typeof node;
}

/**
 * Structure signature.
 * @param {string} structure
 * @returns {any}
 */
function structureSignature(structure) {
    return JSON.stringify(structure);
}

/**
 * Compare structure signatures.
 * @param {any} sig1
 * @param {any} sig2
 * @returns {any}
 */
function compareStructureSignatures(sig1, sig2) {
    if (sig1 === sig2) return 1;
    try {
        const keys1 = new Set(JSON.stringify(structureKeys(sig1)));
        const keys2 = new Set(JSON.stringify(structureKeys(sig2)));
        const intersection = [...keys1].filter((k) => keys2.has(k));
        const union = new Set([...keys1, ...keys2]);
        return union.size ? intersection.length / union.size : 0;
    } catch {
        return 0;
    }
}

/**
 * Structure keys.
 * @param {string} structure
 * @param {any} prefix
 * @returns {any}
 */
function structureKeys(structure, prefix = '') {
    if (!Array.isArray(structure)) return [prefix || 'leaf'];
    if (structure[0] === 'array') {
        return structureKeys(structure[1], prefix ? `${prefix}[]` : '[]');
    }
    const keys = [];
    for (const entry of structure) {
        if (!Array.isArray(entry) || entry.length < 2) continue;
        const key = prefix ? `${prefix}.${entry[0]}` : entry[0];
        keys.push(key);
        keys.push(...structureKeys(entry[1], key));
    }
    return keys;
}

/**
 * Load json structure.
 * @param {string} file
 * @returns {any}
 */
async function loadJsonStructure(file) {
    if (file.ext !== '.json' || file.size > JSON_MAX_BYTES) return null;
    try {
        const raw = await fs.promises.readFile(file.path, 'utf8');
        const payload = JSON.parse(raw);
        return {
            raw,
            contentHash: hashFileContent(raw),
            structure: extractJsonStructure(payload),
            signature: structureSignature(extractJsonStructure(payload))
        };
    } catch {
        return null;
    }
}

/**
 * Build exact duplicate candidates.
 * @param {Array} groups
 * @returns {any}
 */
function buildExactDuplicateCandidates(groups) {
    return groups.map((group, index) => {
        const savingsBytes = group.slice(1).reduce((sum, entry) => sum + (entry.size || 0), 0);
        return {
            id: `exact-dup-${index + 1}`,
            mergeType: 'exact-duplicate',
            similarity: 1,
            confidence: 1,
            files: group.map((entry) => ({
                path: entry.relativePath || entry.name,
                name: entry.name,
                sizeBytes: entry.size,
                sizeLabel: formatBytes(entry.size)
            })),
            savingsBytes,
            savingsLabel: formatBytes(savingsBytes),
            risk: 'low',
            effort: 'low',
            recommendation: 'Keep one canonical file; remove or symlink duplicates after review',
            mergeStrategy: 'keep-one-delete-others'
        };
    });
}

/**
 * Build oversized opportunities.
 * @param {Array} files
 * @returns {any}
 */
function buildOversizedOpportunities(files) {
    return files
        .filter((file) => {
            if (file.size < OVERSIZED_THRESHOLD_BYTES) return false;
            const rel = normalizeRelativePath(file.relativePath || file.path).toLowerCase();
            if (OVERSIZED_SKIP_PATH_SEGMENTS.some((segment) => rel.includes(segment))) return false;
            if (OVERSIZED_SKIP_FILENAMES.has(file.name.toLowerCase())) return false;
            if (file.name.toLowerCase().endsWith('.backup')) return false;
            if (!OVERSIZED_ELIGIBLE_EXTENSIONS.has(file.ext)) return false;
            return true;
        })
        .map((file, index) => ({
            id: `oversized-${index + 1}`,
            type: 'format-optimization',
            method: 'archive-or-trim',
            files: [{
                path: file.relativePath || file.name,
                name: file.name,
                sizeBytes: file.size,
                sizeLabel: formatBytes(file.size)
            }],
            currentSizeBytes: file.size,
            reducedSizeBytes: Math.round(file.size * 0.15),
            savingsBytes: Math.round(file.size * 0.85),
            savingsLabel: formatBytes(Math.round(file.size * 0.85)),
            confidence: 0.95,
            effort: 'medium',
            risk: 'medium',
            description: `${file.name} exceeds ${formatBytes(OVERSIZED_THRESHOLD_BYTES)} — trim or archive for dashboard load`
        }));
}

/**
 * Find structure similar pairs.
 * @param {Array} jsonFiles
 * @returns {any}
 */
async function findStructureSimilarPairs(jsonFiles) {
    const loaded = [];
    for (const file of jsonFiles) {
        const parsed = await loadJsonStructure(file);
        if (parsed) {
            loaded.push({ file, ...parsed });
        }
    }

    const pairs = [];
    for (let i = 0; i < loaded.length; i++) {
        for (let j = i + 1; j < loaded.length; j++) {
            const fileA = loaded[i].file;
            const fileB = loaded[j].file;
            if (!isEligibleStructurePair(fileA, fileB)) continue;
            if (isKnownSampleAliasPair(fileA, fileB)) continue;
            if (isDistinctCanonicalRoadmapPair(fileA, fileB)) continue;
            if (loaded[i].contentHash && loaded[i].contentHash === loaded[j].contentHash) continue;
            if (loaded[i].signature === loaded[j].signature) continue;
            const similarity = compareStructureSignatures(loaded[i].structure, loaded[j].structure);
            if (similarity >= STRUCTURE_SIMILARITY_THRESHOLD) {
                pairs.push({
                    id: `struct-${pairs.length + 1}`,
                    mergeType: 'structure-based',
                    similarity: Math.round(similarity * 1000) / constants.MS_PER_SECOND,
                    confidence: similarity,
                    files: [loaded[i].file, loaded[j].file].map((file) => ({
                        path: file.relativePath || file.name,
                        name: file.name,
                        sizeBytes: file.size,
                        sizeLabel: formatBytes(file.size)
                    })),
                    savingsBytes: Math.min(loaded[i].file.size, loaded[j].file.size),
                    savingsLabel: formatBytes(Math.min(loaded[i].file.size, loaded[j].file.size)),
                    risk: 'medium',
                    effort: 'medium',
                    recommendation: 'Review shared schema fields — consider consolidating into one sample',
                    mergeStrategy: 'manual-merge-review'
                });
            }
        }
    }

    return pairs
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, MAX_STRUCTURE_PAIRS);
}

/**
 * Build scan scope.
 * @param {any} scope
 * @param {Array} scanPaths
 * @param {Array} counts
 * @returns {any}
 */
function buildScanScope(scope, scanPaths, counts) {
    const relativePaths = scanPaths.map((p) => normalizeRelativePath(p));
    const isRepository = scope === 'repository';
    return {
        mode: isRepository ? 'repository-consolidation' : 'sample-data-consolidation',
        description: isRepository
            ? `Full repository inventory (${counts.repositoryInventoryProfile || 'audit'} profile) plus JSON duplicate detection on audit-scoped paths — skips node_modules, .git, coverage, archive for merge logic.`
            : 'Duplicate and structure analysis on configured mock/sample JSON paths only.',
        sampleDataPaths: relativePaths,
        sampleDataFilesAnalyzed: counts.sampleDataFiles,
        jsonFilesAnalyzed: counts.jsonFiles,
        repositoryFilesAudited: counts.repositoryFilesAudited ?? null,
        repositoryInventoryProfile: counts.repositoryInventoryProfile || 'audit',
        repositoryInventoryIncluded: Boolean(counts.repositoryFiles != null),
        repositoryFilesTotal: counts.repositoryFiles ?? null,
        repositoryFoldersTotal: counts.repositoryFolders ?? null,
        limitations: isRepository
            ? [
                `repositoryFilesTotal uses ${counts.repositoryInventoryProfile || 'audit'} inventory (${counts.repositoryFiles?.toLocaleString?.() ?? counts.repositoryFiles ?? '—'} files).`,
                `Merge/dedup logic walked ${counts.repositoryFilesAudited?.toLocaleString?.() ?? counts.repositoryFilesAudited ?? '—'} audit-scoped files and hashed ${counts.jsonFiles ?? '—'} JSON files.`,
                'Structure similarity pairs are limited to configured sample paths.',
                'node_modules, .git, coverage, archive, dist, build, github-cache/, and deliverables/ are excluded from merge walks.',
                counts.benchmarkCacheCandidatesExcluded
                    ? `${counts.benchmarkCacheCandidatesExcluded} benchmark-clone candidate(s) excluded from platform consolidation scores.`
                    : null
            ].filter(Boolean)
            : [
                'Sample-path mode only — use scope=repository for full tree inventory.',
                'Structure similarity does not scan application source code.'
            ]
    };
}

/**
 * Build hash entries.
 * @param {Array} jsonFiles
 * @returns {any}
 */
async function buildHashEntries(jsonFiles) {
    const hashEntries = [];
    for (const file of jsonFiles) {
        if (file.ext !== '.json' || file.size > JSON_MAX_BYTES) continue;
        try {
            const raw = await fs.promises.readFile(file.path, 'utf8');
            JSON.parse(raw);
            hashEntries.push({
                name: file.name,
                path: file.path,
                relativePath: file.relativePath,
                size: file.size,
                contentHash: hashFileContent(raw)
            });
        } catch {
            /* skip invalid json */
        }
    }
    return hashEntries;
}

/**
 * Scan file merger reduction.
 * @param {string} baseDir
 * @param {Object} options
 * @returns {any}
 */
async function scanFileMergerReduction(baseDir, options = {}) {
    const resolvedBase = path.resolve(baseDir);
    const scope = options.scope === 'sample-data-only' ? 'sample-data-only' : 'repository';
    const includeRepositoryInventory = options.includeRepositoryInventory !== false;
    const { platformRoot } = resolvePlatformRoot(resolvedBase);
    const sampleBase = options.sampleBase || platformRoot || resolvedBase;

    const { scanPaths, files: sampleFiles } = await collectSampleDataFiles(
        sampleBase,
        options.extraPaths || []
    );
    const repositoryFiles = scope === 'repository'
        ? await collectRepositoryFiles(resolvedBase)
        : sampleFiles;

    const inventoryRoot = platformRoot || resolvedBase;
    const repositoryInventory = includeRepositoryInventory
        ? await countRepositoryInventory(inventoryRoot, {
            profile: options.inventoryProfile || 'universal'
        })
        : null;
    const repositoryFilesAudited = repositoryFiles.length;

    const jsonFiles = scope === 'repository'
        ? repositoryFiles.filter((file) => file.ext === '.json')
        : sampleFiles.filter((file) => file.ext === '.json');

    const hashEntries = await buildHashEntries(jsonFiles);
    const totalSizeBytes = repositoryFiles.reduce((sum, file) => sum + file.size, 0);
    const sampleDataFilesAnalyzed = sampleFiles.length;
    const jsonFilesAnalyzed = hashEntries.length;
    const repositoryFilesTotal = repositoryInventory?.totalFiles ?? repositoryFiles.length;
    const filesAnalyzed = scope === 'repository' ? repositoryFilesTotal : sampleDataFilesAnalyzed;

    const duplicateGroups = await filterResolvedDuplicateGroups(
        findDuplicateContentGroups(hashEntries).map((group) =>
            group.map((entry) => {
                const file = repositoryFiles.find((f) => f.path === entry.path)
                    || sampleFiles.find((f) => f.path === entry.path)
                    || entry;
                return { ...entry, size: file.size, relativePath: file.relativePath };
            })
        )
    );

    const fuzzyScopeFiles = (scope === 'repository' ? repositoryFiles : sampleFiles)
        .filter((file) => !isExcludedConsolidationPath(file.relativePath || file.path));
    const rawAdvancedAnalysis = buildAdvancedAnalysis(fuzzyScopeFiles, {
        threshold: options.fuzzyThreshold ?? DEFAULT_FUZZY_THRESHOLD
    });
    const advancedAnalysis = filterAdvancedAnalysis(rawAdvancedAnalysis);
    const fuzzyCandidates = buildFuzzyMergeCandidates(
        advancedAnalysis.fuzzyNearDuplicates.pairs,
        formatBytes
    );

    const platformDuplicateGroups = duplicateGroups.filter(
        (group) => !group.every((entry) => isExcludedConsolidationPath(entry.relativePath || entry.path))
    );
    const benchmarkCacheCandidatesExcluded = (duplicateGroups.length - platformDuplicateGroups.length)
        + ((rawAdvancedAnalysis.fuzzyNearDuplicates?.pairs?.length || 0)
            - (advancedAnalysis.fuzzyNearDuplicates?.pairs?.length || 0))
        + ((rawAdvancedAnalysis.patternConsolidation?.recommendations?.length || 0)
            - (advancedAnalysis.patternConsolidation?.recommendations?.length || 0));

    const exactMergeCandidates = buildExactDuplicateCandidates(platformDuplicateGroups);
    const intentionalPairExclusions = countIntentionalPairExclusions([
        ...exactMergeCandidates,
        ...fuzzyCandidates
    ]);
    const mergeCandidates = [
        ...exactMergeCandidates,
        ...await findStructureSimilarPairs(sampleFiles.filter((f) => f.ext === '.json')),
        ...fuzzyCandidates
    ].filter((candidate) => !candidateTouchesExcludedPath(candidate));

    const reductionOpportunities = [
        ...buildOversizedOpportunities(fuzzyScopeFiles),
        ...platformDuplicateGroups.map((group, index) => ({
            id: `dedupe-${index + 1}`,
            type: 'duplicate-removal',
            method: 'deduplicate',
            files: group.map((entry) => ({
                path: entry.relativePath || entry.name,
                name: entry.name,
                sizeBytes: entry.size,
                sizeLabel: formatBytes(entry.size)
            })),
            currentSizeBytes: group.reduce((sum, e) => sum + e.size, 0),
            reducedSizeBytes: group[0]?.size || 0,
            savingsBytes: group.slice(1).reduce((sum, e) => sum + e.size, 0),
            savingsLabel: formatBytes(group.slice(1).reduce((sum, e) => sum + e.size, 0)),
            confidence: 1,
            effort: 'low',
            risk: 'low',
            description: `${group.length} files share identical JSON content`
        }))
    ].filter((opportunity) => !(opportunity.files || []).every((file) => isExcludedConsolidationPath(file.path)));

    const potentialSavingsBytes = reductionOpportunities.reduce(
        (sum, opp) => sum + (opp.savingsBytes || 0),
        0
    );

    const relativeScanPaths = scanPaths.map((p) => {
        const fromUserRoot = path.relative(resolvedBase, p).replace(/\\/g, '/');
        if (fromUserRoot && !fromUserRoot.startsWith('..')) return fromUserRoot;
        return path.relative(sampleBase, p).replace(/\\/g, '/') || p;
    });

    return {
        type: 'file-merger-reduction-report',
        reportVersion: 2,
        title: 'File Merger & Reduction Scan (Measured Baseline)',
        dataSource: 'repository-audit',
        generatedAt: new Date().toISOString(),
        generatedBy: 'file-merger-reduction-scanner',
        scanEngine: 'file-merger-reduction-scanner',
        inferenceMode: advancedAnalysis.semanticHints?.enabled
            ? 'filesystem + fuzzy-match (LLAMA_CPP_BIN set — embeddings not run in scan)'
            : 'filesystem + fuzzy-match',
        advancedAnalysis,
        projectRoot: resolvedBase,
        platformRoot: platformRoot !== resolvedBase ? platformRoot : undefined,
        scanPaths: relativeScanPaths,
        scanScope: buildScanScope(scope, relativeScanPaths, {
            sampleDataFiles: sampleDataFilesAnalyzed,
            jsonFiles: jsonFilesAnalyzed,
            repositoryFiles: repositoryFilesTotal,
            repositoryFolders: repositoryInventory?.totalFolders ?? null,
            repositoryFilesAudited,
            repositoryInventoryProfile: repositoryInventory?.profile || 'explorer',
            benchmarkCacheCandidatesExcluded
        }),
        repositoryInventory: repositoryInventory ? {
            projectRoot: path.relative(resolvedBase, repositoryInventory.projectRoot).replace(/\\/g, '/')
                || repositoryInventory.projectRoot,
            totalFiles: repositoryInventory.totalFiles,
            totalFolders: repositoryInventory.totalFolders,
            profile: repositoryInventory.profile
        } : null,
        summary: {
            totalFindings: mergeCandidates.length + reductionOpportunities.length,
            filesAnalyzed,
            sampleDataFilesAnalyzed,
            jsonFilesAnalyzed,
            repositoryFilesTotal,
            repositoryFilesAudited,
            repositoryFoldersTotal: repositoryInventory?.totalFolders ?? null,
            totalSizeBytes,
            totalSizeLabel: formatBytes(totalSizeBytes),
            mergeCandidates: mergeCandidates.length,
            reductionOpportunities: reductionOpportunities.length,
            potentialSavingsBytes,
            potentialSavingsLabel: formatBytes(potentialSavingsBytes),
            exactDuplicateGroups: platformDuplicateGroups.length,
            benchmarkCacheCandidatesExcluded,
            ...(intentionalPairExclusions.monorepoAliasPairsExcluded > 0
                ? {
                    monorepoAliasPairsExcluded: intentionalPairExclusions.monorepoAliasPairsExcluded,
                    intentionalPairsExcluded: intentionalPairExclusions.intentionalPairsExcluded
                }
                : {}),
            structureSimilarPairs: mergeCandidates.filter((c) => c.mergeType === 'structure-based').length,
            fuzzyNearDuplicatePairs: advancedAnalysis.fuzzyNearDuplicates.pairsFound,
            patternConsolidationGroups: advancedAnalysis.patternConsolidation.groupsFound,
            oversizedFiles: reductionOpportunities.filter((o) => o.type === 'format-optimization').length
        },
        mergeCandidates,
        reductionOpportunities,
        recommendations: [
            ...buildRecommendations(mergeCandidates, reductionOpportunities),
            ...buildPatternRecommendations(advancedAnalysis)
                .filter((group) => !(group.files || []).every((file) => isExcludedConsolidationPath(file.path)))
                .map((group) => ({
                priority: 'medium',
                action: 'pattern-consolidation',
                files: group.files.map((f) => f.path),
                savings: formatBytes(group.totalSizeBytes),
                effort: group.effort,
                risk: group.risk,
                description: group.recommendation
            }))
        ],
        rejectedFiction: {
            warning: 'Enterprise design claims not implemented in v0.8-beta',
            claims: [
                '15-30% storage savings guarantee',
                '40-60% faster file processing',
                'GGUF embedding semantic similarity',
                'Auto-merge executor with rollback',
                '1,559 files/s throughput'
            ]
        },
        implementationPhases: [
            {
                phase: 'Phase 1 — Core scanner (done)',
                status: 'complete',
                items: ['Exact duplicate detection', 'JSON structure similarity', 'Oversized file report']
            },
            {
                phase: 'Phase 2 — Advanced analysis',
                status: 'complete',
                items: [
                    `Fuzzy content match (threshold ${Math.round((options.fuzzyThreshold ?? DEFAULT_FUZZY_THRESHOLD) * 100)}%)`,
                    'Pattern consolidation recommendations',
                    'Optional GGUF hints when LLAMA_CPP_BIN set'
                ]
            },
            {
                phase: 'Phase 3 — Safe merge preview',
                status: 'complete',
                items: ['Merge plan preview API', 'Confirmation + quarantine (no auto-delete)', 'Audit log + rollback']
            }
        ]
    };
}

/**
 * Build recommendations.
 * @param {Array} mergeCandidates
 * @param {Array} reductionOpportunities
 * @returns {any}
 */
function buildRecommendations(mergeCandidates, reductionOpportunities) {
    const items = [];

    for (const candidate of mergeCandidates.slice(0, 5)) {
        items.push({
            priority: candidate.risk === 'low' ? 'high' : 'medium',
            action: candidate.mergeStrategy,
            files: candidate.files.map((f) => f.path),
            savings: candidate.savingsLabel,
            effort: candidate.effort,
            risk: candidate.risk,
            description: candidate.recommendation
        });
    }

    for (const opp of reductionOpportunities.filter((o) => o.type === 'format-optimization').slice(0, 3)) {
        items.push({
            priority: 'medium',
            action: opp.method,
            files: opp.files.map((f) => f.path),
            savings: opp.savingsLabel,
            effort: opp.effort,
            risk: opp.risk,
            description: opp.description
        });
    }

    return items;
}

/**
 * Build pattern recommendations.
 * @param {Array} advancedAnalysis
 * @returns {any}
 */
function buildPatternRecommendations(advancedAnalysis) {
    return (advancedAnalysis?.patternConsolidation?.recommendations || []).slice(0, 5);
}

/**
 * Build consolidation conclusion.
 * @param {number} report
 * @returns {any}
 */
function buildConsolidationConclusion(report) {
    if (!report?.summary) {
        return 'No consolidation scan available.';
    }
    const s = report.summary;
    const candidates = (s.mergeCandidates || 0) + (s.reductionOpportunities || 0);
    const repoFiles = s.repositoryFilesTotal ?? report.repositoryInventory?.totalFiles;
    const jsonScanned = s.jsonFilesAnalyzed;
    const duplicateGroups = s.exactDuplicateGroups ?? 0;
    const repoNote = repoFiles != null
        ? ` Repository inventory: ${Number(repoFiles).toLocaleString('en-US')} files${jsonScanned != null ? `; ${Number(jsonScanned).toLocaleString('en-US')} JSON hashed for duplicates (${Number(duplicateGroups).toLocaleString('en-US')} duplicate groups)` : ''}.`
        : (jsonScanned != null ? ` ${Number(jsonScanned).toLocaleString('en-US')} JSON files hashed for duplicates (${Number(duplicateGroups).toLocaleString('en-US')} duplicate groups).` : '');
    if (!candidates) {
        return `No merge or reduction candidates — ${s.sampleDataFilesAnalyzed ?? s.filesAnalyzed ?? 0} sample JSON under configured paths (${s.totalSizeLabel || '—'}).${repoNote} Structure similarity is limited to sample paths; duplicate detection covers all repo JSON.`;
    }
    return `${candidates} merge/reduction candidate(s) — ${s.sampleDataFilesAnalyzed ?? s.filesAnalyzed ?? 0} sample JSON, ${jsonScanned != null ? `${Number(jsonScanned).toLocaleString('en-US')} repo JSON scanned` : 'repo JSON scanned'}.${repoNote} Potential savings: ${s.potentialSavingsLabel || '0B'}.`;
}

module.exports = {
    scanFileMergerReduction,
    collectSampleDataFiles,
    collectRepositoryFiles,
    buildConsolidationConclusion,
    OVERSIZED_THRESHOLD_BYTES,
    STRUCTURE_SIMILARITY_THRESHOLD
};
