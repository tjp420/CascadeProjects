// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * Sanitize file-merger-reduction-report (consolidation) exports — benchmark clones, stale inventory fiction.
 */

const { isExternalBenchmarkCachePath, isBenchmarkScanTargetRoot } = require('./benchmark-cache-paths');
const { redactProjectPathForExport, projectLabelFromPath } = require('./assessment-export-sanitize');
const {
    isEphemeralConsolidationPath,
    isConsolidationExcludedPair,
    consolidationCandidateTouchesExcluded,
    filterFuzzyPairs,
    countExcludedFuzzyPairs,
    countIntentionalPairExclusions
} = require('./consolidation-path-exclusions');

const PRODUCT_PATH_MARKERS = [
    /^web\/data\b/i,
    /^data\/roadmap\b/i
];

const SIMPLEBEACON_PRODUCT_MARKERS = [
    /dashboard load/i,
    /Restart the dashboard server/i,
    /platform-scoped counts \(~2,200 files\)/i,
    /includes github-cache\/\)/i
];

function redactConsolidationProjectPath(value, options = {}) {
    if (value == null || value === '') return value;
    const normalized = String(value).replace(/\\/g, '/');
    const lower = normalized.toLowerCase();
    const githubIdx = lower.indexOf('/github-cache/');
    if (githubIdx >= 0) {
        const suffix = normalized.slice(githubIdx + 1);
        const platformLabel = options.productPlatformLabel || 'ai-platform';
        return `${platformLabel}/${suffix}`;
    }
    const label = options.projectLabel || projectLabelFromPath(normalized);
    return redactProjectPathForExport(normalized, label);
}

function applyRedactedConsolidationPaths(scan, projectPath, productPlatformRoot) {
    const projectLabel = projectLabelFromPath(productPlatformRoot || projectPath || 'ai-platform');
    const pathOptions = { projectLabel, productPlatformLabel: projectLabel };
    const redact = (value) => redactConsolidationProjectPath(value, pathOptions);
    return {
        ...scan,
        projectRoot: redact(scan.projectRoot || projectPath),
        scanTargetRoot: redact(scan.scanTargetRoot || projectPath || scan.projectRoot),
        ...(scan.platformRoot ? { platformRoot: redact(scan.platformRoot) } : {}),
        ...(scan.productPlatformRoot ? { productPlatformRoot: redact(scan.productPlatformRoot) } : {}),
        ...(scan.repositoryInventory
            ? {
                repositoryInventory: {
                    ...scan.repositoryInventory,
                    projectRoot: redact(
                        scan.repositoryInventory.projectRoot || scan.projectRoot || projectPath
                    )
                }
            }
            : {})
    };
}

function resolveProductPlatformRoot(projectPath) {
    const normalized = String(projectPath || '').replace(/\\/g, '/');
    const idx = normalized.toLowerCase().indexOf('/github-cache/');
    if (idx <= 0) return null;
    return normalized.slice(0, idx);
}

function resolveConsolidationProjectPath(scan, options = {}) {
    const explicit = String(
        options.projectPath
        || options.scanTargetRoot
        || options.requestedProjectPath
        || scan.scanTargetRoot
        || scan.projectPath
        || scan.projectRoot
        || scan.repositoryInventory?.projectRoot
        || ''
    ).replace(/\\/g, '/');
    if (isBenchmarkScanTargetRoot(explicit)) return explicit;
    const inferred = inferConsolidationScanTargetFromHints(scan, options);
    return inferred || explicit;
}

function inferConsolidationScanTargetFromHints(scan, options = {}) {
    const filename = String(options.exportFilename || options.filename || '').toLowerCase();
    if (!filename.includes('github-cache')) return '';

    const slugMatch = filename.match(/github-cache[-_]([a-z0-9._-]+?)(?:-\d{4}-\d{2}-\d{2}|\(\d+\)|\.json)/i);
    if (!slugMatch) return '';

    const cloneName = slugMatch[1];
    const sourceRoot = String(
        options.projectPath || scan.projectRoot || scan.repositoryInventory?.projectRoot || ''
    ).replace(/\\/g, '/');
    if (isBenchmarkScanTargetRoot(sourceRoot)) return '';

    const platformRoot = resolveProductPlatformRoot(`${sourceRoot.replace(/\/$/, '')}/github-cache/${cloneName}`)
        || sourceRoot;
    return `${platformRoot.replace(/\/$/, '')}/github-cache/${cloneName}`;
}

function dedupeExportNotes(notes = []) {
    const seen = new Set();
    const out = [];
    for (const note of notes) {
        const normalized = String(note).replace(/\s+/g, ' ').trim().toLowerCase();
        const scopeKey = /consolidation export scoped to github-cache/i.test(normalized)
            ? 'benchmark-scope-note'
            : /product sample paths \(web\/data/i.test(normalized)
                ? 'benchmark-sample-path-note'
                : /no actionable merge candidates/i.test(normalized)
                    ? 'benchmark-no-merge-note'
                    : /measured potential savings are 0b/i.test(normalized)
                        ? 'benchmark-zero-savings-note'
                        : /re-run consolidation on ai-platform root/i.test(normalized)
                            ? 'benchmark-rerun-note'
                            : /intentional cjs\/browser mirrors/i.test(normalized)
                                ? 'benchmark-intentional-pairs-note'
                                : /securityhandoffeligible is false/i.test(normalized)
                                    ? 'security-handoff-note'
                                    : /gate content-scanned/i.test(normalized)
                                        ? 'gate-credential-scope-note'
                                        : /json file\(s\) hashed for exact duplicates/i.test(normalized)
                                            ? 'json-hash-scope-note'
                                            : normalized;
        if (seen.has(scopeKey)) continue;
        seen.add(scopeKey);
        out.push(String(note));
    }
    return out.slice(0, 12);
}

function resolveIntentionalPairsExcludedCount(summaryBase, pairExclusions, rawMergeCount, mergeCandidatesLength) {
    const fromPairs = pairExclusions?.intentionalPairsExcluded ?? 0;
    const fromDiff = rawMergeCount > mergeCandidatesLength ? rawMergeCount - mergeCandidatesLength : 0;
    const fromSummary = summaryBase.intentionalPairsExcluded ?? 0;
    const fromFuzzy = summaryBase.fuzzyPairsExcluded ?? 0;
    return Math.max(fromSummary, fromPairs, fromDiff, fromFuzzy);
}

function reconcileLegacyConsolidationCounts(summary = {}) {
    let benchmarkCacheCandidatesExcluded = summary.benchmarkCacheCandidatesExcluded ?? 0;
    let fuzzyPairsExcluded = summary.fuzzyPairsExcluded ?? 0;
    if (benchmarkCacheCandidatesExcluded > 0
        && (summary.exactDuplicateGroups ?? 0) === 0
        && fuzzyPairsExcluded === 0) {
        fuzzyPairsExcluded = benchmarkCacheCandidatesExcluded;
        benchmarkCacheCandidatesExcluded = 0;
    }
    return { benchmarkCacheCandidatesExcluded, fuzzyPairsExcluded };
}

function refreshProductConsolidationScopeLimitations(scanScope, summary = {}) {
    if (!scanScope) return scanScope;
    const { benchmarkCacheCandidatesExcluded, fuzzyPairsExcluded } = reconcileLegacyConsolidationCounts(summary);
    const staleLimitationRe = /benchmark-clone candidate|near-duplicate pair\(s\) excluded \(MCP|duplicate group\(s\) under github-cache/i;
    const base = (scanScope.limitations || []).filter((line) => !staleLimitationRe.test(String(line)));
    const extra = [];
    if (benchmarkCacheCandidatesExcluded > 0) {
        extra.push(
            `${benchmarkCacheCandidatesExcluded} duplicate group(s) under github-cache/ or deliverables/ excluded from platform consolidation scores.`
        );
    }
    if (fuzzyPairsExcluded > 0) {
        extra.push(
            `${fuzzyPairsExcluded} near-duplicate pair(s) excluded (MCP examples, session temps, monorepo mirrors).`
        );
    }
    return { ...scanScope, limitations: [...base, ...extra] };
}

function isBenchmarkConsolidation(scan, options = {}) {
    if (options.benchmarkScan != null) return Boolean(options.benchmarkScan);
    const projectPath = resolveConsolidationProjectPath(scan, options);
    return isBenchmarkScanTargetRoot(projectPath) || isExternalBenchmarkCachePath(projectPath);
}

function rewriteProductScopedText(text, benchmarkScan) {
    if (!benchmarkScan || text == null) return text;
    let next = String(text);
    next = next.replace(/trim or archive for dashboard load/gi, 'trim or archive if no longer needed in this OSS clone');
    next = next.replace(/Restart the dashboard server and re-run consolidation for platform-scoped counts \(~2,200 files\)\./gi,
        'Re-run consolidation on ai-platform root for Simplebeacon product sample-path metrics.');
    next = next.replace(/\(includes github-cache\/\)/gi, '(OSS clone under github-cache/)');
    return next;
}

function sanitizeReductionOpportunity(opp, benchmarkScan) {
    if (!opp || !benchmarkScan) return opp;
    return {
        ...opp,
        description: rewriteProductScopedText(opp.description, true),
        files: (opp.files || []).map((file) => ({
            ...file,
            path: file.path
        }))
    };
}

function sanitizeRecommendation(rec, benchmarkScan) {
    if (!rec || !benchmarkScan) return rec;
    return {
        ...rec,
        description: rewriteProductScopedText(rec.description, true)
    };
}

function buildBenchmarkConsolidationConclusion(scan) {
    const s = scan.summary || {};
    const repoFiles = s.repositoryFilesTotal ?? s.repositoryFilesAudited ?? scan.repositoryInventory?.totalFiles;
    const candidates = (s.mergeCandidates || 0) + (s.reductionOpportunities || 0);
    const jsonScanned = s.jsonFilesAnalyzed;
    const sampleJson = s.sampleDataFilesAnalyzed ?? 0;
    const parts = [
        'OSS benchmark clone under github-cache/ — consolidation hygiene for the clone only, not Simplebeacon product handoff',
        candidates
            ? `${candidates} merge/reduction candidate(s) inside this clone`
            : 'No merge/reduction candidates detected',
        sampleJson === 0
            ? 'Simplebeacon product sample paths (web/data, data/roadmap) are not present on this clone'
            : `${sampleJson} sample JSON under configured paths`,
        repoFiles != null ? `Clone inventory: ${Number(repoFiles).toLocaleString()} files` : null,
        jsonScanned != null ? `${Number(jsonScanned).toLocaleString()} JSON hashed in clone` : null,
        s.potentialSavingsLabel ? `Potential savings if acted on: ${s.potentialSavingsLabel}` : null,
        'Re-run consolidation on ai-platform root for product mock/sample deduplication evidence'
    ].filter(Boolean);
    return `${parts.join('. ')}.`;
}

function consolidationPathTouchesExcluded(filePath) {
    const rel = String(filePath || '').replace(/\\/g, '/');
    return isEphemeralConsolidationPath(rel)
        || isExternalBenchmarkCachePath(rel)
        || rel.startsWith('deliverables/')
        || rel.includes('/deliverables/')
        || rel.startsWith('github-cache/')
        || rel.includes('/github-cache/');
}

function consolidationCandidateTouchesExcludedExport(candidate) {
    if (consolidationCandidateTouchesExcluded(candidate)) return true;
    const paths = (candidate?.files || []).map((file) =>
        file.path || file.relativePath || file.name).filter(Boolean);
    if (paths.length === 2 && isConsolidationExcludedPair(paths[0], paths[1])) return true;
    return (candidate?.files || []).some((file) =>
        consolidationPathTouchesExcluded(file.path || file.relativePath || file.name));
}

/** Intentional mirrors (browser/CJS, MCP examples) always excluded; github-cache paths only on product scans. */
function shouldExcludeConsolidationCandidate(candidate, benchmarkScan) {
    if (consolidationCandidateTouchesExcluded(candidate)) return true;
    if (benchmarkScan) return false;
    return consolidationCandidateTouchesExcludedExport(candidate);
}

function filterAdvancedAnalysis(analysis, benchmarkScan) {
    if (!analysis) return analysis;
    const fuzzyPairs = filterFuzzyPairs(analysis.fuzzyNearDuplicates?.pairs || [])
        .filter((pair) => benchmarkScan
            || (!consolidationPathTouchesExcluded(pair.fileA) && !consolidationPathTouchesExcluded(pair.fileB)));
    const patternGroups = (analysis.patternConsolidation?.recommendations || [])
        .filter((group) => benchmarkScan
            || !(group.files || []).every((file) => consolidationPathTouchesExcluded(file.path)));
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

function normalizeConsolidationPaths(scan) {
    const normFile = (file) => {
        if (!file || typeof file !== 'object') return file;
        const path = file.path != null ? String(file.path).replace(/\\/g, '/') : file.path;
        const relativePath = file.relativePath != null
            ? String(file.relativePath).replace(/\\/g, '/')
            : file.relativePath;
        return { ...file, ...(path != null ? { path } : {}), ...(relativePath != null ? { relativePath } : {}) };
    };
    return {
        ...scan,
        projectRoot: scan.projectRoot ? String(scan.projectRoot).replace(/\\/g, '/') : scan.projectRoot,
        platformRoot: scan.platformRoot ? String(scan.platformRoot).replace(/\\/g, '/') : scan.platformRoot,
        scanTargetRoot: scan.scanTargetRoot ? String(scan.scanTargetRoot).replace(/\\/g, '/') : scan.scanTargetRoot,
        productPlatformRoot: scan.productPlatformRoot
            ? String(scan.productPlatformRoot).replace(/\\/g, '/')
            : scan.productPlatformRoot,
        ...(scan.repositoryInventory
            ? {
                repositoryInventory: {
                    ...scan.repositoryInventory,
                    projectRoot: String(
                        scan.repositoryInventory.projectRoot || scan.projectRoot || ''
                    ).replace(/\\/g, '/') || scan.projectRoot
                }
            }
            : {}),
        mergeCandidates: (scan.mergeCandidates || []).map((c) => ({
            ...c,
            files: (c.files || []).map(normFile)
        })),
        recommendations: (scan.recommendations || []).map((r) => ({
            ...r,
            files: (r.files || []).map((f) => (typeof f === 'string' ? f.replace(/\\/g, '/') : f))
        }))
    };
}

function filterConsolidationRecommendations(recommendations, benchmarkScan) {
    return (recommendations || []).filter((rec) => {
        const files = rec.files || [];
        if (files.length === 2 && isConsolidationExcludedPair(files[0], files[1])) {
            return false;
        }
        if (files.some(isEphemeralConsolidationPath)) return false;
        if (benchmarkScan) return true;
        return !files.some((f) => consolidationPathTouchesExcluded(f));
    });
}

function resolveBenchmarkConsolidationHealth(summary) {
    const mergeN = summary?.mergeCandidates ?? 0;
    const savings = summary?.potentialSavingsBytes ?? 0;
    if (mergeN === 0 && savings === 0) return 'benchmark-hygiene-clean';
    if (mergeN > 0) return 'benchmark-review-merge-candidates';
    return 'benchmark-hygiene';
}

function buildBenchmarkConsolidationExportNotes(summary, pairExclusions) {
    const notes = [];
    const intentional = Math.max(
        pairExclusions?.intentionalPairsExcluded ?? 0,
        summary?.intentionalPairsExcluded ?? 0,
        (summary?.browserMirrorPairsExcluded ?? 0)
            + (summary?.mcpExamplePairsExcluded ?? 0)
    );
    if (intentional > 0) {
        notes.push(
            `${intentional} near-duplicate pair(s) excluded as intentional CJS/browser mirrors or MCP example configs — do not merge.`
        );
    }
    if ((summary?.mergeCandidates ?? 0) === 0) {
        notes.push('No actionable merge candidates on this OSS clone — consolidation is inventory hygiene only.');
    }
    if ((summary?.potentialSavingsBytes ?? 0) === 0) {
        notes.push('Measured potential savings are 0B — not a delete/merge approval.');
    }
    notes.push('Re-run consolidation on ai-platform root for Simplebeacon product sample-path deduplication.');
    return notes;
}

function assembleBenchmarkConsolidationExportNotes(existingNotes = [], summary, pairExclusions) {
    const dynamic = buildBenchmarkConsolidationExportNotes(summary, pairExclusions);
    const scopeNotes = [
        'Consolidation export scoped to github-cache/ OSS clone — not Simplebeacon platform product code.',
        'Product sample paths (web/data, data/roadmap) do not apply on this benchmark target.'
    ];
    const skipPatterns = [
        /consolidation export scoped to github-cache/i,
        /product sample paths \(web\/data/i,
        /no actionable merge candidates/i,
        /measured potential savings are 0b/i,
        /re-run consolidation on ai-platform root/i,
        /intentional cjs\/browser mirrors/i
    ];
    const filtered = dedupeExportNotes(existingNotes).filter((note) => {
        const text = String(note);
        if (SIMPLEBEACON_PRODUCT_MARKERS.some((re) => re.test(text))) return false;
        const lowered = text.toLowerCase();
        return !skipPatterns.some((re) => re.test(lowered))
            && !dynamic.some((entry) => entry.toLowerCase() === lowered);
    });
    return dedupeExportNotes([...filtered, ...dynamic, ...scopeNotes]);
}

function resolveProductConsolidationHealth(summary) {
    const mergeN = summary?.mergeCandidates ?? 0;
    const savings = summary?.potentialSavingsBytes ?? 0;
    if (mergeN === 0 && savings === 0) return 'clean-no-merge-candidates';
    if (mergeN > 0) return 'review-merge-candidates';
    return 'platform-scoped';
}

function resolveConsolidationGateContext(scan, options = {}) {
    const gateReport = options.gateReport || {};
    const repositoryFilesTotal = options.repositoryFilesTotal
        ?? gateReport.repositoryFilesTotal
        ?? gateReport.repositoryInventory?.totalFiles
        ?? scan.hygieneSummary?.gateRepositoryFilesTotal
        ?? scan.scanScope?.gateRepositoryFilesTotal
        ?? null;
    const credentialScanned = gateReport.credentialScanned
        ?? gateReport.productionLeakScanned
        ?? gateReport.scanScope?.productionDirsScanned
        ?? scan.hygieneSummary?.credentialScanned
        ?? null;
    const contentScanned = gateReport.scanScope?.fullDirectoryStats?.contentScanned
        ?? gateReport.scanScope?.fullDirectoryStats?.filesContentScanned
        ?? gateReport.credentialScanned
        ?? scan.hygieneSummary?.contentFilesScanned
        ?? null;
    const gateProfile = gateReport.scanScope?.profile
        ?? scan.scanScope?.gateRuleBundleProfile
        ?? scan.hygieneSummary?.gateRuleBundleProfile
        ?? null;
    return {
        gateReport,
        repositoryFilesTotal,
        credentialScanned,
        contentScanned,
        gateProfile,
        fictionJsonFilesScanned: gateReport.fictionJsonFilesScanned
            ?? gateReport.scanScope?.fictionJsonFilesScanned
            ?? scan.hygieneSummary?.fictionJsonFilesScanned
            ?? null,
        fictionSampleFilesScanned: gateReport.fictionSampleFilesScanned
            ?? gateReport.mockSampleFiles
            ?? gateReport.scanScope?.fictionSampleFilesScanned
            ?? scan.hygieneSummary?.fictionSampleFilesScanned
            ?? null
    };
}

function buildProductConsolidationHygieneSummary(summaryBase, scan, options = {}) {
    const gateContext = resolveConsolidationGateContext(scan, options);
    const { repositoryFilesTotal: gateTotal, credentialScanned, contentScanned, gateProfile, gateReport,
        fictionJsonFilesScanned, fictionSampleFilesScanned } = gateContext;
    const repoTotal = summaryBase.repositoryFilesTotal ?? scan.repositoryInventory?.totalFiles ?? null;
    const repoAudited = summaryBase.repositoryFilesAudited ?? scan.scanScope?.repositoryFilesAudited ?? null;
    return {
        consolidationHealthStatus: resolveProductConsolidationHealth(summaryBase),
        mergeCandidates: summaryBase.mergeCandidates ?? 0,
        potentialSavingsBytes: summaryBase.potentialSavingsBytes ?? 0,
        exactDuplicateGroups: summaryBase.exactDuplicateGroups ?? 0,
        jsonFilesAnalyzed: summaryBase.jsonFilesAnalyzed ?? scan.scanScope?.jsonFilesAnalyzed ?? null,
        sampleDataFilesAnalyzed: summaryBase.sampleDataFilesAnalyzed ?? scan.scanScope?.sampleDataFilesAnalyzed ?? null,
        repositoryFilesTotal: repoTotal,
        ...(repoAudited != null ? { repositoryFilesAudited: repoAudited } : {}),
        ...(repoTotal != null && repoAudited != null && repoTotal > repoAudited
            ? { auditInventoryNotMergeWalked: repoTotal - repoAudited }
            : {}),
        ...(gateTotal != null ? { gateRepositoryFilesTotal: gateTotal } : {}),
        ...(gateTotal != null && credentialScanned != null && gateTotal > credentialScanned
            ? { gateMetadataOnlyFiles: gateTotal - credentialScanned }
            : {}),
        ...(contentScanned != null ? { contentFilesScanned: contentScanned } : {}),
        ...(fictionJsonFilesScanned != null ? { fictionJsonFilesScanned } : {}),
        ...(fictionSampleFilesScanned != null ? { fictionSampleFilesScanned } : {}),
        ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
        intentionalPairsExcluded: summaryBase.intentionalPairsExcluded
            ?? summaryBase.fuzzyPairsExcluded
            ?? 0,
        ...(gateReport.jestBaselineChecked === false || scan.hygieneSummary?.jestBaselineChecked === false
            ? { jestBaselineChecked: false }
            : {}),
        attestationNote: 'File merger/reduction hygiene — not gate pass or vendor handoff certification.'
    };
}

function enrichProductConsolidationScanScope(scanScope, scan, options = {}) {
    const gateContext = resolveConsolidationGateContext(scan, options);
    const { repositoryFilesTotal: gateTotal, gateProfile } = gateContext;
    const summary = scan.summary || {};
    return {
        ...(scanScope || {}),
        ...(gateTotal != null ? { gateRepositoryFilesTotal: gateTotal } : {}),
        ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
        mergeWalkFiles: summary.repositoryFilesAudited ?? scanScope?.repositoryFilesAudited ?? null,
        jsonFilesHashed: summary.jsonFilesAnalyzed ?? scanScope?.jsonFilesAnalyzed ?? null,
        sampleDataFilesAnalyzed: summary.sampleDataFilesAnalyzed ?? scanScope?.sampleDataFilesAnalyzed ?? null,
        resultsViewScope: scanScope?.resultsViewScope || 'platform-only',
        securityHandoffEligible: false
    };
}

function buildProductConsolidationExportNotes(scan, ephemeralExcluded, context = {}) {
    const notes = [
        'securityHandoffEligible is false — consolidation is measured duplicate hygiene only, not vendor security handoff.',
        'Absolute scan paths are redacted to project label in operator exports.'
    ];
    const scope = scan.scanScope || {};
    const repoTotal = scan.summary?.repositoryFilesTotal ?? scan.repositoryInventory?.totalFiles;
    const repoAudited = scan.summary?.repositoryFilesAudited ?? scope.repositoryFilesAudited;
    if (repoTotal != null && repoAudited != null && repoTotal !== repoAudited) {
        notes.push(
            `Inventory: ${Number(repoTotal).toLocaleString()} files in audit profile; merge walks used ${Number(repoAudited).toLocaleString()} audit-scoped paths.`
        );
    }
    const gateContext = resolveConsolidationGateContext(scan, context);
    const { repositoryFilesTotal: gateTotal, credentialScanned, gateProfile, gateReport,
        fictionJsonFilesScanned, fictionSampleFilesScanned } = gateContext;
    const profile = scan.repositoryInventory?.profile || scope.repositoryInventoryProfile || 'audit';
    if (gateTotal != null && repoTotal != null && gateTotal !== repoTotal) {
        notes.push(
            `repositoryFilesTotal (${Number(repoTotal).toLocaleString()}, ${profile} profile) — gate full-tree inventory is ${Number(gateTotal).toLocaleString()} paths.`
        );
    }
    if (gateTotal != null && credentialScanned != null && credentialScanned < gateTotal) {
        notes.push(
            `Gate content-scanned ${Number(credentialScanned).toLocaleString()} production-path file(s) — ${Number(gateTotal - credentialScanned).toLocaleString()} binary/metadata-only path(s) in full-tree inventory of ${Number(gateTotal).toLocaleString()}.`
        );
    }
    const jsonN = scan.summary?.jsonFilesAnalyzed ?? scan.scanScope?.jsonFilesAnalyzed;
    const sampleN = scan.summary?.sampleDataFilesAnalyzed ?? scan.scanScope?.sampleDataFilesAnalyzed;
    if (jsonN != null && sampleN != null) {
        notes.push(
            `${Number(jsonN).toLocaleString()} JSON file(s) hashed for exact duplicates — ${Number(sampleN).toLocaleString()} under sample paths (web/data, data/roadmap).`
        );
    }
    if (ephemeralExcluded > 0) {
        notes.push(
            `${ephemeralExcluded} near-duplicate pair(s) involving vault/session cookie temps (.tmp-*, cookies.txt) excluded — not merge candidates.`
        );
    }
    const aliasExcluded = (scan.summary?.monorepoAliasPairsExcluded ?? 0)
        + (scan.summary?.browserMirrorPairsExcluded ?? 0)
        + (scan.summary?.mcpExamplePairsExcluded ?? 0);
    if (aliasExcluded > 0) {
        notes.push(
            `${aliasExcluded} pair(s) excluded as monorepo path aliases, browser build mirrors, or intentional MCP example configs.`
        );
    }
    if ((scan.summary?.exactDuplicateGroups ?? 0) === 0 && (scan.summary?.mergeCandidates ?? 0) === 0) {
        notes.push('No exact duplicate groups or actionable merge candidates in this export.');
    }
    if ((scan.summary?.potentialSavingsBytes ?? 0) === 0) {
        notes.push('Measured potential savings are 0B — consolidation is informational hygiene, not a delete/merge approval.');
    }
    if (fictionJsonFilesScanned != null && fictionSampleFilesScanned != null && fictionJsonFilesScanned > fictionSampleFilesScanned) {
        notes.push(
            `DATA-002 evaluated ${Number(fictionJsonFilesScanned).toLocaleString()} repository JSON path(s) — ${Number(fictionSampleFilesScanned).toLocaleString()} *-sample.json KPI file(s) matched in paired gate scan.`
        );
    }
    if (gateProfile) {
        notes.push(`Gate rule bundle profile: ${gateProfile} — pair consolidation report with json/simplebeacon-gate.json for handoff evidence.`);
    }
    if (gateReport.jestBaselineChecked === false || scan.hygieneSummary?.jestBaselineChecked === false) {
        notes.push('Consolidation scan does not run Jest — use gate/complete scan for test attestation.');
    }
    if (scan.rejectedFiction?.warning) {
        notes.push(`Marketing throughput claims in rejectedFiction are not implemented (${scan.rejectedFiction.warning}).`);
    }
    return [...new Set(notes)].slice(0, 12);
}

function buildProductConsolidationAiSummary(scan) {
    const s = scan.summary || {};
    const repoTotal = s.repositoryFilesTotal ?? scan.repositoryInventory?.totalFiles;
    const repoAudited = s.repositoryFilesAudited ?? scan.scanScope?.repositoryFilesAudited;
    const parts = [
        'Platform consolidation scan — no actionable merge candidates',
        s.exactDuplicateGroups != null
            ? `${s.exactDuplicateGroups} exact duplicate group(s)`
            : null,
        s.jsonFilesAnalyzed != null
            ? `${Number(s.jsonFilesAnalyzed).toLocaleString()} repo JSON hashed for duplicates`
            : null,
        repoTotal != null ? `inventory ${Number(repoTotal).toLocaleString()} files` : null,
        repoAudited != null && repoAudited !== repoTotal
            ? `${Number(repoAudited).toLocaleString()} audit-scoped for merge logic`
            : null,
        s.potentialSavingsLabel ? `potential savings ${s.potentialSavingsLabel}` : '0B measured savings',
        'hygiene only — not vendor handoff clearance'
    ].filter(Boolean);
    return `${parts.join('; ')}.`;
}

function filterExportNotes(notes = [], benchmarkScan) {
    const filtered = notes.filter((note) => {
        const text = String(note);
        if (!benchmarkScan) return true;
        return !SIMPLEBEACON_PRODUCT_MARKERS.some((re) => re.test(text));
    });
    if (benchmarkScan) {
        const hasScopeNote = filtered.some((note) =>
            /Consolidation export scoped to github-cache/i.test(String(note)));
        const hasSamplePathNote = filtered.some((note) =>
            /Product sample paths \(web\/data/i.test(String(note)));
        if (!hasScopeNote) {
            filtered.push(
                'Consolidation export scoped to github-cache/ OSS clone — not Simplebeacon platform product code.'
            );
        }
        if (!hasSamplePathNote) {
            filtered.push(
                'Product sample paths (web/data, data/roadmap) do not apply on this benchmark target.'
            );
        }
    }
    return dedupeExportNotes(filtered);
}

function sanitizeScanScope(scanScope, scan, benchmarkScan, projectPath) {
    if (!scanScope) return scanScope;
    const repoFiles = scan.summary?.repositoryFilesTotal ?? scanScope.repositoryFilesTotal;
    const productPlatformRoot = resolveProductPlatformRoot(projectPath);

    if (!benchmarkScan) {
        return {
            ...scanScope,
            limitations: (scanScope.limitations || []).map((line) => rewriteProductScopedText(line, false))
        };
    }

    const samplePaths = scan.scanPaths || scanScope.sampleDataPaths || [];
    const productPathsMissing = samplePaths.some((p) => PRODUCT_PATH_MARKERS.some((re) => re.test(String(p))));

    return {
        ...scanScope,
        mode: 'benchmark-clone-consolidation',
        resultsViewScope: 'benchmark-clone',
        benchmarkScanTarget: true,
        reportHealth: 'benchmark-clone-consolidation',
        inventoryProfile: scanScope.inventoryProfile || 'audit',
        inventoryMetricsStale: false,
        rescanRecommended: false,
        productPlatformRoot: productPlatformRoot || undefined,
        limitations: [
            `OSS benchmark clone inventory: ${repoFiles != null ? Number(repoFiles).toLocaleString() : '—'} files in ${projectPath.split('/').pop() || 'clone'}.`,
            productPathsMissing
                ? 'Configured Simplebeacon sample paths (web/data, data/roadmap) are absent on this clone — fuzzy/structure metrics reflect clone content only.'
                : 'Sample paths present on clone; metrics are not Simplebeacon product handoff evidence.',
            'Merge candidates are informational for OSS hygiene — do not treat as ai-platform cleanup approval.',
            'node_modules, .git, coverage, archive, dist, build, and nested github-cache/ paths are excluded from merge walks.'
        ]
    };
}

/**
 * @param {object} scan file-merger-reduction-report
 * @param {object} [options]
 * @returns {object}
 */
function sanitizeConsolidationExport(scan, options = {}) {
    if (!scan || scan.type !== 'file-merger-reduction-report') return scan;
    if (!scan.summary) return scan;

    let working = normalizeConsolidationPaths(scan);
    const projectPath = resolveConsolidationProjectPath(working, options);
    const benchmarkScan = isBenchmarkConsolidation(working, { ...options, projectPath });
    const productPlatformRoot = benchmarkScan
        ? (options.productPlatformRoot || resolveProductPlatformRoot(projectPath))
        : null;

    const repoRaw = working.summary.repositoryFilesTotal ?? working.repositoryInventory?.totalFiles ?? null;
    const staleProductInventory = !benchmarkScan && repoRaw != null && repoRaw > 10000;

    const rawMergeCount = (working.mergeCandidates || []).length;
    const rawMergeList = working.mergeCandidates || [];
    const pairExclusions = countIntentionalPairExclusions(rawMergeList);
    let mergeCandidates = rawMergeList.filter((c) =>
        !shouldExcludeConsolidationCandidate(c, benchmarkScan));
    mergeCandidates = mergeCandidates.map((c) => (
        benchmarkScan
            ? { ...c, recommendation: rewriteProductScopedText(c.recommendation, true) }
            : c
    ));
    let reductionOpportunities = (working.reductionOpportunities || []).filter((o) =>
        !shouldExcludeConsolidationCandidate(o, benchmarkScan));
    reductionOpportunities = reductionOpportunities.map((o) =>
        sanitizeReductionOpportunity(o, benchmarkScan));
    reductionOpportunities = reductionOpportunities.filter((o) => {
        const paths = (o.files || []).map((f) => f.path || f.relativePath).filter(Boolean);
        if (paths.length === 2 && isConsolidationExcludedPair(paths[0], paths[1])) return false;
        return true;
    });
    const benchmarkMergeExcluded = rawMergeCount - mergeCandidates.length;
    const rawAdvanced = working.advancedAnalysis;
    const advancedAnalysis = filterAdvancedAnalysis(rawAdvanced, benchmarkScan);
    const ephemeralFuzzyExcluded = !benchmarkScan
        ? countExcludedFuzzyPairs(rawAdvanced?.fuzzyNearDuplicates?.pairs || []).ephemeralPathsExcluded
        : 0;
    const rawFuzzyPairExclusions = !benchmarkScan
        ? countExcludedFuzzyPairs(rawAdvanced?.fuzzyNearDuplicates?.pairs || [])
        : { fuzzyPairsExcluded: 0, intentionalPairsExcluded: 0, browserMirrorPairsExcluded: 0,
            mcpExamplePairsExcluded: 0, monorepoAliasPairsExcluded: 0, ephemeralPathsExcluded: 0 };
    const legacyCounts = reconcileLegacyConsolidationCounts(working.summary);
    let benchmarkCacheCandidatesExcluded = legacyCounts.benchmarkCacheCandidatesExcluded
        + (benchmarkScan ? benchmarkMergeExcluded : 0);
    let fuzzyPairsExcluded = legacyCounts.fuzzyPairsExcluded || rawFuzzyPairExclusions.fuzzyPairsExcluded;
    let recommendations = filterConsolidationRecommendations(working.recommendations, benchmarkScan);
    recommendations = recommendations.map((r) =>
        sanitizeRecommendation(r, benchmarkScan));

    const exactDuplicateGroups = reductionOpportunities.filter((o) => o.type === 'duplicate-removal').length;
    const intentionalPairsExcluded = resolveIntentionalPairsExcludedCount(
        {
            ...working.summary,
            benchmarkCacheCandidatesExcluded,
            fuzzyPairsExcluded
        },
        pairExclusions,
        rawMergeCount,
        mergeCandidates.length
    );
    const summaryBase = {
        ...working.summary,
        mergeCandidates: mergeCandidates.length,
        reductionOpportunities: reductionOpportunities.length,
        exactDuplicateGroups,
        fuzzyNearDuplicatePairs: advancedAnalysis?.fuzzyNearDuplicates?.pairsFound
            ?? working.summary.fuzzyNearDuplicatePairs,
        benchmarkCacheCandidatesExcluded,
        fuzzyPairsExcluded,
        ...(intentionalPairsExcluded > 0
            ? {
                intentionalPairsExcluded,
                browserMirrorPairsExcluded: (working.summary.browserMirrorPairsExcluded ?? 0)
                    + pairExclusions.browserMirrorPairsExcluded
                    + rawFuzzyPairExclusions.browserMirrorPairsExcluded,
                mcpExamplePairsExcluded: (working.summary.mcpExamplePairsExcluded ?? 0)
                    + pairExclusions.mcpExamplePairsExcluded
                    + rawFuzzyPairExclusions.mcpExamplePairsExcluded,
                monorepoAliasPairsExcluded: (working.summary.monorepoAliasPairsExcluded ?? 0)
                    + pairExclusions.monorepoAliasPairsExcluded
                    + rawFuzzyPairExclusions.monorepoAliasPairsExcluded
            }
            : {}),
        ...(ephemeralFuzzyExcluded > 0 || rawFuzzyPairExclusions.ephemeralPathsExcluded > 0
            ? { ephemeralPathsExcluded: ephemeralFuzzyExcluded || rawFuzzyPairExclusions.ephemeralPathsExcluded }
            : {})
    };

    const scanTargetRoot = projectPath || undefined;
    const productScanPathsOnBenchmark = benchmarkScan
        && (working.scanPaths || []).some((p) => PRODUCT_PATH_MARKERS.some((re) => re.test(String(p))))
        && (working.summary?.sampleDataFilesAnalyzed ?? 0) === 0;

    const next = {
        ...working,
        projectRoot: working.projectRoot || projectPath || undefined,
        advancedAnalysis: benchmarkScan && advancedAnalysis?.semanticHints
            ? {
                ...advancedAnalysis,
                semanticHints: {
                    ...advancedAnalysis.semanticHints,
                    note: 'Semantic hints disabled on OSS benchmark clone — not used for handoff.'
                }
            }
            : advancedAnalysis,
        mergeCandidates,
        reductionOpportunities,
        recommendations,
        summary: {
            ...summaryBase,
            ...(benchmarkScan
                ? {
                    repositoryFilesTotal: repoRaw,
                    staleInventoryNote: undefined,
                    repositoryFilesTotalRaw: undefined
                }
                : staleProductInventory
                    ? {
                        repositoryFilesTotalRaw: repoRaw,
                        repositoryFilesTotal: working.scanScope?.platformRepositoryFilesTotal ?? null,
                        staleInventoryNote: rewriteProductScopedText(
                            working.summary.staleInventoryNote
                            || `Explorer inventory counted ${Number(repoRaw).toLocaleString()} files (includes github-cache/). Restart the dashboard server and re-run consolidation for platform-scoped counts (~2,200 files).`,
                            false
                        )
                    }
                    : {})
        },
        scanScope: benchmarkScan
            ? sanitizeScanScope(working.scanScope, working, benchmarkScan, projectPath)
            : refreshProductConsolidationScopeLimitations(
                sanitizeScanScope(working.scanScope, working, benchmarkScan, projectPath),
                summaryBase
            ),
        aiSummary: benchmarkScan
            ? buildBenchmarkConsolidationConclusion({
                ...working,
                summary: {
                    ...summaryBase,
                    mergeCandidates: mergeCandidates.length,
                    reductionOpportunities: reductionOpportunities.length
                }
            })
            : (mergeCandidates.length === 0 && (summaryBase.potentialSavingsBytes ?? 0) === 0
                ? buildProductConsolidationAiSummary({ ...working, summary: summaryBase })
                : rewriteProductScopedText(working.aiSummary, false)),
        aiSummaryProvider: working.aiSummaryProvider
            ? String(working.aiSummaryProvider).replace(/\bSimplebeacon\b/g, 'SimpleBeacon')
            : working.aiSummaryProvider,
        ...(benchmarkScan
            ? {
                benchmarkScan: true,
                scanTargetProfile: 'benchmark-cache',
                handoffEligible: false,
                securityHandoffEligible: false,
                exportNormalized: true,
                scanTargetRoot,
                platformRoot: productPlatformRoot || undefined,
                productPlatformRoot: productPlatformRoot || undefined,
                consolidationHealthStatus: resolveBenchmarkConsolidationHealth(summaryBase),
                title: 'OSS Clone Consolidation Scan (github-cache benchmark)',
                hygieneSummary: {
                    mergeCandidates: mergeCandidates.length,
                    potentialSavingsBytes: summaryBase.potentialSavingsBytes ?? 0,
                    intentionalPairsExcluded,
                    repositoryFilesTotal: repoRaw ?? summaryBase.repositoryFilesTotal ?? null,
                    jsonFilesAnalyzed: summaryBase.jsonFilesAnalyzed ?? null,
                    attestationNote: 'OSS clone consolidation hygiene — not Simplebeacon product handoff clearance.'
                }
            }
            : {
                exportNormalized: true,
                scanTargetProfile: 'product',
                securityHandoffEligible: false,
                handoffEligible: false,
                consolidationHealthStatus: resolveProductConsolidationHealth(summaryBase),
                hygieneSummary: buildProductConsolidationHygieneSummary(summaryBase, working, {
                    repositoryFilesTotal: options.repositoryFilesTotal ?? null,
                    gateReport: options.gateReport || null
                })
            }),
        exportSanitized: true,
        exportNotes: benchmarkScan
            ? assembleBenchmarkConsolidationExportNotes(
                working.exportNotes,
                summaryBase,
                pairExclusions
            )
            : filterExportNotes([
                ...(working.exportSanitized || working.exportNormalized ? [] : (working.exportNotes || [])),
                ...(benchmarkMergeExcluded > 0
                    ? [`${benchmarkMergeExcluded} merge candidate(s) from github-cache/, deliverables/, or ephemeral session paths excluded from export.`]
                    : []),
                ...buildProductConsolidationExportNotes(
                    { ...working, summary: summaryBase, advancedAnalysis },
                    ephemeralFuzzyExcluded,
                    {
                        repositoryFilesTotal: options.repositoryFilesTotal ?? null,
                        gateReport: options.gateReport || null
                    }
                )
            ], false)
    };

    if (productScanPathsOnBenchmark) {
        next.scanPaths = [];
        next.scanPathsProductDefaultsOmitted = working.scanPaths;
        next.scanPathsNote = 'Simplebeacon product sample paths (web/data, data/roadmap) are not walked on OSS benchmark clones.';
        if (next.scanScope) {
            next.scanScope = {
                ...next.scanScope,
                sampleDataPaths: [],
                sampleDataPathsOmitted: working.scanPaths || working.scanScope?.sampleDataPaths || []
            };
        }
    }

    if (benchmarkScan && next.implementationPhases?.length) {
        next.implementationPhasesOmitted = true;
        delete next.implementationPhases;
    }

    if (!benchmarkScan) {
        next.scanScope = enrichProductConsolidationScanScope({
            ...(next.scanScope || {}),
            resultsViewScope: 'platform-only',
            reportHealth: staleProductInventory
                ? 'stale-explorer-inventory'
                : resolveProductConsolidationHealth(summaryBase),
            securityHandoffEligible: false,
            consolidationNote: 'Measured duplicate/fuzzy merge scan — not Complete scan clearance bundle.'
        }, next, {
            repositoryFilesTotal: options.repositoryFilesTotal ?? null,
            gateReport: options.gateReport || null
        });
        if (staleProductInventory) {
            next.scanScope.inventoryProfile = next.scanScope?.inventoryProfile || 'explorer';
        }
    }

    return applyRedactedConsolidationPaths(next, projectPath, productPlatformRoot);
}

module.exports = {
    isBenchmarkConsolidation,
    isEphemeralConsolidationPath,
    resolveConsolidationProjectPath,
    inferConsolidationScanTargetFromHints,
    buildBenchmarkConsolidationConclusion,
    buildProductConsolidationExportNotes,
    assembleBenchmarkConsolidationExportNotes,
    sanitizeConsolidationExport,
    rewriteProductScopedText
};
