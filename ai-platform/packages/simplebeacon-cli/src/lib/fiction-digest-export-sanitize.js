/**
 * Sanitize simplebeacon-fiction-digest exports — benchmark clones, hollow gate, handoff noise.
 */

const { isExternalBenchmarkCachePath, isBenchmarkScanTargetRoot } = require('./benchmark-cache-paths');
const { buildScanConclusion } = require('./scan-conclusion');
const {
    isBenchmarkCloneNoiseIssue,
    isBenchmarkScannerMetaIssue,
    isBenchmarkDigestExcludedIssue
} = require('./benchmark-digest-exclusions');
const { redactProjectPathForExport, projectLabelFromPath } = require('./assessment-export-sanitize');

function resolveProductPlatformRoot(projectPath) {
    const normalized = String(projectPath || '').replace(/\\/g, '/');
    const idx = normalized.toLowerCase().indexOf('/github-cache/');
    if (idx <= 0) return null;
    return normalized.slice(0, idx);
}

function resolveDigestProjectPath(digest, options = {}) {
    return String(
        options.projectPath
        || digest.projectPath
        || digest.sourceProjectPath
        || digest.sourceReport?.projectRoot
        || ''
    ).replace(/\\/g, '/');
}

function isBenchmarkFictionDigest(digest, options = {}) {
    if (options.benchmarkScan != null) return Boolean(options.benchmarkScan);
    const projectPath = resolveDigestProjectPath(digest, options);
    return isBenchmarkScanTargetRoot(projectPath) || isExternalBenchmarkCachePath(projectPath);
}

function filterDigestIssues(issues = [], benchmarkScan) {
    return issues.filter((issue) => {
        const filePath = issue.filePath || issue.file || '';
        if (filePath && isExternalBenchmarkCachePath(filePath)) return false;
        if (isBenchmarkDigestExcludedIssue(issue, benchmarkScan)) return false;
        return true;
    });
}

function buildBenchmarkFictionConclusion(fictionIssues, nonFictionIssues, sourceReport) {
    const repoFiles = sourceReport?.repositoryFilesTotal ?? sourceReport?.scanScope?.repositoryFilesTotal;
    const ruleScoped = sourceReport?.ruleScopedFilesAnalyzed ?? sourceReport?.scanScope?.ruleScopedFilesAnalyzed ?? 0;
    const jsonFiction = sourceReport?.fictionJsonFilesScanned ?? sourceReport?.scanScope?.fictionJsonFilesScanned;
    const fictionN = fictionIssues.reduce((sum, issue) => sum + (issue.count || 1), 0);

    const parts = [
        'OSS benchmark clone under github-cache/ — not Simplebeacon product handoff',
        fictionN
            ? `${fictionN} fiction/KPI pattern(s) in clone JSON — not product *-sample.json`
            : 'No Simplebeacon fiction KPI hits in product sample paths',
        nonFictionIssues.length
            ? `${nonFictionIssues.length} clone-local pattern hit(s) remain — informational only`
            : 'No actionable fiction-digest findings on this clone',
        repoFiles != null ? `Repository inventory: ${Number(repoFiles).toLocaleString()} files` : null,
        `Product gate paths checked ${Number(ruleScoped).toLocaleString()} files`,
        jsonFiction != null ? `Fiction rules scanned ${Number(jsonFiction).toLocaleString()} JSON file(s) in clone` : null,
        'Agency-handoff and EU AI Act blog matches are excluded from vendor gate scoring',
        'Re-run Complete scan on ai-platform root for handoff evidence'
    ].filter(Boolean);

    return `${parts.join('. ')}.`;
}

function isStaleFullTreeScan(report) {
    if (report.fullDirectoryScan || report.scanScope?.fullDirectoryScan) {
        return false;
    }
    const mock = report.mockSampleFiles ?? report.totalFiles ?? 0;
    const repoFiles = report.repositoryFilesTotal ?? 0;
    const paths = (report.scanPaths || []).map((p) => String(p).replace(/\\/g, '/').toLowerCase());
    const platformKey = String(report.projectRoot || '').replace(/\\/g, '/').toLowerCase();
    const scanIsPlatformRootOnly = paths.length === 1 && paths[0] === platformKey;
    return mock > 500 || scanIsPlatformRootOnly || repoFiles > 15000;
}

function normalizeDigestProjectPaths(projectPath, projectLabel) {
    const normalized = String(projectPath || '').replace(/\\/g, '/');
    if (!normalized) return undefined;
    const label = projectLabel || projectLabelFromPath(normalized);
    return redactProjectPathForExport(normalized, label);
}

function reconcileProductDigestScanScope(scanScope = {}, report = {}) {
    const fullTree = Boolean(report.fullDirectoryScan || scanScope.fullDirectoryScan);
    if (!fullTree) return scanScope;

    const mockInPaths = scanScope.mockSampleFilesInScanPaths ?? 0;
    const ruleScoped = report.ruleScopedFilesAnalyzed ?? scanScope.ruleScopedFilesAnalyzed ?? 0;
    const mockSampleFiles = report.mockSampleFiles ?? report.totalFiles ?? null;
    const fictionSamples = report.fictionSampleFilesScanned ?? scanScope.fictionSampleFilesScanned ?? null;

    let reconciled = mockInPaths;
    if (mockSampleFiles != null && mockSampleFiles < mockInPaths) {
        reconciled = mockSampleFiles;
    } else if (mockInPaths >= ruleScoped && ruleScoped > 0 && fictionSamples != null && fictionSamples < mockInPaths) {
        reconciled = fictionSamples;
    } else if (mockInPaths >= ruleScoped && ruleScoped > 0) {
        const jsonFiction = report.fictionJsonFilesScanned ?? scanScope.fictionJsonFilesScanned ?? null;
        if (jsonFiction != null && jsonFiction < mockInPaths) {
            reconciled = jsonFiction;
        }
    }

    if (reconciled === mockInPaths) return scanScope;

    return {
        ...scanScope,
        mockSampleFilesInScanPaths: reconciled,
        mockSampleFilesReconciledNote:
            `mockSampleFilesInScanPaths reconciled from ${Number(mockInPaths).toLocaleString()} to ${Number(reconciled).toLocaleString()} — full-directory scan counts repo-wide paths, not mock/sample JSON only.`
    };
}

function inferDigestScanTargetFromHints(digest, options = {}) {
    const filename = String(options.exportFilename || options.filename || '').toLowerCase();
    if (!filename.includes('github-cache')) return '';
    const slugMatch = filename.match(/github-cache[-_]([a-z0-9._-]+?)(?:-\d{4}-\d{2}-\d{2}|\(\d+\)|\.json)/i);
    if (!slugMatch) return '';
    const cloneName = slugMatch[1];
    const sourceRoot = resolveDigestProjectPath(digest, options);
    if (isBenchmarkScanTargetRoot(sourceRoot)) return '';
    const platformRoot = resolveProductPlatformRoot(sourceRoot) || sourceRoot;
    return `${platformRoot.replace(/\/$/, '')}/github-cache/${cloneName}`;
}

function dedupeFictionDigestExportNotes(notes = []) {
    const seen = new Set();
    const out = [];
    for (const note of notes) {
        const normalized = String(note).replace(/\s+/g, ' ').trim().toLowerCase();
        const scopeKey = /agency-handoff and eu ai act blog matches/i.test(normalized)
            ? 'benchmark-handoff-note'
            : /production-leak hits in simplebeacon scanner source/i.test(normalized)
                ? 'benchmark-scanner-meta-note'
                : /gate pass on clone does not imply/i.test(normalized)
                    ? 'benchmark-gate-handoff-note'
                    : /llm slop file count reconciled/i.test(normalized)
                        ? 'benchmark-llm-reconcile-note'
                        : normalized;
        if (seen.has(scopeKey)) continue;
        seen.add(scopeKey);
        out.push(String(note));
    }
    return out.slice(0, 6);
}

function buildBenchmarkFictionExportNotes(existingNotes = [], extras = []) {
    const canonical = [
        'Agency-handoff and EU AI Act blog matches removed from fiction digest for github-cache/ benchmark target.',
        'Production-leak hits in Simplebeacon scanner source (src/) excluded on OSS self-scan benchmark clone.',
        'Gate pass on clone does not imply Simplebeacon product handoff readiness.'
    ];
    const filtered = dedupeFictionDigestExportNotes(existingNotes).filter((note) => {
        const text = String(note).toLowerCase();
        return !/agency-handoff and eu ai act blog matches/i.test(text)
            && !/production-leak hits in simplebeacon scanner source/i.test(text)
            && !/gate pass on clone does not imply/i.test(text);
    });
    return dedupeFictionDigestExportNotes([...filtered, ...extras, ...canonical]);
}

function reconcileBenchmarkDigestScanMetrics(report) {
    const repoTotal = report.repositoryFilesTotal ?? report.repositoryInventory?.totalFiles ?? null;
    const ruleScoped = report.ruleScopedFilesAnalyzed ?? report.scanScope?.ruleScopedFilesAnalyzed ?? null;
    const cap = repoTotal ?? ruleScoped;
    const rawLlm = report.llmSlopScanRaw
        ?? report.scanScope?.llmSlopScanRaw
        ?? report.llmSlopFilesScanned
        ?? report.scanScope?.llmSlopFilesScanned
        ?? 0;
    if (cap == null || rawLlm <= cap) return report;

    const scanScope = {
        ...(report.scanScope || {}),
        llmSlopFilesScanned: cap,
        llmSlopScanRaw: rawLlm,
        llmSlopScanReconciled: true
    };
    return {
        ...report,
        llmSlopFilesScanned: cap,
        llmSlopScanRaw: rawLlm,
        llmSlopScanReconciled: true,
        scanScope
    };
}

function sanitizeBenchmarkDigestScanScope(scanScope, report) {
    if (!scanScope) return scanScope;
    const repoTotal = report.repositoryFilesTotal ?? report.repositoryInventory?.totalFiles ?? null;
    const scanned = scanScope.llmSlopFilesScanned ?? report.llmSlopFilesScanned ?? repoTotal;
    const rawLlm = scanScope.llmSlopScanRaw ?? report.llmSlopScanRaw;
    const reconciled = scanScope.llmSlopScanReconciled ?? report.llmSlopScanReconciled;
    if (!reconciled || rawLlm == null || scanned == null || rawLlm <= scanned) {
        return scanScope;
    }
    const next = { ...scanScope };
    delete next.llmSlopScanRaw;
    next.llmSlopReconciliationNote = `LLM slop scan reconciled from ${rawLlm} to ${scanned} files to match clone inventory.`;
    return next;
}

function resolveBenchmarkDigestGateAttestation(sourceReport) {
    if (!sourceReport) return 'benchmark-clone';
    if (sourceReport.gateAttestation === 'benchmark-clone') return 'benchmark-clone';
    const ruleScoped = sourceReport.ruleScopedFilesAnalyzed ?? sourceReport.scanScope?.ruleScopedFilesAnalyzed ?? 0;
    if (sourceReport.gate?.pass && ruleScoped > 0) return 'benchmark-clone';
    if (sourceReport.gate?.pass && ruleScoped === 0) return 'limited-benchmark';
    return 'benchmark-clone';
}

function buildBenchmarkFictionScopeSummary(sourceReport) {
    const scope = sourceReport?.scanScope || {};
    const repoTotal = sourceReport?.repositoryFilesTotal ?? scope.repositoryFilesTotal ?? null;
    const llmScanned = scope.llmSlopFilesScanned ?? sourceReport?.llmSlopFilesScanned ?? repoTotal;
    const rawLlm = scope.llmSlopScanRaw ?? sourceReport?.llmSlopScanRaw;
    const reconciled = scope.llmSlopScanReconciled ?? sourceReport?.llmSlopScanReconciled;
    return {
        benchmarkScannerMetaExcluded: scope.benchmarkScannerMetaExcluded ?? 0,
        benchmarkCloneNoiseExcluded: scope.benchmarkCloneNoiseExcluded ?? 0,
        fictionJsonFilesScanned: sourceReport?.fictionJsonFilesScanned ?? scope.fictionJsonFilesScanned ?? null,
        ruleScopedFilesAnalyzed: sourceReport?.ruleScopedFilesAnalyzed ?? scope.ruleScopedFilesAnalyzed ?? 0,
        repositoryFilesTotal: repoTotal,
        llmSlopFilesScanned: llmScanned,
        ...(reconciled && rawLlm != null && llmScanned != null && rawLlm > llmScanned
            ? { llmSlopScanReconciledFrom: rawLlm }
            : {})
    };
}

function resolveProductFictionDigestGateAttestation(sourceReport) {
    if (!sourceReport) return 'limited-scope';
    const ruleScoped = sourceReport.ruleScopedFilesAnalyzed ?? sourceReport.scanScope?.ruleScopedFilesAnalyzed ?? 0;
    if (sourceReport.gate?.pass === false) return 'fiction-review-required';
    if (sourceReport.gate?.pass && ruleScoped > 0) return 'platform-fiction-clean';
    if (sourceReport.gate?.pass && ruleScoped === 0) return 'limited-scope';
    return 'limited-scope';
}

function summarizeAncillaryPatternHits(sourceReport) {
    const totals = sourceReport?.scanScope?.fullDirectoryStats?.ruleHitTotals
        ?? sourceReport?.fullDirectoryStats?.ruleHitTotals;
    if (totals && typeof totals === 'object') {
        const ancillary = {};
        for (const [key, val] of Object.entries(totals)) {
            if (key === 'fictionKpi' || !val) continue;
            ancillary[key] = val;
        }
        if (Object.keys(ancillary).length > 0) {
            return { fictionKpi: totals.fictionKpi ?? 0, ancillary };
        }
        return null;
    }
    const scope = sourceReport?.scanScope || {};
    const ancillary = {};
    if ((scope.llmSlopPatternHits ?? 0) > 0) ancillary.llmSlop = scope.llmSlopPatternHits;
    if ((scope.euAiActPatternHits ?? 0) > 0) ancillary.euAiAct = scope.euAiActPatternHits;
    const prodLeak = scope.productionLeakFindings ?? sourceReport?.productionLeakFindings ?? 0;
    if (prodLeak > 0) ancillary.productionLeak = prodLeak;
    return Object.keys(ancillary).length ? { fictionKpi: 0, ancillary } : null;
}

function formatAncillaryPatternHitsNote(sourceReport) {
    const summary = summarizeAncillaryPatternHits(sourceReport);
    if (!summary?.ancillary) return null;
    const parts = Object.entries(summary.ancillary).map(([key, val]) => {
        const label = key === 'llmSlop' ? 'LLM slop'
            : key === 'euAiAct' ? 'EU AI Act'
            : key === 'agencyHandoff' ? 'agency-handoff'
            : key === 'productionLeak' ? 'production-leak'
            : key;
        return `${label}: ${val}`;
    });
    const total = Object.values(summary.ancillary).reduce((sum, n) => sum + n, 0);
    const blocking = sourceReport?.gate?.blockingCount ?? 0;
    const gateClause = blocking > 0
        ? `gate blockingCount ${Number(blocking).toLocaleString()} on configured severities`
        : 'gate blockingCount 0 on configured severities';
    return `${total} ancillary pattern hit(s) in full-tree scan (${parts.join(', ')}) — not fiction-KPI digest rows; ${gateClause}.`;
}

function resolveFictionDigestGateContext(sourceReport, digest, options = {}) {
    const gate = options.gateReport || {};
    const scope = sourceReport?.scanScope || {};
    const hygiene = digest?.hygieneSummary || {};
    return {
        gateReport: gate,
        repositoryFilesTotal: options.repositoryFilesTotal
            ?? gate.repositoryFilesTotal
            ?? sourceReport?.repositoryFilesTotal
            ?? scope.repositoryFilesTotal
            ?? hygiene.repositoryFilesTotal
            ?? digest?.scanScope?.gateRepositoryFilesTotal
            ?? null,
        contentScanned: scope.fullDirectoryStats?.contentScanned
            ?? scope.fullDirectoryStats?.filesContentScanned
            ?? sourceReport?.credentialScanned
            ?? gate.credentialScanned
            ?? hygiene.contentFilesScanned
            ?? null,
        gateProfile: scope.profile
            ?? scope.gateRuleBundleProfile
            ?? digest?.scanScope?.gateRuleBundleProfile
            ?? hygiene.gateRuleBundleProfile
            ?? gate.scanScope?.profile
            ?? null,
        gatePass: gate.gate?.pass ?? sourceReport?.gate?.pass ?? hygiene.gatePass ?? null,
        blockingCount: gate.gate?.blockingCount
            ?? gate.issueCount
            ?? sourceReport?.gate?.blockingCount
            ?? hygiene.blockingCount
            ?? null
    };
}

function buildProductFictionHygieneSummary(sourceReport, digest, options = {}) {
    const gateContext = resolveFictionDigestGateContext(sourceReport, digest, options);
    const { repositoryFilesTotal: repoTotal, contentScanned, gateProfile, gateReport, gatePass, blockingCount } = gateContext;
    const scope = sourceReport?.scanScope || {};
    const ancillary = summarizeAncillaryPatternHits(sourceReport);
    const sourceScanned = scope.sourceCodeFilesScanned ?? sourceReport?.sourceCodeFilesScanned ?? null;
    const jestChecked = sourceReport?.jestBaselineChecked === false
        || scope.jestExecutedDuringScan === false
        || gateReport.jestBaselineChecked === false
        || digest?.hygieneSummary?.jestBaselineChecked === false
        ? false
        : null;
    return {
        digestTrust: digest.digestTrust ?? null,
        gatePass: gatePass ?? null,
        blockingCount: blockingCount ?? 0,
        repositoryFilesTotal: repoTotal,
        ruleScopedFilesAnalyzed: sourceReport?.ruleScopedFilesAnalyzed ?? scope.ruleScopedFilesAnalyzed ?? null,
        fictionJsonFilesScanned: sourceReport?.fictionJsonFilesScanned ?? scope.fictionJsonFilesScanned ?? null,
        fictionSampleFilesScanned: sourceReport?.fictionSampleFilesScanned ?? scope.fictionSampleFilesScanned ?? null,
        fictionKpiHits: (digest.fictionIssues || []).reduce((sum, issue) => sum + (issue.count || 1), 0),
        fullDirectoryScan: Boolean(sourceReport?.fullDirectoryScan || scope.fullDirectoryScan),
        sourceCodeFilesScanned: sourceScanned,
        ...(contentScanned != null ? { contentFilesScanned: contentScanned } : {}),
        ...(repoTotal != null && contentScanned != null && repoTotal > contentScanned
            ? { metadataOnlyInventoryFiles: repoTotal - contentScanned }
            : {}),
        ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
        ...(ancillary?.fictionKpi != null ? { fictionKpiPatternHits: ancillary.fictionKpi } : {}),
        ...(ancillary?.ancillary ? { ancillaryPatternHits: ancillary.ancillary } : {}),
        ...(jestChecked === false ? { jestBaselineChecked: false } : {}),
        attestationNote: 'Fiction/KPI digest hygiene — not vendor handoff or Complete scan clearance certification.'
    };
}

function buildProductFictionScanScope(sourceReport, digest, options = {}) {
    const gateContext = resolveFictionDigestGateContext(sourceReport, digest, options);
    const scope = sourceReport?.scanScope || {};
    const { repositoryFilesTotal: gateTotal, gateProfile } = gateContext;
    return {
        resultsViewScope: scope.resultsViewScope || 'platform-only',
        reportHealth: scope.reportHealth || 'platform-scoped',
        securityHandoffEligible: false,
        fullDirectoryScan: Boolean(sourceReport?.fullDirectoryScan || scope.fullDirectoryScan),
        ...(gateTotal != null ? { gateRepositoryFilesTotal: gateTotal } : {}),
        ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
        fictionDigestNote: scope.fictionDigestNote
            || digest?.scanScope?.fictionDigestNote
            || 'Fiction/KPI digest export — gate pass here does not replace Complete scan clearance bundle.'
    };
}

function buildProductFictionExportNotes(digest, sourceReport, options = {}) {
    const notes = [
        'securityHandoffEligible is false — fiction/KPI digest is hygiene attestation only, not vendor security handoff.',
        'Absolute scan paths are redacted to project label in operator exports.'
    ];
    const gateContext = resolveFictionDigestGateContext(sourceReport, digest, options);
    const { repositoryFilesTotal: repoTotal, contentScanned, gateProfile, gatePass } = gateContext;
    if (repoTotal != null && contentScanned != null && contentScanned < repoTotal) {
        notes.push(
            `Gate content-scanned ${Number(contentScanned).toLocaleString()} production-path file(s) — ${Number(repoTotal - contentScanned).toLocaleString()} binary/metadata-only path(s) in full-tree inventory of ${Number(repoTotal).toLocaleString()}.`
        );
    }
    const scope = sourceReport?.scanScope || {};
    const fictionJson = sourceReport?.fictionJsonFilesScanned ?? scope.fictionJsonFilesScanned;
    const sourceScanned = scope.sourceCodeFilesScanned ?? sourceReport?.sourceCodeFilesScanned;
    if (fictionJson != null && sourceScanned != null) {
        notes.push(
            `Fiction/KPI rules evaluated ${Number(fictionJson).toLocaleString()} repository JSON path(s) plus ${Number(sourceScanned).toLocaleString()} source file(s) under server/, src/.`
        );
    }
    if (!scope.jestExecutedDuringScan) {
        notes.push('Jest was not run during this scan — use `npm run simplebeacon:full` or `npm test` for live test verification.');
    }
    if (scope.mockSampleFilesReconciledNote) {
        notes.push(scope.mockSampleFilesReconciledNote);
    }
    const mockSamples = sourceReport?.mockSampleFiles
        ?? sourceReport?.totalFiles
        ?? scope.mockSampleFilesInScanPaths
        ?? 0;
    const fictionSamples = sourceReport?.fictionSampleFilesScanned
        ?? scope.fictionSampleFilesScanned
        ?? 0;
    if (mockSamples > 0 && fictionSamples === 0 && !scope.mockSampleFilesReconciledNote) {
        notes.push(
            `${mockSamples} mock-data path(s) exist in the tree — fiction KPI rules target *-sample.json filenames; none were counted in this pass.`
        );
    }
    const ruleScoped = sourceReport?.ruleScopedFilesAnalyzed ?? scope.ruleScopedFilesAnalyzed ?? 0;
    if (sourceReport?.fullDirectoryScan || scope.fullDirectoryScan) {
        notes.push(
            'Fiction digest sourced from intentional full-directory scan — rule-scoped counts include configured production paths (e.g. server/, src/).'
        );
    }
    if (gatePass && ruleScoped > 0) {
        notes.push(
            `Gate pass on ${Number(ruleScoped).toLocaleString()} rule-scoped files — fiction digest is hygiene only, not vendor handoff certification.`
        );
    } else if (gatePass && ruleScoped === 0) {
        notes.push('Gate pass with zero rule-scoped files — limited-scope attestation; re-run on product root with gate profile.');
    } else if (gatePass === false) {
        const blocking = gateContext.blockingCount ?? 0;
        if (blocking > 0) {
            notes.push(
                `Gate FAIL — ${Number(blocking).toLocaleString()} blocking finding(s) in bundled scan — fiction KPI rows are clean; see json/simplebeacon-gate.json for production-path evidence.`
            );
        }
    }
    const profile = gateProfile ?? sourceReport?.scanScope?.profile;
    if (profile && !/^(gate|full-tree)$/i.test(String(profile))) {
        notes.push(
            `scanScope.profile (${profile}) reflects Complete scan rule bundle — fiction digest lists fiction-KPI rows only.`
        );
    }
    const ancillaryNote = formatAncillaryPatternHitsNote(sourceReport);
    if (ancillaryNote) {
        notes.push(ancillaryNote);
    }
    if ((digest.fictionIssues || []).length === 0 && (digest.nonFictionIssues || []).length === 0) {
        notes.push(ancillaryNote
            ? 'No fiction-KPI digest rows exported — ancillary pattern totals are in sourceReport.scanScope.fullDirectoryStats.ruleHitTotals.'
            : 'No fiction or ancillary pattern rows in digest export — see sourceReport.scanScope for scan limits.');
    }
    return [...new Set(notes)].slice(0, 12);
}

function enrichProductSourceReport(sourceReport) {
    if (!sourceReport || sourceReport.type !== 'simplebeacon-report') return sourceReport;
    const { gateAttestation: _gateAttestation, ...reportRest } = sourceReport;
    const intentionalFullTree = Boolean(sourceReport.fullDirectoryScan || sourceReport.scanScope?.fullDirectoryScan);
    const reportHealth = intentionalFullTree
        ? 'platform-scoped-full-tree'
        : (sourceReport.scanScope?.reportHealth || 'platform-scoped');
    const scanProfile = sourceReport.scanScope?.profile;
    const fictionDigestProfileNote = scanProfile && !/^(gate|full-tree)$/i.test(String(scanProfile))
        ? `scanScope.profile (${scanProfile}) reflects Complete scan rule bundle — fiction digest lists fiction-KPI rows only.`
        : undefined;
    return {
        ...reportRest,
        scanTargetProfile: 'product',
        exportSanitized: true,
        handoffEligible: false,
        securityHandoffEligible: false,
        scanScope: {
            ...(sourceReport.scanScope || {}),
            resultsViewScope: sourceReport.scanScope?.resultsViewScope || 'platform-only',
            reportHealth,
            rescanRecommended: intentionalFullTree
                ? false
                : Boolean(sourceReport.scanScope?.rescanRecommended),
            inventoryMetricsStale: intentionalFullTree
                ? false
                : (sourceReport.scanScope?.inventoryMetricsStale ?? false),
            fictionDigestNote: 'Fiction/KPI digest export — gate pass here does not replace Complete scan clearance bundle.',
            ...(fictionDigestProfileNote ? { fictionDigestProfileNote } : {})
        }
    };
}

function resolveDigestTrust(benchmarkScan, fictionIssues, sourceReport) {
    if (benchmarkScan) return 'benchmark-clone';
    const fictionN = fictionIssues.reduce((sum, issue) => sum + (issue.count || 1), 0);
    if (fictionN > 0) return 'review';
    const ruleScoped = sourceReport?.ruleScopedFilesAnalyzed ?? sourceReport?.scanScope?.ruleScopedFilesAnalyzed ?? 0;
    const hollow = sourceReport?.gate?.pass && ruleScoped === 0;
    if (hollow) return 'limited-scope';
    return 'trustworthy';
}

function sanitizeSourceReportForDigest(report, projectPath) {
    if (!report || report.type !== 'simplebeacon-report') return report;

    const projectKey = String(report.projectRoot || projectPath || '').replace(/\\/g, '/');
    const benchmarkTarget = isExternalBenchmarkCachePath(projectKey);
    const sourceIssues = report.rawIssues?.length ? report.rawIssues : (report.detectedIssues || []);
    const platformIssues = [];
    const benchmarkCacheIssues = [...(report.benchmarkCacheIssues || [])];
    const benchmarkCloneNoiseIssues = [];
    const benchmarkScannerMetaIssues = [];

    for (const issue of sourceIssues) {
        const paths = [
            issue?.filePath,
            issue?.file,
            ...(issue?.affectedFiles || []),
            ...(issue?.filePaths || [])
        ].filter(Boolean);
        if (paths.some(isExternalBenchmarkCachePath)) {
            benchmarkCacheIssues.push(issue);
        } else if (benchmarkTarget && isBenchmarkCloneNoiseIssue(issue)) {
            benchmarkCloneNoiseIssues.push(issue);
        } else if (benchmarkTarget && isBenchmarkScannerMetaIssue(issue)) {
            benchmarkScannerMetaIssues.push(issue);
        } else {
            platformIssues.push(issue);
        }
    }

    const gateConfig = report.gate || report.scanScope?.gatePolicy || { failOn: ['high'], warnOn: ['medium', 'low'] };
    const blockingCount = platformIssues
        .filter((issue) => (gateConfig.failOn || ['high']).includes(issue.severityBand || issue.severity))
        .reduce((sum, issue) => sum + (issue.count || 1), 0);
    const warningCount = platformIssues
        .filter((issue) => (gateConfig.warnOn || ['medium', 'low']).includes(issue.severityBand || issue.severity))
        .reduce((sum, issue) => sum + (issue.count || 1), 0);
    const ruleScoped = report.ruleScopedFilesAnalyzed ?? report.scanScope?.ruleScopedFilesAnalyzed ?? 0;
    const gatePass = blockingCount === 0;
    const hollowGate = gatePass && ruleScoped === 0;
    const intentionalFullTree = Boolean(report.fullDirectoryScan || report.scanScope?.fullDirectoryScan);
    const staleFullTreeScan = !benchmarkTarget && !intentionalFullTree && isStaleFullTreeScan(report);

    const limitations = benchmarkTarget
        ? ['Scanning OSS benchmark clone under github-cache/ — Simplebeacon product gate paths were not evaluated.']
        : (report.scanScope?.limitations || []).filter(
            (line) => line && !/69k\+ files/i.test(String(line))
        );

    let normalizedReport = benchmarkTarget ? reconcileBenchmarkDigestScanMetrics(report) : report;
    const gateAttestation = benchmarkTarget
        ? resolveBenchmarkDigestGateAttestation(normalizedReport)
        : undefined;
    const scanScopeBase = {
        ...(normalizedReport.scanScope || {}),
        resultsViewScope: benchmarkTarget ? 'benchmark-clone' : 'platform-only',
        benchmarkScanTarget: benchmarkTarget || undefined,
        benchmarkCacheIssuesExcluded: benchmarkCacheIssues.length,
        benchmarkCloneNoiseExcluded: benchmarkCloneNoiseIssues.length || undefined,
        benchmarkScannerMetaExcluded: benchmarkScannerMetaIssues.length || undefined,
        reportHealth: benchmarkTarget
            ? 'benchmark-clone-scan'
            : intentionalFullTree
                ? 'platform-scoped-full-tree'
                : staleFullTreeScan
                    ? 'stale-full-tree-scan'
                    : (normalizedReport.scanScope?.reportHealth || 'platform-scoped'),
        rescanRecommended: benchmarkTarget
            ? false
            : intentionalFullTree
                ? false
                : staleFullTreeScan || Boolean(normalizedReport.scanScope?.rescanRecommended),
        limitations,
        inventoryMetricsStale: benchmarkTarget
            ? false
            : intentionalFullTree
                ? false
                : (normalizedReport.scanScope?.inventoryMetricsStale ?? staleFullTreeScan)
    };
    const scanScope = benchmarkTarget
        ? sanitizeBenchmarkDigestScanScope(scanScopeBase, normalizedReport)
        : reconcileProductDigestScanScope(scanScopeBase, normalizedReport);

    return {
        ...normalizedReport,
        projectRoot: normalizeDigestProjectPaths(normalizedReport.projectRoot || projectKey, projectLabelFromPath(projectKey)),
        platformRoot: benchmarkTarget
            ? normalizeDigestProjectPaths(normalizedReport.platformRoot || resolveProductPlatformRoot(projectKey), projectLabelFromPath(projectKey))
            : normalizeDigestProjectPaths(normalizedReport.platformRoot, projectLabelFromPath(projectKey)),
        rawIssues: platformIssues,
        detectedIssues: platformIssues.slice(0, 12),
        benchmarkCacheIssues,
        benchmarkCloneNoiseIssues: benchmarkCloneNoiseIssues.length
            ? benchmarkCloneNoiseIssues
            : undefined,
        benchmarkScannerMetaIssues: benchmarkScannerMetaIssues.length
            ? benchmarkScannerMetaIssues
            : undefined,
        issueCount: blockingCount,
        gate: {
            ...gateConfig,
            pass: gatePass,
            blockingCount,
            warningCount
        },
        ...(hollowGate && !benchmarkTarget ? { gateAttestation: 'limited-scope' } : {}),
        ...(benchmarkTarget ? { gateAttestation } : {}),
        scanScope,
        ...(benchmarkTarget
            ? {
                benchmarkScan: true,
                scanTargetProfile: 'benchmark-cache',
                handoffEligible: false,
                productPlatformRoot: normalizeDigestProjectPaths(resolveProductPlatformRoot(projectKey))
            }
            : {})
    };
}

/**
 * @param {object} digest
 * @param {object} [options]
 * @returns {object}
 */
function sanitizeFictionDigestExport(digest, options = {}) {
    if (!digest || typeof digest !== 'object') return digest;
    if (digest.type !== 'simplebeacon-fiction-digest') return digest;

    const hintedPath = inferDigestScanTargetFromHints(digest, options);
    const rawProjectPath = hintedPath || resolveDigestProjectPath(digest, options);
    const benchmarkScan = isBenchmarkFictionDigest(digest, { ...options, projectPath: rawProjectPath });
    const projectLabel = projectLabelFromPath(rawProjectPath);
    const projectPath = normalizeDigestProjectPaths(rawProjectPath, projectLabel);
    const rawPlatformRoot = benchmarkScan
        ? (options.productPlatformRoot || resolveProductPlatformRoot(rawProjectPath))
        : null;
    const productPlatformRoot = rawPlatformRoot
        ? normalizeDigestProjectPaths(rawPlatformRoot, projectLabelFromPath(rawPlatformRoot))
        : null;

    const sourceReport = digest.sourceReport
        ? sanitizeSourceReportForDigest(digest.sourceReport, rawProjectPath)
        : null;

    const fictionIssues = filterDigestIssues(digest.fictionIssues || [], benchmarkScan);
    const nonFictionIssues = filterDigestIssues(digest.nonFictionIssues || [], benchmarkScan);

    const normalizedPath = projectPath;
    const scanTargetRoot = normalizedPath;
    const enrichedSourceReport = benchmarkScan
        ? sourceReport
        : enrichProductSourceReport(sourceReport);

    const conclusion = benchmarkScan
        ? buildBenchmarkFictionConclusion(fictionIssues, nonFictionIssues, enrichedSourceReport)
        : (digest.conclusion || (enrichedSourceReport
            ? buildScanConclusion(enrichedSourceReport, { focus: 'fiction' })
            : ''));

    const digestTrust = resolveDigestTrust(benchmarkScan, fictionIssues, enrichedSourceReport);
    const fictionScopePreview = benchmarkScan
        ? buildBenchmarkFictionScopeSummary(enrichedSourceReport)
        : null;
    const ancillaryPatternSummary = benchmarkScan ? null : summarizeAncillaryPatternHits(enrichedSourceReport);
    const exportNotes = benchmarkScan
        ? buildBenchmarkFictionExportNotes(
            digest.exportNotes || [],
            fictionScopePreview?.llmSlopScanReconciledFrom != null
                ? [`LLM slop file count reconciled from ${fictionScopePreview.llmSlopScanReconciledFrom} to ${fictionScopePreview.llmSlopFilesScanned} clone inventory files on benchmark export.`]
                : []
        )
        : buildProductFictionExportNotes(
            { ...digest, fictionIssues, nonFictionIssues, digestTrust },
            enrichedSourceReport,
            options
        );

    return {
        type: 'simplebeacon-fiction-digest',
        generatedAt: digest.generatedAt || new Date().toISOString(),
        conclusion,
        fictionIssues,
        nonFictionIssues,
        digestTrust,
        projectPath: normalizedPath,
        sourceProjectPath: normalizeDigestProjectPaths(digest.sourceProjectPath, projectLabel) || normalizedPath,
        ...(benchmarkScan
            ? {
                benchmarkScan: true,
                scanTargetProfile: 'benchmark-cache',
                handoffEligible: false,
                exportNormalized: true,
                scanTargetRoot,
                platformRoot: productPlatformRoot || undefined,
                productPlatformRoot: productPlatformRoot || undefined,
                gateAttestation: resolveBenchmarkDigestGateAttestation(enrichedSourceReport),
                fictionScopeSummary: buildBenchmarkFictionScopeSummary(enrichedSourceReport)
            }
            : {
                exportNormalized: true,
                scanTargetProfile: 'product',
                securityHandoffEligible: false,
                handoffEligible: false,
                gateAttestation: resolveProductFictionDigestGateAttestation(enrichedSourceReport),
                fictionScopeSummary: {
                    fictionJsonFilesScanned: enrichedSourceReport?.fictionJsonFilesScanned
                        ?? enrichedSourceReport?.scanScope?.fictionJsonFilesScanned
                        ?? null,
                    fictionSampleFilesScanned: enrichedSourceReport?.fictionSampleFilesScanned
                        ?? enrichedSourceReport?.scanScope?.fictionSampleFilesScanned
                        ?? null,
                    sourceFictionPatternHits: enrichedSourceReport?.scanScope?.sourceFictionPatternHits ?? 0,
                    jestExecutedDuringScan: enrichedSourceReport?.scanScope?.jestExecutedDuringScan ?? false,
                    ...(ancillaryPatternSummary?.ancillary
                        ? { ancillaryPatternHits: ancillaryPatternSummary.ancillary }
                        : {})
                },
                hygieneSummary: buildProductFictionHygieneSummary(enrichedSourceReport, {
                    ...digest,
                    fictionIssues,
                    nonFictionIssues,
                    digestTrust
                }, options),
                scanScope: buildProductFictionScanScope(enrichedSourceReport, {
                    ...digest,
                    fictionIssues,
                    nonFictionIssues,
                    digestTrust
                }, options)
            }),
        sourceReport: enrichedSourceReport,
        exportSanitized: true,
        exportNotes: exportNotes.length ? exportNotes : undefined
    };
}

module.exports = {
    isBenchmarkCloneNoiseIssue,
    isBenchmarkScannerMetaIssue,
    isBenchmarkDigestExcludedIssue,
    filterDigestIssues,
    isBenchmarkFictionDigest,
    resolveDigestProjectPath,
    inferDigestScanTargetFromHints,
    normalizeDigestProjectPaths,
    buildProductFictionExportNotes,
    buildProductFictionHygieneSummary,
    buildProductFictionScanScope,
    summarizeAncillaryPatternHits,
    buildBenchmarkFictionExportNotes,
    dedupeFictionDigestExportNotes,
    buildBenchmarkFictionScopeSummary,
    resolveProductFictionDigestGateAttestation,
    sanitizeSourceReportForDigest,
    sanitizeFictionDigestExport
};
